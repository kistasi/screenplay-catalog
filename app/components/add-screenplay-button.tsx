'use client'

import { useEffect, useRef, useState } from 'react'
import type { TmdbMovie } from '@/lib/types'

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

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-background shadow-2xl ring-1 ring-black/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {selected ? (
          <UploadStep
            movie={selected}
            onBack={() => setSelected(null)}
            onConfirm={onConfirm}
          />
        ) : (
          <SearchStep onSelect={setSelected} onClose={onClose} />
        )}
      </div>
    </div>
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
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <>
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
                className="flex w-full cursor-pointer items-start gap-3 p-3 text-left transition-colors hover:bg-black/5"
              >
                <Poster movie={movie} />
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
  const [pdf, setPdf] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await onConfirm(movie, pdf)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <Poster movie={movie} />
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

      <label className="mt-4 block">
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          className="block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background hover:file:opacity-90"
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="cursor-pointer rounded-md px-4 py-2 text-sm opacity-70 hover:opacity-100 disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="cursor-pointer rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add to catalog'}
        </button>
      </div>
    </div>
  )
}

function Poster({ movie }: { movie: TmdbMovie }) {
  if (!movie.posterUrl) {
    return (
      <div className="flex h-[72px] w-12 shrink-0 items-center justify-center rounded bg-black/10 text-xs opacity-40">
        N/A
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={movie.posterUrl}
      alt=""
      className="h-[72px] w-12 shrink-0 rounded object-cover bg-black/10"
    />
  )
}
