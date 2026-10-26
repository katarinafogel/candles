// A project as an old leather book, drawn in code: a worn dark cover, torn page edges, a cord wound
// round it with a crystal pendant, and an embossed sigil (a blade of grass until one is chosen).
// The crystal fills with light as the deeds get done and glows whole at 100%; on pause it is dim.
import { Box, Text } from '@chakra-ui/react'
import { useId } from 'react'
import type { Project } from '../../grimoire/types'

/** Leather and crystal pairs a book may wear (project.color keeps the id). */
export const bookColors = [
  { id: 'oak', label: 'дуб', leather: '#4b3322', crystal: '#b6eec6' },
  { id: 'wine', label: 'вино', leather: '#4e1e24', crystal: '#f3c1d0' },
  { id: 'night', label: 'ночь', leather: '#1f2a3d', crystal: '#c7dcf7' },
  { id: 'moss', label: 'мох', leather: '#343a22', crystal: '#e7d98e' },
  { id: 'raven', label: 'ворон', leather: '#262224', crystal: '#d4bdf2' },
  { id: 'fox', label: 'лиса', leather: '#5b3218', crystal: '#f6d48a' },
] as const

export const bookColor = (p: Pick<Project, 'color'>) => bookColors.find((c) => c.id === p.color) ?? bookColors[0]

/** The embossed blade of grass from the reference cover. */
function Grass({ color }: { color: string }) {
  return (
    <svg width="34" height="54" viewBox="0 0 34 54" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
      <path d="M17 52C17 36 16 22 12 4" />
      <path d="M16.6 40c-3-2-6-6-7-11M16.3 30c-2.4-1.6-4.4-4.6-5-8M15.8 21c-1.6-1.2-2.8-3-3.2-5.4" />
      <path d="M16.8 44c3-2.2 6-6.4 7.4-11.6M16.6 34c2.6-1.8 4.8-5 5.6-8.6M16.2 25c1.8-1.4 3.2-3.4 3.8-6" />
    </svg>
  )
}

