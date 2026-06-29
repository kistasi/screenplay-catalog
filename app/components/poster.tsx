import type { ReactElement } from 'react'
import Image from 'next/image'

/**
 * A movie poster thumbnail, or an "N/A" placeholder when no image is available.
 * `className` sets the size (and any layout classes); `placeholderText` controls
 * the placeholder's font size so it fits smaller thumbnails.
 */
export function Poster({
  src,
  alt,
  className,
  placeholderText = 'text-xs',
}: {
  src: string | null
  alt: string
  className: string
  placeholderText?: string
}): ReactElement {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded bg-foreground/10 opacity-40 ${placeholderText} ${className}`}
      >
        N/A
      </div>
    )
  }
  return (
    <div className={`relative overflow-hidden rounded bg-foreground/10 ${className}`}>
      <Image src={src} alt={alt} fill sizes="96px" className="object-cover" />
    </div>
  )
}
