import { Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Table, Text } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { LuDownload, LuFileUp, LuLogOut, LuUpload } from 'react-icons/lu'
import { Field, Modal, notify, NumInput, PageHeader, Row, Section, Select, TextInput } from '../components/ui'
import { downloadBackup, readBackup, type BackupSummary } from '../lib/backup'
import { fmtDateTime } from '../lib/calc'
import { publicBase } from '../lib/config'
import { supabase } from '../lib/supabase'
import { pendingCount, stopSync } from '../lib/sync'
import {
  applyCandleRows,
  matchCandles,
  parseCandles,
  parseFragrances,
  parseMolds,
  FRAGRANCE_IN_STOCK_G,
  type ImportPlan,
  type MoldDraft,
} from '../lib/importSheets'
import { useAppDispatch, useAppSelector, useData } from '../store'
import { actions } from '../store/dataSlice'
import { localActions } from '../store/localSlice'
import type { DataState, Settings as S } from '../types'
import { moldPurposeLabel } from '../lib/labels'

const readFile = (f: File) => f.text()

function BackupRestore() {
  const d = useData()
  const dispatch = useAppDispatch()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ data: DataState; summary: BackupSummary } | null>(null)

  return (
    <>
      <HStack wrap="wrap" gap="2">
        <Button
          onClick={async () => {
            await downloadBackup(d)
            dispatch(actions.markBackup(new Date().toISOString()))
          }}
        >
          <LuDownload /> Скачать бэкап
        </Button>
        <Button variant="outline" onClick={() => input.current?.click()}>
          <LuUpload /> Загрузить бэкап
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              setPending(readBackup(await readFile(f)))
            } catch (err) {
              notify('Не удалось прочитать файл', 'error', (err as Error).message)
            }
          }}
        />
      </HStack>
      <Text fontSize="xs" color="fg.muted" mt="2">
        Данные хранятся на сервере; бэкап — копия на всякий случай. Последний: {d.settings.lastBackupAt ? fmtDateTime(d.settings.lastBackupAt) : 'ещё не было'}.
      </Text>
      {pending && (
        <Modal
          open
          onClose={() => setPending(null)}
          title="Заменить данные из бэкапа?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Отмена
              </Button>
              <Button
                colorPalette="orange"
                onClick={async () => {
                  // Safety copy of the current state goes to the user's downloads first.
                  await downloadBackup(d)
                  dispatch(actions.replaceAll(pending.data))
                  dispatch(actions.markBackup(new Date().toISOString()))
                  setPending(null)
                  notify('Данные загружены из бэкапа')
                }}
              >
                Заменить
              </Button>
            </>
          }
        >
          <Stack gap="1" fontSize="sm">
            <Text>Файл от {fmtDateTime(pending.summary.exportedAt)} (схема v{pending.summary.schemaVersion}):</Text>
            <Text>
              свечей {pending.summary.candles}, подсвечников {pending.summary.holders}, материалов {pending.summary.materials}, форм{' '}
              {pending.summary.molds}, отзывов {pending.summary.reviews}.
            </Text>
            <Text color="orange.300" mt="2">
              Данные вашего аккаунта будут заменены содержимым файла. Перед заменой приложение скачает их бэкап.
            </Text>
          </Stack>
        </Modal>
      )}
    </>
  )
}

function FilePick({ label, onText }: { label: string; onText: (t: string, name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  return (
    <Field label={label}>
      <HStack>
        <Button size="sm" variant="outline" onClick={() => ref.current?.click()}>
          <LuFileUp /> CSV
        </Button>
        <Text fontSize="xs" color="fg.muted" truncate>
          {name || 'файл не выбран'}
        </Text>
      </HStack>
      <input
        ref={ref}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setName(f.name)
          onText(await readFile(f), f.name)
        }}
      />
    </Field>
  )
}

