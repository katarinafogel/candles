import { Box, Button, HStack, Image, Stack, Text } from '@chakra-ui/react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { LuCopy, LuDownload } from 'react-icons/lu'
import { candleLink } from '../lib/config'
import { saveFile } from '../lib/download'
import { useAppSelector, useData } from '../store'
import { notify } from './ui'

export const qrDataUrl = (text: string, width = 512) =>
  QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width, color: { dark: '#000000', light: '#ffffff' } })

export function QrBlock({ candleId }: { candleId: string }) {
  const d = useData()
  const slug = useAppSelector((s) => s.local.profile?.slug ?? '')
  const link = candleLink(slug, candleId, d.settings)
  const [src, setSrc] = useState('')
  useEffect(() => {
    qrDataUrl(link).then(setSrc)
  }, [link])

  return (
    <Stack align="center" gap="3">
      {src && <Image src={src} alt={`QR ${candleId}`} w="220px" h="220px" borderRadius="l2" />}
      <Text fontFamily="mono" fontSize="xs" color="fg.muted" wordBreak="break-all" textAlign="center">
        {link}
      </Text>
      {/^https?:\/\/(localhost|127\.)/.test(link) && (
        <Text fontSize="xs" color="orange.300" textAlign="center">
          Ссылка ведёт на локальный адрес. Укажите адрес приложения на GitHub Pages в настройках.
        </Text>
      )}
      <HStack wrap="wrap" justify="center">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const blob = await (await fetch(await qrDataUrl(link, 1024))).blob()
            await saveFile(blob, `${candleId}.png`)
          }}
        >
          <LuDownload /> Скачать PNG
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(link)
            notify('Ссылка скопирована')
          }}
        >
          <LuCopy /> Скопировать ссылку
        </Button>
      </HStack>
      <Box />
    </Stack>
  )
}
