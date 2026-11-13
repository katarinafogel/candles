// Thin wrappers over Chakra UI v3 parts so pages stay short.
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  CloseButton,
  createToaster,
  Dialog,
  Field as CField,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Portal,
  Spinner,
  Stack,
  Text,
  Textarea,
  Toast,
  Toaster as CToaster,
  Wrap,
  type BoxProps,
} from '@chakra-ui/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { parseNum } from '../lib/calc'
import { Crescent, Leaf, Sparkle } from './Magic'

export const toaster = createToaster({ placement: 'top', pauseOnPageIdle: true, offsets: { top: 'calc(16px + env(safe-area-inset-top))', bottom: '16px', left: '16px', right: '16px' } })

export function Toaster() {
  return (
    <Portal>
      <CToaster toaster={toaster} insetInline={{ mdDown: '4' }}>
        {(t) => (
          <Toast.Root
            width={{ md: 'sm' }}
            bg="bg.panel"
            color="fg"
            borderWidth="1px"
            borderColor={t.type === 'error' ? 'red.700' : t.type === 'warning' ? 'orange.700' : 'border.emphasized'}
            css={{ '--toast-trigger-bg': 'transparent' }}
          >
            {t.type === 'loading' ? (
              <Spinner size="sm" color="ember.300" />
            ) : (
              <Box color={t.type === 'error' ? 'red.400' : t.type === 'warning' ? 'orange.300' : 'ember.300'} display="flex">
                <Toast.Indicator />
              </Box>
            )}
            <Stack gap="1" flex="1" maxWidth="100%">
              {t.title && <Toast.Title>{t.title}</Toast.Title>}
              {t.description && <Toast.Description>{t.description}</Toast.Description>}
            </Stack>
            {t.action && (
              <Toast.ActionTrigger color="ember.200" borderColor="ember.700" _hover={{ bg: 'ember.subtle' }}>
                {t.action.label}
              </Toast.ActionTrigger>
            )}
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </CToaster>
    </Portal>
  )
}

/** A toast; with `action` it shows a button (like «Вернуть») and stays a little longer. */
export const notify = (
  title: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'success',
  description?: string,
  action?: { label: string; onClick: () => void },
) => toaster.create({ title, type, description, action, duration: action ? 6000 : type === 'error' ? 6000 : 3000 })

export function Field({
  label,
  helper,
  children,
  invalid,
  error,
  ...rest
}: { label?: ReactNode; helper?: ReactNode; children: ReactNode; invalid?: boolean; /** Shown instead of the helper while invalid. */ error?: ReactNode } & BoxProps) {
  return (
    <CField.Root invalid={invalid} {...(rest as object)}>
      {label && <CField.Label color="fg.muted">{label}</CField.Label>}
      {children}
      {invalid && error ? <CField.ErrorText>{error}</CField.ErrorText> : helper && <CField.HelperText>{helper}</CField.HelperText>}
    </CField.Root>
  )
}

/** «12 500»: digits in groups of three, as money is written. */
export const groupDigits = (n: number) => Math.trunc(n).toLocaleString('ru').replace(/\s/g, '\u00a0')

/**
 * Number input that accepts "27,3" and keeps the typed text while editing. `integer` takes digits
 * only (a numeric keypad on phones) and shows them grouped: «12 500».
 */
export function NumInput({
  value,
  onChange,
  placeholder,
  suffix,
  size = 'md',
  width,
  integer,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  suffix?: string
  size?: 'sm' | 'md'
  width?: string
  integer?: boolean
}) {
  const show = (v: number | undefined) => (v == null ? '' : integer ? groupDigits(v) : String(v).replace('.', ','))
  const read = (t: string) => {
    if (!integer) return parseNum(t)
    const digits = t.replace(/\D/g, '')
    return digits ? Number(digits) : undefined
  }
  const [text, setText] = useState(show(value))
  useEffect(() => {
    if (read(text) !== value) setText(show(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <HStack gap="2" width={width}>
      <Input
        size={size}
        inputMode={integer ? 'numeric' : 'decimal'}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const v = read(e.target.value)
          setText(integer ? show(v) : e.target.value)
          onChange(v)
        }}
      />
      {suffix && (
        <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">
          {suffix}
        </Text>
      )}
    </HStack>
  )
}

export interface Option {
  value: string
  label: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  size = 'md',
}: {
  value: string | undefined
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  size?: 'sm' | 'md'
}) {
  return (
    <NativeSelect.Root size={size}>
      <NativeSelect.Field value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value)}>
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  )
}