function SheetImport() {
  const d = useData()
  const dispatch = useAppDispatch()
  const [molds, setMolds] = useState<MoldDraft[] | null>(null)
  const [candleRows, setCandleRows] = useState<ImportPlan['candleRows'] | null>(null)
  const [frags, setFrags] = useState<ImportPlan['fragrances'] | null>(null)
  const baseMolds = molds ?? Object.values(d.molds)

  function apply() {
    const finalMolds = candleRows ? applyCandleRows(baseMolds, candleRows) : baseMolds
    if (molds || candleRows) for (const m of finalMolds) dispatch(actions.upsertMold(m))
    if (frags) {
      const date = new Date().toISOString()
      for (const f of frags) {
        dispatch(actions.upsertMaterial(f.material))
        if (f.stockG != null)
          dispatch(actions.inventory({ materialId: f.material.id, date, actual: f.stockG, comment: 'инвентаризация из таблицы' }))
      }
    }
    notify(`Импорт готов: форм ${molds || candleRows ? finalMolds.length : 0}, отдушек ${frags?.length ?? 0}`)
    setMolds(null)
    setCandleRows(null)
    setFrags(null)
  }

  const unmatched = candleRows?.filter((r) => r.moldIndex == null) ?? []

  return (
    <Stack gap="4">
      <Text fontSize="sm" color="fg.muted">
        Скачайте каждый лист таблицы как CSV (Файл → Скачать → CSV). Расчётные граммы не импортируются — приложение считает их заново.
        Схему фитиля потом выберите в карточке формы.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        <FilePick
          label="Лист «Формы»"
          onText={(t) => {
            const m = parseMolds(t, d, d.settings.fragrancePct)
            setMolds(m)
            if (candleRows) setCandleRows(matchCandles(m, candleRows.map((r) => r.row)))
          }}
        />
        <FilePick label="Лист «Свечи»" onText={(t) => setCandleRows(matchCandles(baseMolds, parseCandles(t)))} />
        <FilePick label="Лист «Отдушки»" onText={(t) => setFrags(parseFragrances(t, d))} />
      </SimpleGrid>

      {molds && (
        <Box>
          <Text fontWeight="medium" mb="1">
            Формы: {molds.length} (новых {molds.filter((m) => !m.id).length})
          </Text>
          <Table.ScrollArea maxH="240px" borderWidth="1px" borderColor="border" borderRadius="l2">
            <Table.Root size="sm" stickyHeader>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Название</Table.ColumnHeader>
                  <Table.ColumnHeader>Объём</Table.ColumnHeader>
                  <Table.ColumnHeader>% воды</Table.ColumnHeader>
                  <Table.ColumnHeader>Копий</Table.ColumnHeader>
                  <Table.ColumnHeader>Тип</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {molds.map((m, i) => (
                  <Table.Row key={i}>
                    <Table.Cell>{m.name}</Table.Cell>
                    <Table.Cell>{m.waterVolumeMl}</Table.Cell>
                    <Table.Cell>{m.waterPct}</Table.Cell>
                    <Table.Cell>{m.copies}</Table.Cell>
                    <Table.Cell>{moldPurposeLabel[m.purpose]}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      )}

      {candleRows && (
        <Box>
          <Text fontWeight="medium" mb="1">
            Свечи: {candleRows.length} строк, сопоставлено {candleRows.length - unmatched.length}
          </Text>
          {unmatched.length > 0 && (
            <Stack gap="2" p="3" borderWidth="1px" borderColor="orange.700" borderRadius="l2">
              <Text fontSize="sm" color="orange.300">
                Эти названия не совпали с формами — выберите форму вручную:
              </Text>
              {candleRows.map((r, i) =>
                r.moldIndex != null && !unmatched.includes(r) ? null : (
                  <Flex key={i} gap="2" align="center" wrap="wrap">
                    <Text fontSize="sm" flex="1" minW="160px">
                      {r.row.name}
                    </Text>
                    <Box minW="220px" flex="1">
                      <Select
                        size="sm"
                        value={r.moldIndex != null ? String(r.moldIndex) : ''}
                        onChange={(v) =>
                          setCandleRows(candleRows.map((x, j) => (j === i ? { ...x, moldIndex: v === '' ? null : Number(v) } : x)))
                        }
                        placeholder="— пропустить —"
                        options={baseMolds.map((m, k) => ({ value: String(k), label: m.name }))}
                      />
                    </Box>
                  </Flex>
                ),
              )}
            </Stack>
          )}
        </Box>
      )}

      {frags && (
        <Text fontWeight="medium">
          Отдушки: {frags.length} (новых {frags.filter((f) => f.isNew).length}) · в наличии{' '}
          {frags.filter((f) => f.stockG).length} — им будет поставлен остаток {FRAGRANCE_IN_STOCK_G} г, остальным 0 · докупить{' '}
          {frags.filter((f) => f.material.toBuy).length}
        </Text>
      )}

      {(molds || candleRows || frags) && (
        <Box>
          <Button onClick={apply}>Импортировать</Button>
        </Box>
      )}
    </Stack>
  )
}

export default function Settings() {
  const d = useData()
  const dispatch = useAppDispatch()
  const profile = useAppSelector((s) => s.local.profile)
  const email = useAppSelector((s) => s.local.email)
  const [name, setName] = useState(profile?.name ?? '')
  const persisted = useAppSelector((s) => s.local.persistGranted)
  const s = d.settings
  const set = (patch: Partial<S>) => dispatch(actions.updateSettings(patch))

  return (
    <>
      <PageHeader title="Настройки" back="/more" />

      <Section title="Коэффициенты расчётов">
        <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap="4">
          <Field label="Плотность гипсового раствора">
            <NumInput value={s.plasterDensity} onChange={(v) => set({ plasterDensity: v ?? 1.82 })} suffix="г/мл" />
          </Field>
          <Field label="Пластификатор">
            <NumInput value={s.plasticizerPct} onChange={(v) => set({ plasticizerPct: v ?? 0 })} suffix="% гипса" />
          </Field>
          <Field label="Пеногаситель">
            <NumInput value={s.defoamerPct} onChange={(v) => set({ defoamerPct: v ?? 0 })} suffix="% гипса" />
          </Field>
          <Field label="Краситель для гипса">
            <NumInput value={s.plasterDyePct} onChange={(v) => set({ plasterDyePct: v ?? 0 })} suffix="% гипса" />
          </Field>
          <Field label="Запас воска на потери">
            <NumInput value={s.waxLossPct} onChange={(v) => set({ waxLossPct: v ?? 0 })} suffix="%" />
          </Field>
          <Field label="Отдушка (если в форме нет)">
            <NumInput value={s.fragrancePct} onChange={(v) => set({ fragrancePct: v ?? 0 })} suffix="%" />
          </Field>
          <Field label="Краситель для воска">
            <NumInput value={s.waxDyePct} onChange={(v) => set({ waxDyePct: v ?? 0 })} suffix="% воска" />
          </Field>
          <Field label="Лак на подсвечник">
            <NumInput value={s.varnishMlPerLayer} onChange={(v) => set({ varnishMlPerLayer: v ?? 0 })} suffix="мл/слой" />
          </Field>
        </SimpleGrid>
      </Section>

      <Section title="Аккаунт">
        <Stack gap="4">
          <Row label="Почта">{email ?? '—'}</Row>
          <Row label="Адрес в ссылках">
            <Text fontFamily="mono" fontSize="sm">
              {profile?.slug}
            </Text>
          </Row>
          <Field label="Имя мастера или мастерской" helper="видно получателям на странице свечи">
            <HStack>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button
                variant="outline"
                disabled={!name.trim() || name.trim() === profile?.name}
                onClick={async () => {
                  const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('slug', profile!.slug)
                  if (error) return notify('Не удалось сохранить', 'error', error.message)
                  dispatch(localActions.setProfile({ ...profile!, name: name.trim() }))
                  notify('Сохранено')
                }}
              >
                Сохранить
              </Button>
            </HStack>
          </Field>
          <Field label="Адрес приложения для QR" helper={`Сейчас ссылки ведут на ${publicBase(s)}#/c/${profile?.slug}/S-0001`}>
            <Input value={s.publicUrl} onChange={(e) => set({ publicUrl: e.target.value.trim() })} placeholder="https://<логин>.github.io/<репозиторий>/" />
          </Field>
          <Box>
            <Button
              variant="outline"
              colorPalette="red"
              onClick={async () => {
                const n = pendingCount()
                if (n && !window.confirm(`${n} изменений ещё не отправлены на сервер и пропадут. Всё равно выйти?`)) return
                await stopSync()
                await supabase.auth.signOut()
              }}
            >
              <LuLogOut /> Выйти
            </Button>
          </Box>
        </Stack>
      </Section>

      <Section title="Бэкап">
        <BackupRestore />
      </Section>

      <Section title="Импорт из Google-таблицы">
        <SheetImport />
      </Section>

      <Section title="Хранилище">
        <Row label="Копия на устройстве">
          {persisted ? 'браузер не удалит её при нехватке места' : 'браузер может очистить её — данные останутся на сервере'}
        </Row>
        <Row label="Версия схемы данных">{d.schemaVersion}</Row>
      </Section>
    </>
  )
}
