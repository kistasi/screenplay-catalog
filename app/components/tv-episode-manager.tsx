'use client'

import { useEffect, useState } from 'react'
import type { Episode, TvEpisodeInfo, TvScreenplay, TvSeason } from '@/lib/types'
import { screenplayKey } from '@/lib/types'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { PdfUploadForm } from './pdf-upload-form'

type Step =
  | { kind: 'list' }
  | { kind: 'pick-season' }
  | { kind: 'pick-episode'; season: TvSeason }
  | {
      kind: 'upload'
      seasonNumber: number
      episodeNumber: number
      name: string
      directors: string[]
      writers: string[]
    }

export function TvEpisodeManager({
  screenplay,
  directorFilter = '',
  writerFilter = '',
  onSaveEpisodePdf,
  onRemoveEpisode,
  onFilterDirector,
  onFilterWriter,
}: {
  screenplay: TvScreenplay
  directorFilter?: string
  writerFilter?: string
  onSaveEpisodePdf: (
    seasonNumber: number,
    episodeNumber: number,
    name: string,
    directors: string[],
    writers: string[],
    pdf: File
  ) => Promise<void>
  onRemoveEpisode: (seasonNumber: number, episodeNumber: number) => Promise<void>
  onFilterDirector: (name: string) => void
  onFilterWriter: (name: string) => void
}) {
  const [step, setStep] = useState<Step>({ kind: 'list' })
  const [removingKey, setRemovingKey] = useState<string | null>(null)

  // Full, sorted episode list — used for lookups (e.g. "is this episode
  // already saved?") that must hold even when the credit filters below hide
  // the episode from the rendered list.
  const allEpisodes = [...screenplay.episodes].sort(
    (a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber
  )
  const episodes = allEpisodes.filter(
    (e) =>
      (!directorFilter || e.directors.includes(directorFilter)) &&
      (!writerFilter || e.writers.includes(writerFilter))
  )

  const remove = async (e: Episode) => {
    if (!confirm(`Remove the PDF for S${e.seasonNumber}E${e.episodeNumber}?`)) return
    const key = `${e.seasonNumber}-${e.episodeNumber}`
    setRemovingKey(key)
    try {
      await onRemoveEpisode(e.seasonNumber, e.episodeNumber)
    } finally {
      setRemovingKey(null)
    }
  }

  if (step.kind === 'pick-season') {
    return (
      <SeasonPicker
        showId={screenplay.id}
        onBack={() => setStep({ kind: 'list' })}
        onSelect={(season) => setStep({ kind: 'pick-episode', season })}
      />
    )
  }

  if (step.kind === 'pick-episode') {
    return (
      <EpisodePicker
        showId={screenplay.id}
        season={step.season}
        onBack={() => setStep({ kind: 'pick-season' })}
        onSelect={(episode) =>
          setStep({
            kind: 'upload',
            seasonNumber: step.season.seasonNumber,
            episodeNumber: episode.episodeNumber,
            name: episode.name,
            directors: episode.directors,
            writers: episode.writers,
          })
        }
      />
    )
  }

  if (step.kind === 'upload') {
    const existing = allEpisodes.find(
      (e) => e.seasonNumber === step.seasonNumber && e.episodeNumber === step.episodeNumber
    )
    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="body2" sx={{ opacity: 0.6 }}>
          S{step.seasonNumber}E{step.episodeNumber} — {step.name}
        </Typography>
        <PdfUploadForm
          label={existing ? 'Replace PDF' : 'Add PDF'}
          cancelLabel="Back"
          submitLabel="Save"
          submittingLabel="Saving…"
          requirePdf
          onCancel={() => setStep({ kind: 'list' })}
          onSubmit={async (pdf) => {
            await onSaveEpisodePdf(
              step.seasonNumber,
              step.episodeNumber,
              step.name,
              step.directors,
              step.writers,
              pdf!
            )
            setStep({ kind: 'list' })
          }}
        />
      </Box>
    )
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      {episodes.length === 0 ? (
        <Typography variant="body2" sx={{ opacity: 0.6 }}>
          {allEpisodes.length === 0
            ? 'No episode PDFs attached yet.'
            : 'No episodes match the selected filters.'}
        </Typography>
      ) : (
        <List
          disablePadding
          sx={{
            maxHeight: '45vh',
            overflowY: 'auto',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            '& > li + li': { borderTop: 1, borderColor: 'divider' },
          }}
        >
          {episodes.map((e) => {
            const key = `${e.seasonNumber}-${e.episodeNumber}`
            return (
              <Stack
                key={key}
                component="li"
                direction="row"
                spacing={1}
                sx={{
                  px: 1.5,
                  py: 1,
                  fontSize: 14,
                  listStyle: 'none',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    S{e.seasonNumber}E{e.episodeNumber} — {e.name}
                  </Typography>
                  {e.directors.length > 0 && (
                    <Typography variant="body2" noWrap sx={{ mt: 0.25, opacity: 0.6 }}>
                      Director(s): <CreditNames names={e.directors} onSelect={onFilterDirector} />
                    </Typography>
                  )}
                  {e.writers.length > 0 && (
                    <Typography variant="body2" sx={{ mt: 0.25, opacity: 0.6 }}>
                      Writer(s): <CreditNames names={e.writers} onSelect={onFilterWriter} />
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                  <Button
                    component="a"
                    href={`/api/screenplays/${screenplayKey(screenplay)}/episodes/${e.seasonNumber}/${e.episodeNumber}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    startIcon={<OpenInNewIcon fontSize="small" />}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    startIcon={<EditIcon fontSize="small" />}
                    onClick={() =>
                      setStep({
                        kind: 'upload',
                        seasonNumber: e.seasonNumber,
                        episodeNumber: e.episodeNumber,
                        name: e.name,
                        directors: e.directors,
                        writers: e.writers,
                      })
                    }
                  >
                    Replace
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon fontSize="small" />}
                    onClick={() => remove(e)}
                    disabled={removingKey === key}
                  >
                    {removingKey === key ? 'Removing…' : 'Remove'}
                  </Button>
                </Stack>
              </Stack>
            )
          })}
        </List>
      )}

      <Button
        variant="outlined"
        size="small"
        startIcon={<AddIcon fontSize="small" />}
        onClick={() => setStep({ kind: 'pick-season' })}
        sx={{ mt: 1.5 }}
      >
        Add episode PDF
      </Button>
    </Box>
  )
}

// Fetch a JSON list from `url`, unwrapping either `{ [key]: T[] }` or
// `{ error: string }`. Shared by SeasonPicker and EpisodePicker below.
function useFetchList<T>(url: string, key: string, errorMessage: string) {
  const [items, setItems] = useState<T[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return
        if (data.error) setError(data.error)
        else setItems(data[key] ?? [])
      })
      .catch(() => {
        if (active) setError(errorMessage)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return { items, error }
}

function SeasonPicker({
  showId,
  onBack,
  onSelect,
}: {
  showId: number
  onBack: () => void
  onSelect: (season: TvSeason) => void
}) {
  const { items: seasons, error } = useFetchList<TvSeason>(
    `/api/tmdb/tv/${showId}/seasons`,
    'seasons',
    'Failed to load seasons.'
  )

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="body2" sx={{ opacity: 0.6 }}>
        Pick a season.
      </Typography>
      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
      {!error && !seasons && (
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.6 }}>
          Loading…
        </Typography>
      )}
      {seasons && (
        <List
          disablePadding
          sx={{
            mt: 1,
            maxHeight: '45vh',
            overflowY: 'auto',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            '& > .MuiListItemButton-root + .MuiListItemButton-root': {
              borderTop: 1,
              borderColor: 'divider',
            },
          }}
        >
          {seasons.map((s) => (
            <ListItemButton key={s.seasonNumber} onClick={() => onSelect(s)}>
              <ListItemText primary={`${s.name} (${s.episodeCount} episodes)`} />
            </ListItemButton>
          ))}
        </List>
      )}
      <Stack direction="row" sx={{ mt: 1.5, justifyContent: 'flex-end' }}>
        <Button variant="text" onClick={onBack}>
          Back
        </Button>
      </Stack>
    </Box>
  )
}

function EpisodePicker({
  showId,
  season,
  onBack,
  onSelect,
}: {
  showId: number
  season: TvSeason
  onBack: () => void
  onSelect: (episode: TvEpisodeInfo) => void
}) {
  const { items: episodes, error } = useFetchList<TvEpisodeInfo>(
    `/api/tmdb/tv/${showId}/season/${season.seasonNumber}`,
    'episodes',
    'Failed to load episodes.'
  )

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="body2" sx={{ opacity: 0.6 }}>
        Pick an episode from {season.name}.
      </Typography>
      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
      {!error && !episodes && (
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.6 }}>
          Loading…
        </Typography>
      )}
      {episodes && (
        <List
          disablePadding
          sx={{
            mt: 1,
            maxHeight: '45vh',
            overflowY: 'auto',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            '& > .MuiListItemButton-root + .MuiListItemButton-root': {
              borderTop: 1,
              borderColor: 'divider',
            },
          }}
        >
          {episodes.map((e) => (
            <ListItemButton key={e.episodeNumber} onClick={() => onSelect(e)}>
              <ListItemText primary={`E${e.episodeNumber} — ${e.name}`} />
            </ListItemButton>
          ))}
        </List>
      )}
      <Stack direction="row" sx={{ mt: 1.5, justifyContent: 'flex-end' }}>
        <Button variant="text" onClick={onBack}>
          Back
        </Button>
      </Stack>
    </Box>
  )
}

// Render episode credit names as buttons that apply the matching filter.
function CreditNames({
  names,
  onSelect,
}: {
  names: string[]
  onSelect: (name: string) => void
}) {
  return (
    <>
      {names.map((name, i) => (
        <span key={name}>
          {i > 0 && ', '}
          <Link component="button" type="button" underline="hover" onClick={() => onSelect(name)}>
            {name}
          </Link>
        </span>
      ))}
    </>
  )
}