/** A gold leaf in place of a checkbox square. */
export function LeafMark({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      flexShrink={0}
      // Cards of other colors set --leaf-on / --leaf-off so the leaf stays readable on them.
      color={on ? 'var(--leaf-on, var(--chakra-colors-ember-300))' : 'var(--leaf-off, var(--chakra-colors-ember-700))'}
      transition="color .15s, filter .15s"
    >
      <Leaf on={on} size={size} />
    </Box>
  )
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children?: ReactNode
}) {
  return (
    <Checkbox.Root
      checked={checked}
      onCheckedChange={(e) => onChange(!!e.checked)}
      colorPalette="ember"
      cursor="pointer"
      alignItems="center"
      _hover={{ '& .leaf': { color: checked ? 'ember.200' : 'ember.500' } }}
    >
      <Checkbox.HiddenInput />
      <Box className="leaf" display="inline-flex">
        <LeafMark on={checked} />
      </Box>
      {children && <Checkbox.Label>{children}</Checkbox.Label>}
    </Checkbox.Root>
  )
}

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <Input value={props.value} type={props.type} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
  )
}

export function TextArea(props: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <Textarea
      value={props.value}
      rows={props.rows ?? 3}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  )
}

/** Tap-to-choose options; tapping the chosen one clears it. `children` go last in the row (a «+»). */
export function Chips<T extends string>({
  value,
  onChange,
  options,
  multi,
  children,
}: {
  value: T | T[] | undefined
  onChange: (v: T | T[] | undefined) => void
  options: { value: T; label: string }[]
  multi?: boolean
  children?: ReactNode
}) {
  const list = Array.isArray(value) ? value : value ? [value] : []
  return (
    <Wrap gap="2">
      {options.map((o) => {
        const on = list.includes(o.value)
        return (
          <Button
            key={o.value}
            size="sm"
            variant={on ? 'solid' : 'outline'}
            borderRadius="full"
            onClick={() => {
              if (multi) onChange(on ? list.filter((x) => x !== o.value) : [...list, o.value])
              else onChange(on ? undefined : o.value)
            }}
          >
            {o.label}
          </Button>
        )
      })}
      {children}
    </Wrap>
  )
}

/** Five stars: tapping the third sets 3; tapping the current value clears it. */
export function StarRating({
  value,
  onChange,
  size = 'md',
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  size?: 'sm' | 'md'
}) {
  const px = size === 'sm' ? '18px' : '24px'
  return (
    <HStack gap="0.5" role="radiogroup" aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n
        return (
          <Box
            as="button"
            key={n}
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} из 5`}
            p="0.5"
            lineHeight="0"
            color={on ? 'var(--star-on, var(--chakra-colors-ember-300))' : 'fg.subtle'}
            _hover={{ color: 'ember.200' }}
            cursor="pointer"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onChange(value === n ? undefined : n)
            }}
          >
            <svg width={px} height={px} viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2.8l2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3L2.84 9.45l6.33-.92z"
                fill={on ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </Box>
        )
      })}
    </HStack>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  initialFocusEl,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** The field to put the cursor in when the dialog opens. */
  initialFocusEl?: () => HTMLElement | null
}) {
  useVisualViewport(open)
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      initialFocusEl={initialFocusEl}
      size={{ mdDown: 'full', md: size }}
      scrollBehavior="inside"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop {...scrim} />
        <Dialog.Positioner>
          {/* Full screen on a phone: keep the title and the cross below the notch, the footer above the home bar. */}
          <Dialog.Content
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.emphasized"
            // Soft round corners; a phone shows the dialog full screen, square.
            borderRadius={{ mdDown: '0', md: '2xl' }}
            overflow="hidden"
            backgroundImage="radial-gradient(30rem 16rem at 100% 0%, var(--g-glow-soft), transparent 70%)"
            pt={{ mdDown: 'env(safe-area-inset-top)' }}
            pb={{ mdDown: 'env(safe-area-inset-bottom)' }}
            // Safari does not shrink the page under the keyboard: size the sheet by the visible part,
            // so the footer stays above the keyboard.
            h={{ mdDown: 'var(--vv-height, 100dvh)' }}
            minH={{ mdDown: 'var(--vv-height, 100dvh)' }}
            maxH={{ mdDown: 'var(--vv-height, 100dvh)' }}
            top={{ mdDown: 'var(--vv-top, 0px)' }}
          >
            <Dialog.Header>
              <Dialog.Title fontFamily="heading" fontSize="2xl" fontWeight="semibold" color="ember.100">
                {title}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>{children}</Dialog.Body>
            {footer && <Dialog.Footer>{footer}</Dialog.Footer>}
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" top={{ mdDown: 'calc(8px + env(safe-area-inset-top))' }} />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

/** Keeps --vv-height / --vv-top on <html> in step with the visible viewport while a dialog is open. */
function useVisualViewport(on: boolean) {
  useEffect(() => {
    const vv = window.visualViewport
    if (!on || !vv) return
    const root = document.documentElement.style
    const update = () => {
      root.setProperty('--vv-height', `${vv.height}px`)
      root.setProperty('--vv-top', `${vv.offsetTop}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [on])
}

