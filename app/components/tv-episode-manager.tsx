'use client'

import { useEffect, useState } from 'react'
import type { Episode, TvEpisodeInfo, TvScreenplay, TvSeason } from '@/lib/types'
import { screenplayKey } from '@/lib/types'
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
      <div className="mt-3">
        <p className="text-sm opacity-60">
          S{step.seasonNumber}E{step.episodeNumber} — {step.name}
        </p>
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
      </div>
    )
  }

  return (
    <div className="mt-3">
      {episodes.length === 0 ? (
        <p className="text-sm opacity-60">
          {allEpisodes.length === 0
            ? 'No episode PDFs attached yet.'
            : 'No episodes match the selected filters.'}
        </p>
      ) : (
        <ul className="max-h-[45vh] divide-y divide-white/10 overflow-y-auto rounded-md border border-white/10">
          {episodes.map((e) => {
            const key = `${e.seasonNumber}-${e.episodeNumber}`
            return (
              <li
                key={key}
                className="flex items-start justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate">
                    S{e.seasonNumber}E{e.episodeNumber} — {e.name}
                  </p>
                  {e.directors.length > 0 && (
                    <p className="mt-0.5 truncate text-sm opacity-60">
                      Director(s): <CreditNames names={e.directors} onSelect={onFilterDirector} />
                    </p>
                  )}
                  {e.writers.length > 0 && (
                    <p className="mt-0.5 text-sm opacity-60">
                      Writer(s): <CreditNames names={e.writers} onSelect={onFilterWriter} />
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <a
                    href={`/api/screenplays/${screenplayKey(screenplay)}/episodes/${e.seasonNumber}/${e.episodeNumber}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md px-2 py-1 text-blue-400 underline underline-offset-2 hover:opacity-80"
                  >
                    View
                  </a>
                  <button
                    type="button"
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
                    className="cursor-pointer rounded-md px-2 py-1 hover:bg-foreground/10"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(e)}
                    disabled={removingKey === key}
                    className="cursor-pointer rounded-md px-2 py-1 text-red-400 hover:bg-red-400/10 disabled:cursor-default disabled:opacity-50"
                  >
                    {removingKey === key ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setStep({ kind: 'pick-season' })}
        className="mt-3 cursor-pointer rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5"
      >
        + Add episode PDF
      </button>
    </div>
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
    <div className="mt-3">
      <p className="text-sm opacity-60">Pick a season.</p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {!error && !seasons && <p className="mt-2 text-sm opacity-60">Loading…</p>}
      {seasons && (
        <ul className="mt-2 max-h-[45vh] divide-y divide-white/10 overflow-y-auto rounded-md border border-white/10">
          {seasons.map((s) => (
            <li key={s.seasonNumber}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                {s.name} ({s.episodeCount} episodes)
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer rounded-md px-4 py-2 text-sm opacity-70 hover:opacity-100"
        >
          Back
        </button>
      </div>
    </div>
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
    <div className="mt-3">
      <p className="text-sm opacity-60">Pick an episode from {season.name}.</p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {!error && !episodes && <p className="mt-2 text-sm opacity-60">Loading…</p>}
      {episodes && (
        <ul className="mt-2 max-h-[45vh] divide-y divide-white/10 overflow-y-auto rounded-md border border-white/10">
          {episodes.map((e) => (
            <li key={e.episodeNumber}>
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                E{e.episodeNumber} — {e.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer rounded-md px-4 py-2 text-sm opacity-70 hover:opacity-100"
        >
          Back
        </button>
      </div>
    </div>
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
          <button
            type="button"
            onClick={() => onSelect(name)}
            className="cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            {name}
          </button>
        </span>
      ))}
    </>
  )
}
