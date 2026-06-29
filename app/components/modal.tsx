'use client'

import { useEffect } from 'react'

/** Call `onClose` whenever the Escape key is pressed, for the effect's lifetime. */
export function useEscapeKey(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

/**
 * A dimmed, top-anchored modal backdrop. Clicking the backdrop closes it;
 * clicks inside the panel are ignored. Pass panel styling via `className`.
 */
export function ModalShell({
  onClose,
  className,
  children,
}: {
  onClose: () => void
  className?: string
  children: React.ReactNode
}) {
  useEscapeKey(onClose)
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
      onMouseDown={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-xl bg-neutral-800 shadow-2xl ring-1 ring-foreground/15 ${className ?? ''}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