/** Cancel on the left, save on the right, always on screen while a long form scrolls. */
export function FormActions({ onCancel, onSave, saveLabel = 'Сохранить', disabled }: { onCancel: () => void; onSave: () => void; saveLabel?: string; disabled?: boolean }) {
  return (
    <>
      <Box h="72px" />
      <Flex
        position="fixed"
        bottom={{ base: '72px', md: '6' }}
        left={{ base: '4', md: 'calc(240px + 2rem)' }}
        right={{ base: '4', md: '8' }}
        zIndex="docked"
        justify="space-between"
        gap="2"
        p="2"
        bg="bg.panel"
        borderWidth="1px"
        borderColor="emerald.700"
        borderRadius="l3"
      >
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button onClick={onSave} disabled={disabled}>
          {saveLabel}
        </Button>
      </Flex>
    </>
  )
}

/** `back` is the default; a list that opened this page can pass its own address (with its tab) in `state.back`. */
export function PageHeader({ title, children, back }: { title: ReactNode; children?: ReactNode; back?: string }) {
  const from = (useLocation().state as { back?: string } | null)?.back
  if (back && from) back = from
  return (
    <Flex align="center" justify="space-between" gap="3" mb="4" wrap="wrap">
      <HStack gap="3">
        {back && (
          <Button asChild variant="ghost" size="sm" px="2">
            <RouterLink to={back}>←</RouterLink>
          </Button>
        )}
        <HStack gap="2.5" align="center">
          {!back && (
            <Box color="ember.300" flexShrink={0}>
              <Sparkle size={14} />
            </Box>
          )}
          <Heading size={{ base: '2xl', md: '4xl' }} fontWeight="semibold" color="ember.50" lineHeight="1.1">
            {title}
          </Heading>
        </HStack>
      </HStack>
      {children && <HStack gap="2" wrap="wrap">{children}</HStack>}
    </Flex>
  )
}

/** `dense`: the small inner padding of the scroll's own boxes, for a section full of cards. */
export function Section({ title, children, actions, dense }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; dense?: boolean }) {
  return (
    <Card.Root
      variant="outline"
      bg="bg.subtle"
      borderColor="border"
      // On a phone the block runs edge to edge: no side borders or corners, so the content gets the width.
      mx={{ base: '-4', md: '0' }}
      borderRadius={{ base: '0', md: 'l3' }}
      borderLeftWidth={{ base: '0', md: '1px' }}
      borderRightWidth={{ base: '0', md: '1px' }}
      mb="4"
      backdropFilter="blur(2px)"
    >
      {(title || actions) && (
        <Card.Header pb="0" px={dense ? { base: '4', md: '3' } : { base: '4', md: '6' }} pt={dense ? '3' : { base: '4', md: '6' }}>
          <Flex justify="space-between" align="center" gap="2" wrap="wrap">
            {title && (
              <Heading size="xl" fontWeight="semibold" color="ember.100">
                {title}
              </Heading>
            )}
            {actions && <HStack gap="2">{actions}</HStack>}
          </Flex>
        </Card.Header>
      )}
      <Card.Body px={dense ? { base: '4', md: '3' } : { base: '4', md: '6' }} py={dense ? '3' : { base: '4', md: '6' }}>{children}</Card.Body>
    </Card.Root>
  )
}

/** Label / value line for entity cards. */
export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Flex gap="3" py="1.5" borderBottomWidth="1px" borderColor="border.muted" _last={{ borderBottomWidth: 0 }}>
      <Text color="fg.muted" minW={{ base: '38%', md: '220px' }} fontSize="sm">
        {label}
      </Text>
      <Box flex="1" fontSize="sm" wordBreak="break-word">
        {children}
      </Box>
    </Flex>
  )
}

