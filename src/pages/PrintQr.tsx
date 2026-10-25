import { Box, Button, Flex, HStack, Image, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuPrinter } from 'react-icons/lu'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { qrDataUrl } from '../components/QrBlock'
import { NumInput } from '../components/ui'
import { candleLink } from '../lib/config'
import { useAppSelector, useData } from '../store'

/** A printable sheet of QR codes with the candle id under each. */
export default function PrintQr() {
  const d = useData()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const ids = (sp.get('ids') ?? '').split(',').filter(Boolean)
  const slug = useAppSelector((s) => s.local.profile?.slug ?? '')
  const [sizeCm, setSizeCm] = useState<number | undefined>(2.5)
  const [srcs, setSrcs] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all(ids.map(async (id) => [id, await qrDataUrl(candleLink(slug, id, d.settings), 600)] as const)).then((e) =>
      setSrcs(Object.fromEntries(e)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.get('ids'), d.settings.publicUrl, slug])

  const size = `${sizeCm ?? 2.5}cm`
  return (
    <Box minH="100dvh" bg="white" color="black" p="6">
      <style>{'@media print { .no-print { display: none !important } @page { margin: 10mm } }'}</style>
      <HStack className="no-print" mb="6" gap="3" wrap="wrap" bg="#0b1512" p="3" borderRadius="l3" color="white">
        <Button variant="ghost" colorPalette="gray" color="white" onClick={() => nav(-1)}>
          ← Назад
        </Button>
        <Text fontSize="sm">Размер кода:</Text>
        <Box w="140px">
          <NumInput value={sizeCm} onChange={setSizeCm} suffix="см" size="sm" />
        </Box>
        <Button onClick={() => window.print()}>
          <LuPrinter /> Печать
        </Button>
        <Text fontSize="xs" color="gray.400">
          Кодов: {ids.length}
        </Text>
      </HStack>
      <Flex wrap="wrap" gap="4mm">
        {ids.map((id) => (
          <Box key={id} textAlign="center" style={{ width: size, breakInside: 'avoid' }}>
            {srcs[id] && <Image src={srcs[id]} alt={id} style={{ width: size, height: size }} />}
            <Text fontFamily="mono" fontSize="9pt" lineHeight="1.2" color="black">
              {id}
            </Text>
          </Box>
        ))}
      </Flex>
    </Box>
  )
}
