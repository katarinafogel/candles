import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { confirmAction, Field, Modal, PageHeader, TextArea, TextInput } from '../components/ui'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { Instruction } from '../types'

export default function Instructions() {
  const d = useData()
  const dispatch = useAppDispatch()
  const [edit, setEdit] = useState<(Omit<Instruction, 'id'> & { id?: string }) | null>(null)
  const used = (id: string) => Object.values(d.candles).filter((c) => c.instructionId === id).length

  return (
    <>
      <PageHeader title="Инструкции" back="/more">
        <Button size="sm" onClick={() => setEdit({ title: '', text: '' })}>
          <LuPlus /> Шаблон
        </Button>
      </PageHeader>
      <Text fontSize="sm" color="fg.muted" mb="4">
        Текст показывается на странице получателя. Бумажный вкладыш готовится отдельно.
      </Text>
      <Stack gap="3">
        {Object.values(d.instructions).map((i) => (
          <Box key={i.id} p="4" borderWidth="1px" borderColor="border" bg="bg.subtle" borderRadius="l3" cursor="pointer" onClick={() => setEdit(i)} _hover={{ borderColor: 'emerald.700' }}>
            <Flex justify="space-between">
              <Text fontWeight="semibold">{i.title}</Text>
              <Text fontSize="xs" color="fg.muted">
                свечей: {used(i.id)}
              </Text>
            </Flex>
            <Text fontSize="sm" color="fg.muted" whiteSpace="pre-wrap" mt="2" lineClamp={4}>
              {i.text}
            </Text>
          </Box>
        ))}
      </Stack>
      {edit && (
        <Modal
          open
          onClose={() => setEdit(null)}
          title={edit.id ? 'Шаблон инструкции' : 'Новый шаблон'}
          size="lg"
          footer={
            <>
              {edit.id && edit.id !== 'default' && (
                <Button
                  variant="ghost"
                  colorPalette="red"
                  mr="auto"
                  onClick={() => {
                    if (confirmAction('Удалить шаблон?')) {
                      dispatch(actions.deleteInstruction(edit.id!))
                      setEdit(null)
                    }
                  }}
                >
                  Удалить
                </Button>
              )}
              <Button
                disabled={!edit.title.trim()}
                onClick={() => {
                  dispatch(actions.upsertInstruction(edit))
                  setEdit(null)
                }}
              >
                Сохранить
              </Button>
            </>
          }
        >
          <Stack gap="4">
            <Field label="Название">
              <TextInput value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} />
            </Field>
            <Field label="Текст">
              <TextArea value={edit.text} onChange={(v) => setEdit({ ...edit, text: v })} rows={10} />
            </Field>
          </Stack>
        </Modal>
      )}
    </>
  )
}