export function Stat({ label, value, to, tone }: { label: string; value: ReactNode; to?: string; tone?: 'warn' }) {
  const inner = (
    <Box
      p="3"
      borderRadius="l3"
      borderWidth="1px"
      borderColor={tone === 'warn' ? 'orange.700' : 'border'}
      bg="bg.subtle"
      backgroundImage="radial-gradient(12rem 6rem at 0% 0%, var(--g-glow-soft), transparent 70%)"
      _hover={to ? { borderColor: 'ember.600' } : undefined}
      height="100%"
    >
      <Text fontFamily="heading" fontSize="3xl" lineHeight="1.1" fontWeight="semibold" color={tone === 'warn' ? 'orange.300' : 'ember.200'}>
        {value}
      </Text>
      <Text fontSize="xs" color="fg.muted" lineHeight="short">
        {label}
      </Text>
    </Box>
  )
  return to ? <RouterLink to={to}>{inner}</RouterLink> : inner
}

export function IdBadge({ id, to }: { id: string; to?: string }) {
  const b = (
    <Badge variant="subtle" colorPalette="emerald" fontFamily="mono" fontSize="xs">
      {id}
    </Badge>
  )
  return to ? <RouterLink to={to}>{b}</RouterLink> : b
}

// ---------- shared small pieces ----------

/**
 * A date, a time or a date with time. `onChange` gets the field's own text («2026-11-13», «21:00»,
 * «2026-11-13T21:00»), '' when cleared, as a plain input gives it.
 */
export function DateInput({
  kind = 'date',
  value,
  onChange,
  min,
  max,
  w,
  size,
  disabled,
  label,
}: {
  kind?: 'date' | 'time' | 'datetime-local'
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
  w?: BoxProps['w']
  size?: 'xs' | 'sm' | 'md'
  disabled?: boolean
  /** For a field with no visible label. */
  label?: string
}) {
  return <Input type={kind} size={size} w={w} value={value} min={min} max={max} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value)} />
}

/**
 * «Удалить» in a dialog's footer, on the left: asks first, then deletes. `onDelete` does the deleting
 * and closes what has to close.
 */
export function DeleteButton({ confirm, onDelete, label = 'Удалить', size }: { confirm: string; onDelete: () => void; label?: string; size?: 'xs' | 'sm' | 'md' }) {
  return (
    <Button
      variant="ghost"
      colorPalette="red"
      mr="auto"
      size={size}
      onClick={async () => {
        if (await confirmAction(confirm)) onDelete()
      }}
    >
      {label}
    </Button>
  )
}

/**
 * A bordered block on the page: a row in a list, a card of a reading. With `onClick` it is a button
 * that lights up under the pointer; `nested` — it holds buttons of its own, so it stays a block that
 * takes the click.
 */
export function Panel({ onClick, nested, children, ...rest }: { onClick?: () => void; nested?: boolean; children: ReactNode } & Omit<BoxProps, 'onClick'>) {
  const hover = { cursor: 'pointer', _hover: { bg: 'bg.muted' } }
  return (
    <Box
      p="3"
      borderRadius="l2"
      borderWidth="1px"
      borderColor="border"
      bg="bg.subtle"
      {...(onClick ? (nested ? { onClick, ...hover } : { as: 'button' as const, onClick, textAlign: 'left' as const, w: 'full', ...hover }) : {})}
      {...rest}
    >
      {children}
    </Box>
  )
}

/** A thin bar of how much is done, with «2/5» beside it. */
export function ProgressLine({ done, all, h = '4px', bg = 'bg.muted', fill = 'ember.400', fontSize = 'xs' }: { done: number; all: number; h?: string; bg?: string; fill?: string; fontSize?: string }) {
  return (
    <HStack gap="2">
      <Box flex="1" h={h} borderRadius="full" bg={bg} overflow="hidden">
        <Box h="100%" w={`${all ? (done / all) * 100 : 0}%`} bg={fill} borderRadius="full" transition="width .3s" />
      </Box>
      <Text as="span" fontSize={fontSize} color="inherit">
        {done}/{all}
      </Text>
    </HStack>
  )
}

