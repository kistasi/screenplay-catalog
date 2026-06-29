'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import type { Screenplay, TmdbMovie } from '@/lib/types'
import AddScreenplayButton from './add-screenplay-button'
import EditScreenplayModal from './edit-screenplay-modal'
import { useEscapeKey } from './modal'
import { Poster } from './poster'

export default function ScreenplayCatalog() {
  const [screenplays, setScreenplays] = useState<Screenplay[]>([])
  const [loading, setLoading] = useState(true)
  const [posterView, setPosterView] = useState<Screenplay | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Screenplay | null>(null)
  const [directorFilter, setDirectorFilter] = useState('')
  const [writerFilter, setWriterFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [titleQuery, setTitleQuery] = useState('')

  // Load the persisted catalog on mount.
  useEffect(() => {
    let active = true
    fetch('/api/screenplays')
      .then((res) => res.json())
      .then((data) => {
        if (active) setScreenplays(data.screenplays ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Persist the selected film (with optional PDF), then replace local state.
  const addScreenplay = async (movie: TmdbMovie, pdf: File | null) => {
    const form = new FormData()
    form.append('id', String(movie.id))
    if (pdf) form.append('pdf', pdf)

    const res = await fetch('/api/screenplays', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to add screenplay.')
    setScreenplays(data.screenplays)
  }

  const updatePdf = async (id: number, pdf: File) => {
    const form = new FormData()
    form.append('pdf', pdf)
    const res = await fetch(`/api/screenplays/${id}`, {
      method: 'PATCH',
      body: form,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to update PDF.')
    setScreenplays(data.screenplays)
    setEditing(null)
  }

  const deleteScreenplay = async (s: Screenplay) => {
    if (!confirm(`Remove “${s.title}” from the catalog?`)) return
    setDeletingId(s.id)
    try {
      const res = await fetch(`/api/screenplays/${s.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete.')
      setScreenplays(data.screenplays)
    } finally {
      setDeletingId(null)
    }
  }

  // Distinct, sorted values to populate the filter dropdowns.
  const directors = useMemo(() => uniqueNames(screenplays, 'directors'), [screenplays])
  const writers = useMemo(() => uniqueNames(screenplays, 'writers'), [screenplays])
  const years = useMemo(() => uniqueYears(screenplays), [screenplays])

  const titleNeedle = titleQuery.trim().toLowerCase()
  const filtered = screenplays.filter(
    (s) =>
      (!titleNeedle || s.title.toLowerCase().includes(titleNeedle)) &&
      (!directorFilter || s.directors.includes(directorFilter)) &&
      (!writerFilter || s.writers.includes(writerFilter)) &&
      (!yearFilter || s.year === yearFilter)
  )

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Screenplay Catalog</h1>
        <AddScreenplayButton onAdd={addScreenplay} />
      </header>

      {!loading && screenplays.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={titleQuery}
            onChange={(e) => setTitleQuery(e.target.value)}
            placeholder="Search title…"
            className="rounded-md border border-foreground/30 bg-background px-3 py-1.5 text-sm placeholder:opacity-50"
          />
          <FilterSelect
            label="Year"
            value={yearFilter}
            options={years}
            onChange={setYearFilter}
          />
          <FilterSelect
            label="Director"
            value={directorFilter}
            options={directors}
            onChange={setDirectorFilter}
          />
          <FilterSelect
            label="Writer"
            value={writerFilter}
            options={writers}
            onChange={setWriterFilter}
          />
          {(directorFilter || writerFilter || yearFilter || titleQuery) && (
            <button
              type="button"
              onClick={() => {
                setDirectorFilter('')
                setWriterFilter('')
                setYearFilter('')
                setTitleQuery('')
              }}
              className="cursor-pointer text-sm opacity-60 underline underline-offset-2 hover:opacity-100"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="p-10 text-center text-sm opacity-60">Loading…</p>
      ) : screenplays.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/20 p-10 text-center text-sm opacity-60">
          No screenplays yet. Click “Add screenplay” to search for a film.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-foreground/30 text-sm">
            <thead>
              <tr className="bg-foreground/5 text-left">
                <Th>Poster</Th>
                <Th>Title</Th>
                <Th>Year</Th>
                <Th>Director(s)</Th>
                <Th>Writer(s)</Th>
                <Th>Screenplay</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="border border-foreground/20 px-4 py-6 text-center text-sm opacity-60"
                  >
                    No screenplays match the selected filters.
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-foreground/[0.04]">
                  <Td>
                    {s.posterUrl ? (
                      <button
                        type="button"
                        onClick={() => setPosterView(s)}
                        className="cursor-pointer rounded ring-offset-2 ring-offset-background transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                        aria-label={`View poster for ${s.title}`}
                      >
                        <Poster src={s.posterUrl} alt="" className="h-12 w-8" />
                      </button>
                    ) : (
                      <Poster
                        src={null}
                        alt=""
                        className="h-12 w-8"
                        placeholderText="text-[10px]"
                      />
                    )}
                  </Td>
                  <Td>
                    <span className="font-medium">{s.title}</span>
                  </Td>
                  <Td>
                    {s.year ? (
                      <button
                        type="button"
                        onClick={() => setYearFilter(s.year!)}
                        className="cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid"
                        title={`Filter by ${s.year}`}
                      >
                        {s.year}
                      </button>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <NameList names={s.directors} onSelect={setDirectorFilter} />
                  </Td>
                  <Td>
                    <NameList names={s.writers} onSelect={setWriterFilter} />
                  </Td>
                  <Td>
                    {s.pdfName ? (
                      <a
                        href={`/api/screenplays/${s.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline underline-offset-2 hover:opacity-80"
                        title={s.pdfName}
                      >
                        View PDF
                      </a>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        disabled={deletingId === s.id}
                        className="cursor-pointer rounded-md px-2 py-1 text-sm hover:bg-foreground/10 disabled:cursor-default disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteScreenplay(s)}
                        disabled={deletingId === s.id}
                        className="cursor-pointer rounded-md px-2 py-1 text-sm text-red-400 hover:bg-red-400/10 disabled:cursor-default disabled:opacity-50"
                      >
                        {deletingId === s.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {posterView?.posterUrl && (
        <PosterModal
          screenplay={posterView}
          onClose={() => setPosterView(null)}
        />
      )}

      {editing && (
        <EditScreenplayModal
          screenplay={editing}
          onClose={() => setEditing(null)}
          onSave={(pdf) => updatePdf(editing.id, pdf)}
        />
      )}
    </div>
  )
}

function PosterModal({
  screenplay,
  onClose,
}: {
  screenplay: Screenplay
  onClose: () => void
}) {
  useEscapeKey(onClose)

  // Stored posters are the w200 size; request a larger one for the modal.
  const largeUrl = screenplay.posterUrl?.replace('/w200/', '/w780/')
  if (!largeUrl) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onMouseDown={onClose}
    >
      {/* TMDB w780 posters are 780×1170 (2:3); the className scales it to fit. */}
      <Image
        src={largeUrl}
        alt={`Poster for ${screenplay.title}`}
        width={780}
        height={1170}
        sizes="(max-width: 768px) 90vw, 780px"
        onMouseDown={(e) => e.stopPropagation()}
        className="h-auto w-auto max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl"
      />
    </div>
  )
}

// Collect the distinct, alphabetically sorted names across a credit field.
function uniqueNames(
  screenplays: Screenplay[],
  field: 'directors' | 'writers'
): string[] {
  const names = new Set<string>()
  for (const s of screenplays) {
    for (const name of s[field]) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

// Collect the distinct years present, most recent first.
function uniqueYears(screenplays: Screenplay[]): string[] {
  const years = new Set<string>()
  for (const s of screenplays) {
    if (s.year) years.add(s.year)
  }
  return [...years].sort((a, b) => Number(b) - Number(a))
}

// Render credit names as buttons that apply the matching filter on click.
function NameList({
  names,
  onSelect,
}: {
  names: string[]
  onSelect: (name: string) => void
}) {
  if (names.length === 0) return <>—</>
  return (
    <>
      {names.map((name, i) => (
        <span key={name}>
          {i > 0 && ', '}
          <button
            type="button"
            onClick={() => onSelect(name)}
            className="cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid"
            title={`Filter by ${name}`}
          >
            {name}
          </button>
        </span>
      ))}
    </>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="opacity-60">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-md border border-foreground/30 bg-background px-2 py-1.5 text-sm"
      >
        <option value="">All</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border border-foreground/30 px-4 py-2.5 font-semibold">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border border-foreground/20 px-4 py-2.5 align-middle">
      {children}
    </td>
  )
}
