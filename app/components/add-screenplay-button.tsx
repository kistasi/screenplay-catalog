'use client'

import { useEffect, useRef, useState } from 'react'
import type { TmdbMovie } from '@/lib/types'

export default function AddScreenplayButton({
  onAdd,
}: {
  // Resolves once the screenplay is persisted; rejects on failure.
  onAdd: (movie: TmdbMovie) => Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
      >
        + Add screenplay
      </button>

      {open && (
        <SearchModal
          onClose={() => setOpen(false)}
          onSelect={async (movie) => {
            await onAdd(movie)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function SearchModal({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (movie: TmdbMovie) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbMovie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input on open and close the modal on Escape.
  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Debounced search against our TMDB proxy. Stale requests are aborted.
  useEffect(() => {
    const trimmed = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!trimmed) {
        setResults([])
        setError(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/tmdb/search?query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Search failed.')
        setResults(data.results)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-background shadow-2xl ring-1 ring-black/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-black/10 p-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a film…"
            className="w-full bg-transparent text-base outline-none placeholder:opacity-50"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md px-2 py-1 text-sm opacity-60 hover:opacity-100"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {loading && (
            <p className="p-4 text-sm opacity-60">Searching…</p>
          )}
          {error && (
            <p className="p-4 text-sm text-red-600">{error}</p>
          )}
          {!loading && !error && query.trim() && results.length === 0 && (
            <p className="p-4 text-sm opacity-60">No films found.</p>
          )}

          <ul>
            {results.map((movie) => (
              <li key={movie.id}>
                <button
                  type="button"
                  disabled={addingId !== null}
                  onClick={async () => {
                    setAddingId(movie.id)
                    setError(null)
                    try {
                      await onSelect(movie)
                    } catch (err) {
                      setError((err as Error).message)
                      setAddingId(null)
                    }
                  }}
                  className="flex w-full cursor-pointer items-start gap-3 p-3 text-left transition-colors hover:bg-black/5 disabled:cursor-default disabled:opacity-50"
                >
                  {movie.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={movie.posterUrl}
                      alt=""
                      className="h-[72px] w-12 shrink-0 rounded object-cover bg-black/10"
                    />
                  ) : (
                    <div className="flex h-[72px] w-12 shrink-0 items-center justify-center rounded bg-black/10 text-xs opacity-40">
                      N/A
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">
                      {movie.title}
                      {movie.year && (
                        <span className="opacity-50"> ({movie.year})</span>
                      )}
                      {addingId === movie.id && (
                        <span className="opacity-50"> · Adding…</span>
                      )}
                    </p>
                    {movie.overview && (
                      <p className="mt-0.5 line-clamp-2 text-sm opacity-60">
                        {movie.overview}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
