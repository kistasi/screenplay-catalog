'use client'

import { useEffect, useRef, useState } from 'react'
import type { TmdbResult } from '@/lib/types'
import { ModalShell } from './modal'
import { PdfUploadForm } from './pdf-upload-form'
import { Poster } from './poster'

export default function AddScreenplayButton({
  onAdd,
}: {
  // Resolves once the screenplay is persisted; rejects on failure.
  onAdd: (result: TmdbResult, pdf: File | null) => Promise<void>
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
  onConfirm: (result: TmdbResult, pdf: File | null) => Promise<void>
}) {
  // The title picked in step one; null while still searching.
  const [selected, setSelected] = useState<TmdbResult | null>(null)

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
  onSelect: (result: TmdbResult) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbResult[]>([])
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
          placeholder="Search for a film or TV show…"
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
          <p className="p-4 text-sm opacity-60">No results found.</p>
        )}

        <ul>
          {results.map((result) => (
            <li key={`${result.mediaType}-${result.id}`}>
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="flex w-full cursor-pointer items-start gap-3 p-3 text-left transition-colors hover:bg-white/5"
              >
                <Poster
                  src={result.posterUrl}
                  alt=""
                  className="h-[72px] w-12 shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-medium">
                    {result.title}
                    {result.year && (
                      <span className="opacity-50"> ({result.year})</span>
                    )}
                    <MediaTypeBadge mediaType={result.mediaType} />
                  </p>
                  {result.overview && (
                    <p className="mt-0.5 line-clamp-2 text-sm opacity-60">
                      {result.overview}
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
  movie: TmdbResult
  onBack: () => void
  onConfirm: (result: TmdbResult, pdf: File | null) => Promise<void>
}) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <Poster src={movie.posterUrl} alt="" className="h-[72px] w-12 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">
            {movie.title}
            {movie.year && <span className="opacity-50"> ({movie.year})</span>}
            <MediaTypeBadge mediaType={movie.mediaType} />
          </p>
          <p className="mt-0.5 text-sm opacity-60">
            {movie.mediaType === 'tv'
              ? 'You can attach episode PDFs after adding the show.'
              : 'Attach the screenplay PDF (optional).'}
          </p>
        </div>
      </div>

      {movie.mediaType === 'tv' ? (
        <ConfirmAddStep movie={movie} onBack={onBack} onConfirm={onConfirm} />
      ) : (
        <PdfUploadForm
          cancelLabel="Back"
          submitLabel="Add to catalog"
          submittingLabel="Adding…"
          requirePdf={false}
          onCancel={onBack}
          onSubmit={(pdf) => onConfirm(movie, pdf)}
        />
      )}
    </div>
  )
}

function ConfirmAddStep({
  movie,
  onBack,
  onConfirm,
}: {
  movie: TmdbResult
  onBack: () => void
  onConfirm: (result: TmdbResult, pdf: File | null) => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mt-4">
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="cursor-pointer rounded-md px-4 py-2 text-sm opacity-70 hover:opacity-100 disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true)
            setError(null)
            try {
              await onConfirm(movie, null)
            } catch (err) {
              setError((err as Error).message)
              setSubmitting(false)
            }
          }}
          className="cursor-pointer rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add to catalog'}
        </button>
      </div>
    </div>
  )
}

function MediaTypeBadge({ mediaType }: { mediaType: TmdbResult['mediaType'] }) {
  return (
    <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 align-middle text-[10px] font-normal uppercase tracking-wide opacity-60">
      {mediaType === 'tv' ? 'TV' : 'Movie'}
    </span>
  )
}
