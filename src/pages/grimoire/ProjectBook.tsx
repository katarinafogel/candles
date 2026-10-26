// An open project book. Opening unties the cord and turns the cover; then the pages: one on a phone
// (swiped), a spread of two on a wide screen. The first page holds the description, the target date and
// «добавить дело в книгу»; the next ones hold the deeds as cards, done ones on the last pages.
// A quest opens its steps on the page next to it. Open deeds are dragged by their grip to reorder.
import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LuGripVertical, LuPencil } from 'react-icons/lu'
import { Navigate, useParams } from 'react-router-dom'
import { BookCover, bookColor } from '../../components/grimoire/BookCover'
import { QuickAdd } from '../../components/grimoire/QuickAdd'
import { TaskCard } from '../../components/grimoire/TaskCard'
import { useTaskDialog } from '../../components/grimoire/TaskDialog'
import { Sparkle } from '../../components/Magic'
import { PageHeader } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { daysBetween, humanDay, plural } from '../../grimoire/days'
import { projectProgress, projectTasks, stepsOf, words } from '../../grimoire/selectors'
import type { Task } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { ProjectDialog } from './Projects'

const PER_PAGE = 4
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Dragging a card by its grip: the order changes live under the finger and is saved on release. */
function useReorder(ids: string[], save: (ids: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null)
  const dragging = useRef<string | null>(null)
  const shown = order ?? ids

  function onPointerDown(id: string, e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = id
    let current = ids
    setOrder(ids)
    const move = (ev: PointerEvent) => {
      const over = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-reorder]')?.dataset.reorder
      if (!over || over === dragging.current) return
      const next = current.filter((x) => x !== dragging.current)
      const at = next.indexOf(over) + (current.indexOf(over) > current.indexOf(dragging.current!) ? 1 : 0)
      next.splice(at, 0, dragging.current!)
      current = next
      setOrder(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (current.join() !== ids.join()) save(current)
      dragging.current = null
      setOrder(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  return { shown, onPointerDown, dragging: order ? dragging.current : null }
}

function Page({ children, n, id, wideOnly }: { children: ReactNode; n: number; id?: string; wideOnly?: boolean }) {
  const left = n % 2 === 1
  return (
    <Box
      id={id}
      display={wideOnly ? { base: 'none', md: 'block' } : undefined}
      flex={{ base: '0 0 100%', md: '0 0 50%' }}
      scrollSnapAlign="start"
      position="relative"
      px={{ base: '4', md: '6' }}
      pt="6"
      pb="10"
      minH={{ base: '62vh', md: '560px' }}
      color="#3a2c1e"
      background={`radial-gradient(120% 80% at ${left ? '100%' : '0%'} 50%, rgba(120,90,50,.18), transparent 55%), linear-gradient(180deg, #efe3c8, #e6d6b3)`}
      boxShadow={left ? 'inset -14px 0 18px -14px rgba(60,40,20,.55)' : 'inset 14px 0 18px -14px rgba(60,40,20,.55)'}
      css={{
        // The page is light paper: plain text on it is dark ink.
        '--chakra-colors-fg': '#3a2c1e',
        '--chakra-colors-fg-muted': '#6a5640',
        '--chakra-colors-fg-subtle': '#7d6850',
        '--chakra-colors-border': 'rgba(90,60,30,.3)',
        '--chakra-colors-bg-subtle': 'rgba(255,250,238,.6)',
        // Buttons and fields keep the sage palette, darkened to read on paper.
        '--chakra-colors-emerald-fg': '#465a35',
        '--chakra-colors-emerald-muted': 'rgba(70,90,53,.22)',
        '--chakra-colors-emerald-subtle': 'rgba(70,90,53,.12)',
        '--chakra-colors-emerald-border': 'rgba(70,90,53,.5)',
      }}
    >
      {children}
      <Text position="absolute" bottom="3" left="0" right="0" textAlign="center" fontFamily="heading" fontSize="sm" color="#8a7356">
        — {n} —
      </Text>
    </Box>
  )
}

export default function ProjectBook() {
  const { id = '' } = useParams()
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const { open, dialog } = useTaskDialog()
  const project = g.projects[id]
  const [editing, setEditing] = useState(false)
  const [quest, setQuest] = useState<string>()
  // The opening: the cord comes off, then the cover turns away.
  const [stage, setStage] = useState<'tied' | 'untied' | 'opening' | 'open'>(() => (reducedMotion() ? 'open' : 'tied'))
  const pages = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (stage === 'open') return
    const t1 = setTimeout(() => setStage('untied'), 250)
    const t2 = setTimeout(() => setStage('opening'), 650)
    const t3 = setTimeout(() => setStage('open'), 1350)
    return () => [t1, t2, t3].forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const deeds = useMemo(() => (project ? projectTasks(g, project.id) : []), [g, project])
  const openIds = deeds.filter((t) => t.status !== 'done').map((t) => t.id)
  const reorder = useReorder(openIds, (ids) => dispatch(A.reorderTasks(ids)))
  const ordered: Task[] = [...reorder.shown.map((x) => g.tasks[x]).filter(Boolean), ...deeds.filter((t) => t.status === 'done')]

  // Pages of cards; a quest's steps get the page right after the one holding it.
  const sheets: { key: string; tasks: Task[]; steps?: Task }[] = []
  for (let i = 0; i < ordered.length; i += PER_PAGE) {
    const chunk = ordered.slice(i, i + PER_PAGE)
    sheets.push({ key: `p${i}`, tasks: chunk })
    const q = chunk.find((t) => t.id === quest)
    if (q) sheets.push({ key: `q${q.id}`, tasks: stepsOf(g, q.id).filter((s) => s.status !== 'cancelled'), steps: q })
  }

  useEffect(() => {
    if (quest) document.getElementById(`steps-${quest}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }, [quest])

  if (!project) return <Navigate to="/g/projects" replace />
  const done = deeds.filter((t) => t.status === 'done').length
  const progress = projectProgress(g, project.id)
  const c = bookColor(project)
  const openCard = (t: Task) => (stepsOf(g, t.id).length ? setQuest(quest === t.id ? undefined : t.id) : open(t))

  return (
    <>
      <PageHeader title={project.title} back="/g/projects">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <LuPencil /> Обложка
        </Button>
      </PageHeader>

      <Box position="relative">
        {stage !== 'open' && (
          <Box position="absolute" inset="0" zIndex="2" display="flex" justifyContent="center" alignItems="flex-start" pt="4" pointerEvents="none" css={{ perspective: '1400px' }}>
            <Box
              w={{ base: '62%', md: '300px' }}
              transformOrigin="left center"
              transition="transform .7s cubic-bezier(.5,.1,.3,1), opacity .7s"
              transform={stage === 'opening' ? 'rotateY(-165deg)' : 'none'}
              opacity={stage === 'opening' ? 0 : 1}
            >
              <BookCover project={project} progress={progress} tied={stage === 'tied'} />
            </Box>
          </Box>
        )}

        <Flex
          ref={pages}
          overflowX="auto"
          scrollSnapType="x mandatory"
          borderRadius="6px"
          borderWidth="6px"
          borderColor={c.leather}
          boxShadow="0 18px 40px -20px rgba(0,0,0,.9)"
          className="quiet-scroll"
          opacity={stage === 'open' ? 1 : 0}
          transition="opacity .4s"
          css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
        >
          <Page n={1}>
            <Stack gap="4">
              <Text fontFamily="heading" fontSize="2xl" fontWeight="semibold" lineHeight="1.15">
                {project.sigil ?? '🌿'} {project.title}
              </Text>
              {project.description && <Text whiteSpace="pre-wrap">{project.description}</Text>}
              <Stack gap="1" fontSize="sm" color="fg.muted">
                <Text>
                  {deeds.length ? `Сделано ${done} из ${deeds.length}` : 'Страницы пока пусты'}
                  {project.status === 'paused' ? ' · на паузе' : ''}
                </Text>
                {project.targetDate && project.status !== 'done' && (
                  <Text>
                    Цель: {humanDay(project.targetDate, today)}
                    {daysBetween(today, project.targetDate) > 0 ? ` · через ${plural(daysBetween(today, project.targetDate), 'день', 'дня', 'дней')}` : ''}
                  </Text>
                )}
                {project.jarId && g.jars[project.jarId] && <Text>Копилка: {g.jars[project.jarId].title}</Text>}
              </Stack>
              {project.status === 'done' ? (
                <HStack gap="2" p="3" borderRadius="l2" bg="rgba(255,250,238,.6)" borderWidth="1px" borderColor="border">
                  <Box color="#a0703a">
                    <Sparkle size={12} />
                  </Box>
                  <Text fontSize="sm">Книга прочитана{project.doneAt ? ` ${humanDay(project.doneAt.slice(0, 10), today)}` : ''}. Бонус {g.meta.coins.projectBonus} уже в сокровищнице.</Text>
                </HStack>
              ) : null}
              <Box>
                <Text fontSize="sm" color="fg.muted" mb="1.5">
                  Добавить дело в книгу
                </Text>
                <QuickAdd fields={{ projectId: project.id, source: 'project' }} />
              </Box>
            </Stack>
          </Page>

          {sheets.map((sh, i) =>
            sh.steps ? (
              <Page key={sh.key} n={i + 2} id={`steps-${sh.steps.id}`}>
                <Stack gap="3">
                  <Flex align="center" justify="space-between" gap="2">
                    <Text fontFamily="heading" fontSize="lg" fontWeight="semibold">
                      {words(g.meta).quest[0].toUpperCase() + words(g.meta).quest.slice(1)}: {sh.steps.title}
                    </Text>
                    <Button size="xs" variant="outline" onClick={() => open(sh.steps!)}>
                      Открыть
                    </Button>
                  </Flex>
                  {sh.tasks.map((t) => (
                    <TaskCard key={t.id} t={t} today={today} onOpen={open} compact inBook />
                  ))}
                </Stack>
              </Page>
            ) : (
              <Page key={sh.key} n={i + 2}>
                <Stack gap="3">
                  {sh.tasks.map((t) => {
                    const movable = t.status !== 'done'
                    return (
                      <Flex key={t.id} data-reorder={movable ? t.id : undefined} align="stretch" gap="1" opacity={reorder.dragging === t.id ? 0.55 : 1} transition="opacity .15s">
                        {movable && (
                          <Flex
                            as="button"
                            aria-label="Перетащить"
                            align="center"
                            px="0.5"
                            color="#8a7356"
                            cursor="grab"
                            touchAction="none"
                            onPointerDown={(e: React.PointerEvent) => reorder.onPointerDown(t.id, e)}
                          >
                            <LuGripVertical />
                          </Flex>
                        )}
                        <Box flex="1" minW="0" outline={quest === t.id ? '2px solid #a0703a' : undefined} borderRadius="10px">
                          <TaskCard t={t} today={today} onOpen={openCard} inBook />
                        </Box>
                      </Flex>
                    )
                  })}
                </Stack>
              </Page>
            ),
          )}
          {/* A wide screen shows pages in pairs: an odd count gets a blank last page. */}
          {(sheets.length + 1) % 2 === 1 && (
            <Page n={sheets.length + 2} wideOnly>
              {null}
            </Page>
          )}
        </Flex>
        <Text fontSize="xs" color="fg.subtle" mt="2" textAlign="center">
          {sheets.length > 0 ? 'листай страницы в сторону · карточки двигаются за ⋮⋮' : ''}
        </Text>
      </Box>

      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} />}
      {dialog}
    </>
  )
}
