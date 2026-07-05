'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import type { MovieScreenplay, Screenplay, TmdbResult, TvScreenplay } from '@/lib/types'
import { screenplayKey } from '@/lib/types'
import AddScreenplayButton from './add-screenplay-button'
import EditScreenplayModal from './edit-screenplay-modal'
import { useEscapeKey } from './modal'
import { Poster } from './poster'
import { TvEpisodeManager } from './tv-episode-manager'

type Tab = 'movie' | 'tv'

export default function ScreenplayCatalog() {
  const [screenplays, setScreenplays] = useState<Screenplay[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('movie')
  const [posterView, setPosterView] = useState<Screenplay | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  // Track the edited movie by key (not the object itself) so the modal stays
  // in sync if the underlying list changes.
  const [editingKey, setEditingKey] = useState<string | null>(null)
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

  // Persist the selected title (with optional PDF), then replace local state
  // and jump to the tab it landed in.
  const addScreenplay = async (result: TmdbResult, pdf: File | null) => {
    const form = new FormData()
    form.append('id', String(result.id))
    form.append('mediaType', result.mediaType)
    if (pdf) form.append('pdf', pdf)

    const res = await fetch('/api/screenplays', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to add screenplay.')
    setScreenplays(data.screenplays)
    setTab(result.mediaType)
  }

  const saveMoviePdf = async (screenplay: MovieScreenplay, pdf: File) => {
    const form = new FormData()
    form.append('pdf', pdf)
    const res = await fetch(`/api/screenplays/${screenplayKey(screenplay)}`, {
      method: 'PATCH',
      body: form,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to update PDF.')
    setScreenplays(data.screenplays)
    setEditingKey(null)
  }

  const saveEpisodePdf = async (
    screenplay: TvScreenplay,
    seasonNumber: number,
    episodeNumber: number,
    name: string,
    directors: string[],
    writers: string[],
    pdf: File
  ) => {
    const form = new FormData()
    form.append('seasonNumber', String(seasonNumber))
    form.append('episodeNumber', String(episodeNumber))
    form.append('name', name)
    for (const d of directors) form.append('directors', d)
    for (const w of writers) form.append('writers', w)
    form.append('pdf', pdf)
    const res = await fetch(`/api/screenplays/${screenplayKey(screenplay)}/episodes`, {
      method: 'POST',
      body: form,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to save episode PDF.')
    setScreenplays(data.screenplays)
  }

  const removeEpisode = async (
    screenplay: TvScreenplay,
    seasonNumber: number,
    episodeNumber: number
  ) => {
    const res = await fetch(
      `/api/screenplays/${screenplayKey(screenplay)}/episodes/${seasonNumber}/${episodeNumber}`,
      { method: 'DELETE' }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to remove episode PDF.')
    setScreenplays(data.screenplays)
  }

  const deleteScreenplay = async (s: Screenplay) => {
    if (!confirm(`Remove “${s.title}” from the catalog?`)) return
    const key = screenplayKey(s)
    setDeletingKey(key)
    try {
      const res = await fetch(`/api/screenplays/${key}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete.')
      setScreenplays(data.screenplays)
    } finally {
      setDeletingKey(null)
    }
  }

  const movies = useMemo(
    () => screenplays.filter((s): s is MovieScreenplay => s.mediaType === 'movie'),
    [screenplays]
  )
  const shows = useMemo(
    () => screenplays.filter((s): s is TvScreenplay => s.mediaType === 'tv'),
    [screenplays]
  )
  const active = tab === 'movie' ? movies : shows

  const editingMovie = editingKey
    ? (movies.find((s) => screenplayKey(s) === editingKey) ?? null)
    : null

  // Distinct, sorted values to populate the filter dropdowns, scoped to the
  // active tab. Shows are filtered by per-episode credits, not the show's own
  // aggregate directors/writers.
  const directors = useMemo(
    () => (tab === 'movie' ? uniqueNames(movies, 'directors') : uniqueEpisodeNames(shows, 'directors')),
    [tab, movies, shows]
  )
  const writers = useMemo(
    () => (tab === 'movie' ? uniqueNames(movies, 'writers') : uniqueEpisodeNames(shows, 'writers')),
    [tab, movies, shows]
  )
  const years = useMemo(() => uniqueYears(active), [active])

  const titleNeedle = titleQuery.trim().toLowerCase()
  const filteredMovies = movies.filter(
    (s) =>
      (!titleNeedle || s.title.toLowerCase().includes(titleNeedle)) &&
      (!directorFilter || s.directors.includes(directorFilter)) &&
      (!writerFilter || s.writers.includes(writerFilter)) &&
      (!yearFilter || s.year === yearFilter)
  )
  const filteredShows = shows.filter(
    (s) =>
      (!titleNeedle || s.title.toLowerCase().includes(titleNeedle)) &&
      (!directorFilter || s.episodes.some((e) => e.directors.includes(directorFilter))) &&
      (!writerFilter || s.episodes.some((e) => e.writers.includes(writerFilter))) &&
      (!yearFilter || s.year === yearFilter)
  )

  // Filters don't carry meaning across tabs, so reset them when switching.
  const switchTab = (next: Tab) => {
    setTab(next)
    setDirectorFilter('')
    setWriterFilter('')
    setYearFilter('')
    setTitleQuery('')
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Screenplay Catalog</h1>
        <AddScreenplayButton onAdd={addScreenplay} />
      </header>

      <div className="mb-6 flex gap-1 border-b border-foreground/20">
        <TabButton active={tab === 'movie'} onClick={() => switchTab('movie')}>
          Movies{movies.length > 0 && ` (${movies.length})`}
        </TabButton>
        <TabButton active={tab === 'tv'} onClick={() => switchTab('tv')}>
          Shows{shows.length > 0 && ` (${shows.length})`}
        </TabButton>
      </div>

      {!loading && active.length > 0 && (
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
      ) : active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/20 p-10 text-center text-sm opacity-60">
          {tab === 'movie'
            ? 'No movies yet. Click “Add screenplay” to search for a film.'
            : 'No shows yet. Click “Add screenplay” to search for a TV show.'}
        </p>
      ) : tab === 'movie' ? (
        <MoviesTable
          movies={filteredMovies}
          deletingKey={deletingKey}
          onView={setPosterView}
          onEdit={(s) => setEditingKey(screenplayKey(s))}
          onDelete={deleteScreenplay}
          onFilterYear={setYearFilter}
          onFilterDirector={setDirectorFilter}
          onFilterWriter={setWriterFilter}
        />
      ) : (
        <ShowsList
          shows={filteredShows}
          deletingKey={deletingKey}
          onView={setPosterView}
          onDelete={deleteScreenplay}
          onSaveEpisodePdf={saveEpisodePdf}
          onRemoveEpisode={removeEpisode}
          onFilterYear={setYearFilter}
          onFilterDirector={setDirectorFilter}
          onFilterWriter={setWriterFilter}
        />
      )}

      {posterView?.posterUrl && (
        <PosterModal
          screenplay={posterView}
          onClose={() => setPosterView(null)}
        />
      )}

      {editingMovie && (
        <EditScreenplayModal
          screenplay={editingMovie}
          onClose={() => setEditingKey(null)}
          onSave={(pdf) => saveMoviePdf(editingMovie, pdf)}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-foreground text-foreground'
          : 'border-transparent opacity-60 hover:opacity-100'
      }`}
    >
      {children}
    </button>
  )
}

function MoviesTable({
  movies,
  deletingKey,
  onView,
  onEdit,
  onDelete,
  onFilterYear,
  onFilterDirector,
  onFilterWriter,
}: {
  movies: MovieScreenplay[]
  deletingKey: string | null
  onView: (s: MovieScreenplay) => void
  onEdit: (s: MovieScreenplay) => void
  onDelete: (s: MovieScreenplay) => void
  onFilterYear: (year: string) => void
  onFilterDirector: (name: string) => void
  onFilterWriter: (name: string) => void
}) {
  if (movies.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-foreground/20 p-10 text-center text-sm opacity-60">
        No movies match the selected filters.
      </p>
    )
  }

  return (
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
          {movies.map((s) => (
            <tr key={screenplayKey(s)} className="hover:bg-foreground/[0.04]">
              <Td>
                <PosterButton
                  screenplay={s}
                  className="h-12 w-8"
                  placeholderText="text-[10px]"
                  onView={() => onView(s)}
                />
              </Td>
              <Td>
                <span className="font-medium">{s.title}</span>
              </Td>
              <Td>
                {s.year ? (
                  <button
                    type="button"
                    onClick={() => onFilterYear(s.year!)}
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
                <NameList names={s.directors} onSelect={onFilterDirector} />
              </Td>
              <Td>
                <NameList names={s.writers} onSelect={onFilterWriter} />
              </Td>
              <Td>
                {s.pdfName ? (
                  <a
                    href={`/api/screenplays/${screenplayKey(s)}/pdf`}
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
                    onClick={() => onEdit(s)}
                    disabled={deletingKey === screenplayKey(s)}
                    className="cursor-pointer rounded-md px-2 py-1 text-sm hover:bg-foreground/10 disabled:cursor-default disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    disabled={deletingKey === screenplayKey(s)}
                    className="cursor-pointer rounded-md px-2 py-1 text-sm text-red-400 hover:bg-red-400/10 disabled:cursor-default disabled:opacity-50"
                  >
                    {deletingKey === screenplayKey(s) ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// One section per show: header (poster/title/credits/delete) followed by
// its full, always-visible list of attached episode PDFs.
function ShowsList({
  shows,
  deletingKey,
  onView,
  onDelete,
  onSaveEpisodePdf,
  onRemoveEpisode,
  onFilterYear,
  onFilterDirector,
  onFilterWriter,
}: {
  shows: TvScreenplay[]
  deletingKey: string | null
  onView: (s: TvScreenplay) => void
  onDelete: (s: TvScreenplay) => void
  onSaveEpisodePdf: (
    screenplay: TvScreenplay,
    seasonNumber: number,
    episodeNumber: number,
    name: string,
    directors: string[],
    writers: string[],
    pdf: File
  ) => Promise<void>
  onRemoveEpisode: (
    screenplay: TvScreenplay,
    seasonNumber: number,
    episodeNumber: number
  ) => Promise<void>
  onFilterYear: (year: string) => void
  onFilterDirector: (name: string) => void
  onFilterWriter: (name: string) => void
}) {
  if (shows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-foreground/20 p-10 text-center text-sm opacity-60">
        No shows match the selected filters.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {shows.map((s) => (
        <div key={screenplayKey(s)} className="rounded-lg border border-foreground/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <PosterButton
                screenplay={s}
                className="h-[72px] w-12 shrink-0"
                onView={() => onView(s)}
              />
              <div className="min-w-0">
                <p className="font-medium">
                  {s.title}
                  {s.year && (
                    <button
                      type="button"
                      onClick={() => onFilterYear(s.year!)}
                      className="ml-1 cursor-pointer opacity-50 underline decoration-dotted underline-offset-2 hover:decoration-solid"
                      title={`Filter by ${s.year}`}
                    >
                      ({s.year})
                    </button>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDelete(s)}
              disabled={deletingKey === screenplayKey(s)}
              className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm text-red-400 hover:bg-red-400/10 disabled:cursor-default disabled:opacity-50"
            >
              {deletingKey === screenplayKey(s) ? 'Deleting…' : 'Delete show'}
            </button>
          </div>

          <TvEpisodeManager
            screenplay={s}
            onSaveEpisodePdf={(seasonNumber, episodeNumber, name, directors, writers, pdf) =>
              onSaveEpisodePdf(s, seasonNumber, episodeNumber, name, directors, writers, pdf)
            }
            onRemoveEpisode={(seasonNumber, episodeNumber) =>
              onRemoveEpisode(s, seasonNumber, episodeNumber)
            }
            onFilterDirector={onFilterDirector}
            onFilterWriter={onFilterWriter}
          />
        </div>
      ))}
    </div>
  )
}

// A poster thumbnail that opens the full-size poster modal when clicked, or
// a plain placeholder when there's no poster to view.
function PosterButton({
  screenplay,
  className,
  placeholderText,
  onView,
}: {
  screenplay: { posterUrl: string | null; title: string }
  className: string
  placeholderText?: string
  onView: () => void
}) {
  if (!screenplay.posterUrl) {
    return (
      <Poster src={null} alt="" className={className} placeholderText={placeholderText} />
    )
  }
  return (
    <button
      type="button"
      onClick={onView}
      className="cursor-pointer rounded ring-offset-2 ring-offset-background transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      aria-label={`View poster for ${screenplay.title}`}
    >
      <Poster src={screenplay.posterUrl} alt="" className={className} />
    </button>
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
// Works for anything with directors/writers arrays: movies or episodes.
function uniqueNames(
  items: Array<{ directors: string[]; writers: string[] }>,
  field: 'directors' | 'writers'
): string[] {
  const names = new Set<string>()
  for (const item of items) {
    for (const name of item[field]) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

// Shows carry no credits of their own — flatten to each show's episodes,
// since that's where directors/writers actually live.
function uniqueEpisodeNames(shows: TvScreenplay[], field: 'directors' | 'writers'): string[] {
  return uniqueNames(
    shows.flatMap((s) => s.episodes),
    field
  )
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
