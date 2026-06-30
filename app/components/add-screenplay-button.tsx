'use client'

import { useEffect, useRef, useState } from 'react'
import type { TmdbMovie } from '@/lib/types'
import { ModalShell } from './modal'
import { PdfUploadForm } from './pdf-upload-form'
import { Poster } from './poster'

export default function AddScreenplayButton({
  onAdd,
}: {
  // Resolves once the screenplay is persisted; rejects on failure.
  onAdd: (movie: TmdbMovie, pdf: File | null) => Promise<void>
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
        <AddModal
          onClose={() => setOpen(false)}
          onConfirm={async (movie, pdf) => {
            await onAdd(movie, pdf)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function AddModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (movie: TmdbMovie, pdf: File | null) => Promise<void>
}) {
  // The film picked in step one; null while still searching.
  const [selected, setSelected] = useState<TmdbMovie | null>(null)

  return (
    <ModalShell onClose={onClose} className="overflow-hidden">
      {selected ? (
        <UploadStep
          movie={selected}
          onBack={() => setSelected(null)}
          onConfirm={onConfirm}
        />
      ) : (
        <SearchStep onSelect={setSelected} onClose={onClose} />
      )}
    </ModalShell>
  )
}

function SearchStep({
  onSelect,
  onClose,
}: {
  onSelect: (movie: TmdbMovie) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbMovie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    }, 1000)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
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
          className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm opacity-60 hover:opacity-100"
        >
          Esc
        </button>
      </div>

      <div className="max-h-[55vh] overflow-y-auto">
        {loading && <p className="p-4 text-sm opacity-60">Searching…</p>}
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!loading && !error && query.trim() && results.length === 0 && (
          <p className="p-4 text-sm opacity-60">No films found.</p>
        )}

        <ul>
          {results.map((movie) => (
            <li key={movie.id}>
              <button
                type="button"
                onClick={() => onSelect(movie)}
                className="flex w-full cursor-pointer items-start gap-3 p-3 text-left transition-colors hover:bg-white/5"
              >
                <Poster
                  src={movie.posterUrl}
                  alt=""
                  className="h-[72px] w-12 shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-medium">
                    {movie.title}
                    {movie.year && (
                      <span className="opacity-50"> ({movie.year})</span>
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
    </>
  )
}

function UploadStep({
  movie,
  onBack,
  onConfirm,
}: {
  movie: TmdbMovie
  onBack: () => void
  onConfirm: (movie: TmdbMovie, pdf: File | null) => Promise<void>
}) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <Poster src={movie.posterUrl} alt="" className="h-[72px] w-12 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">
            {movie.title}
            {movie.year && <span className="opacity-50"> ({movie.year})</span>}
          </p>
          <p className="mt-0.5 text-sm opacity-60">
            Attach the screenplay PDF (optional).
          </p>
        </div>
      </div>

      <PdfUploadForm
        cancelLabel="Back"
        submitLabel="Add to catalog"
        submittingLabel="Adding…"
        requirePdf={false}
        onCancel={onBack}
        onSubmit={(pdf) => onConfirm(movie, pdf)}
      />
    </div>
  )
}
