// A small bin in a card's top right corner, shown while the pointer is over the card (its parent has
// className="group" and position="relative"). Only where there is a pointer: phones don't hover.
import { IconButton } from '@chakra-ui/react'
import { LuTrash2 } from 'react-icons/lu'

export function HoverTrash({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconButton
      aria-label={label}
      title={label}
      size="2xs"
      variant="ghost"
      color="fg.muted"
      _hover={{ color: 'red.400', bg: 'bg.muted' }}
      position="absolute"
      top="1.5"
      right="1.5"
      zIndex="1"
      opacity="0"
      display="none"
      css={{
        '@media (hover: hover)': { display: 'inline-flex' },
        '.group:hover > &, &:focus-visible': { opacity: 1 },
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <LuTrash2 />
    </IconButton>
  )
}
