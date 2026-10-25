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
import { Link as RouterLink } from 'react-router-dom'
import { parseNum } from '../lib/calc'

export const toaster = createToaster({ placement: 'top', pauseOnPageIdle: true })

export function Toaster() {
  return (
    <Portal>
      <CToaster toaster={toaster} insetInline={{ mdDown: '4' }}>
        {(t) => (
          <Toast.Root width={{ md: 'sm' }}>
            {t.type === 'loading' ? <Spinner size="sm" color="emerald.400" /> : <Toast.Indicator />}
            <Stack gap="1" flex="1" maxWidth="100%">
              {t.title && <Toast.Title>{t.title}</Toast.Title>}
              {t.description && <Toast.Description>{t.description}</Toast.Description>}
            </Stack>
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </CToaster>
    </Portal>
  )
}

export const notify = (title: string, type: 'success' | 'error' | 'info' | 'warning' = 'success', description?: string) =>
  toaster.create({ title, type, description, duration: type === 'error' ? 6000 : 3000 })

export function Field({
  label,
  helper,
  children,
  invalid,
  ...rest
}: { label?: ReactNode; helper?: ReactNode; children: ReactNode; invalid?: boolean } & BoxProps) {
  return (
    <CField.Root invalid={invalid} {...(rest as object)}>
      {label && <CField.Label color="fg.muted">{label}</CField.Label>}
      {children}
      {helper && <CField.HelperText>{helper}</CField.HelperText>}
    </CField.Root>
  )
}

/** Number input that accepts "27,3" and keeps the typed text while editing. */
export function NumInput({
  value,
  onChange,
  placeholder,
  suffix,
  size = 'md',
  width,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  suffix?: string
  size?: 'sm' | 'md'
  width?: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','))
  useEffect(() => {
    if (parseNum(text) !== value) setText(value == null ? '' : String(value).replace('.', ','))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <HStack gap="2" width={width}>
      <Input
        size={size}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseNum(e.target.value))
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
    <Checkbox.Root checked={checked} onCheckedChange={(e) => onChange(!!e.checked)} colorPalette="emerald">
      <Checkbox.HiddenInput />
      <Checkbox.Control />
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

/** Tap-to-choose options; tapping the chosen one clears it. */
export function Chips<T extends string>({
  value,
  onChange,
  options,
  multi,
}: {
  value: T | T[] | undefined
  onChange: (v: T | T[] | undefined) => void
  options: { value: T; label: string }[]
  multi?: boolean
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
            color={on ? 'emerald.300' : 'fg.subtle'}
            _hover={{ color: 'emerald.200' }}
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
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      size={{ mdDown: 'full', md: size }}
      scrollBehavior="inside"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>{children}</Dialog.Body>
            {footer && <Dialog.Footer>{footer}</Dialog.Footer>}
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

export function PageHeader({ title, children, back }: { title: ReactNode; children?: ReactNode; back?: string }) {
  return (
    <Flex align="center" justify="space-between" gap="3" mb="4" wrap="wrap">
      <HStack gap="3">
        {back && (
          <Button asChild variant="ghost" size="sm" px="2">
            <RouterLink to={back}>←</RouterLink>
          </Button>
        )}
        <Heading size={{ base: 'xl', md: '2xl' }} letterSpacing="-0.01em">
          {title}
        </Heading>
      </HStack>
      {children && <HStack gap="2" wrap="wrap">{children}</HStack>}
    </Flex>
  )
}

export function Section({ title, children, actions }: { title?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <Card.Root variant="outline" bg="bg.subtle" borderColor="border" mb="4">
      {(title || actions) && (
        <Card.Header pb="0">
          <Flex justify="space-between" align="center" gap="2" wrap="wrap">
            {title && <Heading size="md">{title}</Heading>}
            {actions && <HStack gap="2">{actions}</HStack>}
          </Flex>
        </Card.Header>
      )}
      <Card.Body>{children}</Card.Body>
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
      _hover={to ? { borderColor: 'emerald.600' } : undefined}
      height="100%"
    >
      <Text fontSize="2xl" fontWeight="semibold" color={tone === 'warn' ? 'orange.300' : 'emerald.300'}>
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

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Box py="10" textAlign="center" color="fg.muted" fontSize="sm">
      {children}
    </Box>
  )
}

export function Link({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Box asChild color="emerald.300" _hover={{ textDecoration: 'underline' }}>
      <RouterLink to={to}>{children}</RouterLink>
    </Box>
  )
}

export function confirmAction(message: string) {
  return window.confirm(message)
}
