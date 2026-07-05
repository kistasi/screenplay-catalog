'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import type { MovieScreenplay, Screenplay, TmdbResult, TvScreenplay } from '@/lib/types'
import { screenplayKey } from '@/lib/types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Container from '@mui/material/Container'
import Link from '@mui/material/Link'
import Modal from '@mui/material/Modal'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import MuiTab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddScreenplayButton from './add-screenplay-button'
import EditScreenplayModal from './edit-screenplay-modal'
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
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ mb: 4, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Screenplay Catalog
        </Typography>
        <AddScreenplayButton onAdd={addScreenplay} />
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, next: Tab) => switchTab(next)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <MuiTab value="movie" label={`Movies${movies.length > 0 ? ` (${movies.length})` : ''}`} />
        <MuiTab value="tv" label={`Shows${shows.length > 0 ? ` (${shows.length})` : ''}`} />
      </Tabs>

      {!loading && active.length > 0 && (
        <Stack
          direction="row"
          sx={{ mb: 2.5, flexWrap: 'wrap', alignItems: 'center', gap: 2 }}
        >
          <TextField
            size="small"
            type="search"
            value={titleQuery}
            onChange={(e) => setTitleQuery(e.target.value)}
            placeholder="Search title…"
          />
          <FilterSelect label="Year" value={yearFilter} options={years} onChange={setYearFilter} />
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
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setDirectorFilter('')
                setWriterFilter('')
                setYearFilter('')
                setTitleQuery('')
              }}
            >
              Clear filters
            </Button>
          )}
        </Stack>
      )}

      {loading ? (
        <EmptyState>Loading…</EmptyState>
      ) : active.length === 0 ? (
        <EmptyState dashed>
          {tab === 'movie'
            ? 'No movies yet. Click “Add screenplay” to search for a film.'
            : 'No shows yet. Click “Add screenplay” to search for a TV show.'}
        </EmptyState>
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
          directorFilter={directorFilter}
          writerFilter={writerFilter}
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
        <PosterModal screenplay={posterView} onClose={() => setPosterView(null)} />
      )}

      {editingMovie && (
        <EditScreenplayModal
          screenplay={editingMovie}
          onClose={() => setEditingKey(null)}
          onSave={(pdf) => saveMoviePdf(editingMovie, pdf)}
        />
      )}
    </Container>
  )
}

