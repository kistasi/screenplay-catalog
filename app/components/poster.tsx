import type { ReactElement } from 'react'

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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`rounded object-cover bg-foreground/10 ${className}`}
    />
  )
}
