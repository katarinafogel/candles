// Errors nobody caught: a toast in Russian with the original text, and the error kept in the log
// (Настройки → «Последние ошибки»). A page that crashes while drawing shows a way back instead of
// a blank screen.
import { Button, Center, Code, Heading, Stack, Text } from '@chakra-ui/react'
import { Component, type ReactNode } from 'react'
import { toaster } from '@shared/components/ui'
import { logError } from '@shared/lib/errorLog'

// Harmless browser noise that would only scare.
const noise = /ResizeObserver loop|^Script error\.?$/

function caught(message: string, stack?: string) {
  if (!message || noise.test(message)) return
  logError('Что-то пошло не так', message, stack)
  toaster.create({ title: 'Что-то пошло не так', description: `${message} — текст сохранён в настройках, раздел «Последние ошибки».`, type: 'error', duration: 8000 })
}

export function installErrorCatcher() {
  window.addEventListener('error', (e) => caught(e.message, (e.error as Error | undefined)?.stack))
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as Error | string | undefined
    caught(typeof r === 'string' ? r : (r?.message ?? String(r)), typeof r === 'object' ? r?.stack : undefined)
  })
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    logError('Страница сломалась', error.message, error.stack)
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <Center minH="100dvh" px="6">
        <Stack gap="4" maxW="480px" textAlign="center" align="center">
          <Heading size="xl">Страница сломалась</Heading>
          <Text color="fg.muted">Данные на месте. Текст ошибки сохранён в настройках, раздел «Последние ошибки», — его можно скопировать и прислать.</Text>
          <Code p="2" whiteSpace="pre-wrap" wordBreak="break-word" textAlign="start">
            {error.message}
          </Code>
          <Button onClick={() => location.reload()}>Обновить страницу</Button>
        </Stack>
      </Center>
    )
  }
}