function EmptyState({
  children,
  dashed = false,
}: {
  children: React.ReactNode
  dashed?: boolean
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 5,
        textAlign: 'center',
        borderStyle: dashed ? 'dashed' : 'solid',
        opacity: 0.6,
      }}
    >
      <Typography variant="body2">{children}</Typography>
    </Paper>
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
    return <EmptyState dashed>No movies match the selected filters.</EmptyState>
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>
            <TableCell>Poster</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Year</TableCell>
            <TableCell>Director(s)</TableCell>
            <TableCell>Writer(s)</TableCell>
            <TableCell>Screenplay</TableCell>
            <TableCell>
              <Box component="span" sx={visuallyHidden}>
                Actions
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {movies.map((s) => (
            <TableRow key={screenplayKey(s)} hover>
              <TableCell>
                <PosterButton screenplay={s} width={32} height={48} onView={() => onView(s)} />
              </TableCell>
              <TableCell>
                <Typography sx={{ fontWeight: 500 }}>{s.title}</Typography>
              </TableCell>
              <TableCell>
                {s.year ? (
                  <Link
                    component="button"
                    type="button"
                    underline="hover"
                    onClick={() => onFilterYear(s.year!)}
                    title={`Filter by ${s.year}`}
                  >
                    {s.year}
                  </Link>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                <NameList names={s.directors} onSelect={onFilterDirector} />
              </TableCell>
              <TableCell>
                <NameList names={s.writers} onSelect={onFilterWriter} />
              </TableCell>
              <TableCell>
                {s.pdfName ? (
                  <Link
                    href={`/api/screenplays/${screenplayKey(s)}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    title={s.pdfName}
                  >
                    View PDF
                  </Link>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5}>
                  <Button
                    size="small"
                    startIcon={<EditIcon fontSize="small" />}
                    onClick={() => onEdit(s)}
                    disabled={deletingKey === screenplayKey(s)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon fontSize="small" />}
                    onClick={() => onDelete(s)}
                    disabled={deletingKey === screenplayKey(s)}
                  >
                    {deletingKey === screenplayKey(s) ? 'Deleting…' : 'Delete'}
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
} as const

// One section per show: header (poster/title/credits/delete) followed by
// its full, always-visible list of attached episode PDFs.
function ShowsList({
  shows,
  directorFilter,
  writerFilter,
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
  directorFilter: string
  writerFilter: string
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
    return <EmptyState dashed>No shows match the selected filters.</EmptyState>
  }

  return (
    <Stack spacing={2}>
      {shows.map((s) => (
        <Paper key={screenplayKey(s)} variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <PosterButton screenplay={s} width={48} height={72} onView={() => onView(s)} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500 }}>
                  {s.title}
                  {s.year && (
                    <Link
                      component="button"
                      type="button"
                      underline="hover"
                      onClick={() => onFilterYear(s.year!)}
                      title={`Filter by ${s.year}`}
                      sx={{ ml: 0.5, opacity: 0.5 }}
                    >
                      ({s.year})
                    </Link>
                  )}
                </Typography>
              </Box>
            </Stack>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon fontSize="small" />}
              onClick={() => onDelete(s)}
              disabled={deletingKey === screenplayKey(s)}
              sx={{ flexShrink: 0 }}
            >
              {deletingKey === screenplayKey(s) ? 'Deleting…' : 'Delete show'}
            </Button>
          </Stack>

          <TvEpisodeManager
            screenplay={s}
            directorFilter={directorFilter}
            writerFilter={writerFilter}
            onSaveEpisodePdf={(seasonNumber, episodeNumber, name, directors, writers, pdf) =>
              onSaveEpisodePdf(s, seasonNumber, episodeNumber, name, directors, writers, pdf)
            }
            onRemoveEpisode={(seasonNumber, episodeNumber) =>
              onRemoveEpisode(s, seasonNumber, episodeNumber)
            }
            onFilterDirector={onFilterDirector}
            onFilterWriter={onFilterWriter}
          />
        </Paper>
      ))}
    </Stack>
  )
}

// A poster thumbnail that opens the full-size poster modal when clicked, or
// a plain placeholder when there's no poster to view.
function PosterButton({
  screenplay,
  width,
  height,
  onView,
}: {
  screenplay: { posterUrl: string | null; title: string }
  width: number
  height: number
  onView: () => void
}) {
  if (!screenplay.posterUrl) {
    return <Poster src={null} alt="" width={width} height={height} />
  }
  return (
    <ButtonBase
      onClick={onView}
      aria-label={`View poster for ${screenplay.title}`}
      sx={{ borderRadius: 1, '&:hover': { opacity: 0.8 } }}
    >
      <Poster src={screenplay.posterUrl} alt="" width={width} height={height} />
    </ButtonBase>
  )
}

function PosterModal({ screenplay, onClose }: { screenplay: Screenplay; onClose: () => void }) {
  // Stored posters are the w200 size; request a larger one for the modal.
  const largeUrl = screenplay.posterUrl?.replace('/w200/', '/w780/')
  if (!largeUrl) return null

  return (
    <Modal
      open
      onClose={onClose}
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}
    >
      {/* TMDB w780 posters are 780×1170 (2:3); the style below scales it to fit. */}
      <Image
        src={largeUrl}
        alt={`Poster for ${screenplay.title}`}
        width={780}
        height={1170}
        sizes="(max-width: 768px) 90vw, 780px"
        style={{
          height: 'auto',
          width: 'auto',
          maxHeight: '85vh',
          maxWidth: '90vw',
          borderRadius: 8,
          outline: 'none',
        }}
      />
    </Modal>
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
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={() => onSelect(name)}
            title={`Filter by ${name}`}
          >
            {name}
          </Link>
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
    <Stack component="label" direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" sx={{ opacity: 0.6 }}>
        {label}:
      </Typography>
      <Box
        component="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          font: 'inherit',
          color: 'inherit',
          bgcolor: 'background.default',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          cursor: 'pointer',
        }}
      >
        <option value="">All</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Box>
    </Stack>
  )
}