/** A row of emoji to pick one from; the picked one again takes it off. */
export function SigilPicker({ options, value, onChange }: { options: string[]; value?: string; onChange: (v?: string) => void }) {
  return (
    <HStack gap="1" wrap="wrap">
      {options.map((x) => (
        <Box
          as="button"
          key={x}
          aria-pressed={value === x}
          onClick={() => onChange(value === x ? undefined : x)}
          fontSize="xl"
          w="9"
          h="9"
          borderRadius="l2"
          borderWidth="1px"
          borderColor={value === x ? 'ember.500' : 'border'}
          bg={value === x ? 'ember.subtle' : 'transparent'}
        >
          {x}
        </Box>
      ))}
    </HStack>
  )
}

/**
 * A chosen thing (a person, a project, a tag) as a pill: a tap takes it off. `plain` — the children
 * are a pill of their own (a coloured tag), only the button is added.
 */
export function RemovableChip({ children, onRemove, label = 'Убрать', plain }: { children: ReactNode; onRemove: () => void; label?: string; plain?: boolean }) {
  return (
    <Box as="button" onClick={onRemove} cursor="pointer" display="inline-flex" aria-label={label}>
      {plain ? (
        children
      ) : (
        <Badge variant="subtle" colorPalette="ember" borderRadius="full" px="2.5" py="1" fontSize="sm" fontWeight="normal">
          {children}
        </Badge>
      )}
    </Box>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Stack py="10" align="center" gap="3" textAlign="center" color="fg.muted" fontSize="sm">
      <Box color="ember.300" opacity=".6">
        <Crescent size={28} />
      </Box>
      {children}
    </Stack>
  )
}

export function Link({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Box asChild color="emerald.300" _hover={{ textDecoration: 'underline' }}>
      <RouterLink to={to}>{children}</RouterLink>
    </Box>
  )
}

/**
 * Dialog backdrops dim the page in the theme's colour. Chakra's own is blackAlpha, which is mirrored
 * in light themes and would whiten the page instead, so the panel merged with it.
 */
const scrim = { bg: 'var(--g-scrim)', backdropFilter: 'blur(2px)' }

// ---------- confirmations ----------
// The app's own «are you sure» instead of the browser's confirm(): a small dialog in the theme.
// confirmAction resolves true on «yes»; ConfirmHost (mounted once next to the Toaster) shows it.

interface ConfirmAsk {
  message: string
  label: string
  danger: boolean
  resolve: (ok: boolean) => void
}
let confirmAsk: ConfirmAsk | undefined
const confirmListeners = new Set<() => void>()
const confirmEmit = () => confirmListeners.forEach((l) => l())

/** The button's word, taken from the question's first word: «Удалить …?» → «Удалить». */
const confirmVerbs: Record<string, { label: string; danger?: boolean }> = {
  Удалить: { label: 'Удалить', danger: true },
  Стереть: { label: 'Стереть', danger: true },
  Отозвать: { label: 'Отозвать', danger: true },
  Выбросить: { label: 'Выбросить', danger: true },
  Откатить: { label: 'Откатить' },
  Отклеить: { label: 'Отклеить', danger: true },
  Закрыть: { label: 'Закрыть' },
  Вернуть: { label: 'Вернуть' },
}

export function confirmAction(message: string, opts?: { label?: string; danger?: boolean }): Promise<boolean> {
  // A question still open is answered «no» before the next one.
  confirmAsk?.resolve(false)
  const verb = confirmVerbs[message.split(/[\s?]/)[0]]
  return new Promise((resolve) => {
    confirmAsk = {
      message,
      label: opts?.label ?? verb?.label ?? 'Да',
      danger: opts?.danger ?? verb?.danger ?? false,
      resolve: (ok) => {
        confirmAsk = undefined
        confirmEmit()
        resolve(ok)
      },
    }
    confirmEmit()
  })
}

export function ConfirmHost() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const l = () => rerender((n) => n + 1)
    confirmListeners.add(l)
    return () => void confirmListeners.delete(l)
  }, [])
  const ask = confirmAsk
  return (
    <Dialog.Root
      role="alertdialog"
      open={!!ask}
      onOpenChange={(e) => !e.open && ask?.resolve(false)}
      size="xs"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop {...scrim} />
        <Dialog.Positioner px="4">
          <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border.emphasized" borderRadius="2xl">
            <Dialog.Body pt="6" pb="2">
              <Text>{ask?.message}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => ask?.resolve(false)}>
                Отмена
              </Button>
              <Button colorPalette={ask?.danger ? 'red' : undefined} onClick={() => ask?.resolve(true)}>
                {ask?.label}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