export function BookCover({ project, progress, tied = true }: { project: Project; progress: number; tied?: boolean }) {
  const c = bookColor(project)
  const clip = useId().replace(/:/g, '')
  const paused = project.status === 'paused'
  const full = progress >= 1 || project.status === 'done'
  const lit = full ? 1 : Math.max(0, Math.min(1, progress))
  const emboss = `color-mix(in srgb, ${c.leather} 35%, #e8cf9c)`
  return (
    <Box position="relative" w="100%" aspectRatio="3 / 4" userSelect="none">
      {/* Torn page edges peeking out on the right and at the bottom. */}
      <Box position="absolute" top="3%" right="-1.5%" bottom="2%" w="10%" bg="linear-gradient(90deg, #d9c7a2, #efe2c4 40%, #cdb88f)" borderRadius="2px" clipPath="polygon(0 0, 70% 1%, 100% 4%, 82% 9%, 100% 15%, 86% 22%, 100% 30%, 80% 37%, 98% 46%, 84% 55%, 100% 63%, 82% 71%, 98% 80%, 86% 88%, 100% 96%, 70% 100%, 0 100%)" />
      <Box position="absolute" left="6%" right="4%" bottom="-1.2%" h="5%" bg="linear-gradient(180deg, #e6d6b4, #c9b289)" clipPath="polygon(0 0, 100% 0, 98% 70%, 92% 100%, 84% 60%, 74% 100%, 63% 55%, 52% 100%, 40% 62%, 30% 100%, 19% 58%, 8% 100%, 0 70%)" />

      {/* The cover: worn leather with scuffs and a darker spine. */}
      <Box
        position="absolute"
        inset="0 3% 2% 0"
        borderRadius="4px 8px 8px 4px"
        background={`radial-gradient(60% 40% at 30% 20%, color-mix(in srgb, ${c.leather} 70%, #fff 12%), transparent 70%), radial-gradient(30% 22% at 78% 72%, rgba(0,0,0,.35), transparent 70%), radial-gradient(18% 14% at 22% 82%, rgba(255,255,255,.06), transparent 70%), linear-gradient(160deg, color-mix(in srgb, ${c.leather} 85%, #fff 8%) 0%, ${c.leather} 45%, color-mix(in srgb, ${c.leather} 70%, #000) 100%)`}
        boxShadow="0 14px 30px -16px rgba(0,0,0,.9), inset 0 0 0 1px rgba(255,255,255,.05), inset -6px 0 14px -8px rgba(0,0,0,.6)"
        overflow="hidden"
      >
        <Box position="absolute" top="0" bottom="0" left="0" w="11%" bg="linear-gradient(90deg, rgba(0,0,0,.45), rgba(0,0,0,.15) 70%, rgba(255,255,255,.05))" />
        <Box position="absolute" top="3%" bottom="3%" left="9%" borderLeftWidth="1px" borderStyle="dashed" borderColor="rgba(232,207,156,.25)" />
        {/* A tooled frame. */}
        <Box position="absolute" inset="6% 7% 6% 16%" borderWidth="1px" borderColor="rgba(232,207,156,.22)" borderRadius="3px" />

        {/* Embossed sigil and title. */}
        <Box position="absolute" left="16%" right="7%" top="13%" display="flex" flexDirection="column" alignItems="center" gap="2" textAlign="center">
          <Box filter="drop-shadow(0 1px 0 rgba(255,255,255,.12)) drop-shadow(0 -1px 0 rgba(0,0,0,.5))" lineHeight="1" fontSize={{ base: '28px', md: '34px' }} opacity=".9">
            {project.sigil ? <span style={{ filter: 'sepia(.7) saturate(.6) brightness(.95)' }}>{project.sigil}</span> : <Grass color={emboss} />}
          </Box>
          <Text fontFamily="heading" fontWeight="semibold" fontSize={{ base: 'md', md: 'lg' }} lineHeight="1.15" color={emboss} textShadow="0 1px 0 rgba(255,255,255,.1), 0 -1px 0 rgba(0,0,0,.55)" lineClamp={3} wordBreak="break-word" px="1">
            {project.title}
          </Text>
        </Box>
      </Box>

      {/* The cord wound round the cover and the crystal hanging from it. */}
      <Box position="absolute" inset="0 3% 2% 0" pointerEvents="none" opacity={tied ? 1 : 0} transform={tied ? undefined : 'translateY(8%)'} transition="opacity .35s, transform .35s">
        <svg width="100%" height="100%" viewBox="0 0 100 133" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
          <g fill="none" stroke="#c9b48a" strokeWidth="1.1" strokeLinecap="round" vectorEffect="non-scaling-stroke">
            <path d="M0 80C30 77 60 83 100 79" />
            <path d="M0 84C30 82 62 87 100 83" strokeOpacity=".75" />
            <path d="M72 81c-2 6-3 11-2 16" />
          </g>
        </svg>
        <Box position="absolute" left="64%" top="71%" w="16%">
          <svg viewBox="0 0 30 46" width="100%" aria-hidden="true" style={{ overflow: 'visible' }}>
            <defs>
              <clipPath id={clip}>
                <rect x="0" y={8 + 36 * (1 - lit)} width="30" height="40" />
              </clipPath>
            </defs>
            <path d="M15 2c-1.2 2-1.6 4-1.4 6" fill="none" stroke="#c9b48a" strokeWidth="1" />
            <circle cx="15" cy="8.5" r="1.6" fill="none" stroke="#c9b48a" strokeWidth="1" />
            {/* The crystal: dull glass, its lit part, then facets on top. */}
            <path d="M15 10l8 9-3 22-5 4-5-4-3-22z" fill={c.crystal} fillOpacity={paused ? 0.12 : 0.22} stroke={c.crystal} strokeOpacity={paused ? 0.35 : 0.8} strokeWidth=".9" />
            <path d="M15 10l8 9-3 22-5 4-5-4-3-22z" fill={c.crystal} fillOpacity={paused ? 0.25 : 0.9} clipPath={`url(#${clip})`} style={full && !paused ? { filter: `drop-shadow(0 0 5px ${c.crystal})` } : undefined} />
            <path d="M7 19h16M15 10v35M10 41l5-22 5 22" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth=".6" />
          </svg>
        </Box>
      </Box>
    </Box>
  )
}
