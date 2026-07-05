import type { ReactElement } from 'react'
import Image from 'next/image'
import Box from '@mui/material/Box'

/**
 * A movie poster thumbnail, or an "N/A" placeholder when no image is available.
 * `width`/`height` set the thumbnail size in pixels; `placeholderFontSize`
 * controls the placeholder's font size so it fits smaller thumbnails.
 */
export function Poster({
  src,
  alt,
  width,
  height,
  placeholderFontSize = 12,
}: {
  src: string | null
  alt: string
  width: number
  height: number
  placeholderFontSize?: number
}): ReactElement {
  if (!src) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          bgcolor: 'action.hover',
          opacity: 0.4,
          fontSize: placeholderFontSize,
        }}
      >
        N/A
      </Box>
    )
  }
  return (
    <Box
      sx={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Image src={src} alt={alt} fill sizes="96px" style={{ objectFit: 'cover' }} />
    </Box>
  )
}
