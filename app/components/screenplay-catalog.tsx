'use client'

import { useEffect, useState } from 'react'
import type { Screenplay, TmdbMovie } from '@/lib/types'
import AddScreenplayButton from './add-screenplay-button'

export default function ScreenplayCatalog() {
  const [screenplays, setScreenplays] = useState<Screenplay[]>([])
  const [loading, setLoading] = useState(true)
  const [posterView, setPosterView] = useState<Screenplay | null>(null)

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

  // Persist the selected film, then replace local state with the server's list.
  const addScreenplay = async (movie: TmdbMovie) => {
    const res = await fetch('/api/screenplays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: movie.id }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to add screenplay.')
    setScreenplays(data.screenplays)
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Screenplay Catalog</h1>
        <AddScreenplayButton onAdd={addScreenplay} />
      </header>

      {loading ? (
        <p className="p-10 text-center text-sm opacity-60">Loading…</p>
      ) : screenplays.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 p-10 text-center text-sm opacity-60">
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
              </tr>
            </thead>
            <tbody>
              {screenplays.map((s) => (
                <tr key={s.id} className="hover:bg-foreground/[0.04]">
                  <Td>
                    {s.posterUrl ? (
                      <button
                        type="button"
                        onClick={() => setPosterView(s)}
                        className="cursor-pointer rounded ring-offset-2 ring-offset-background transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                        aria-label={`View poster for ${s.title}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.posterUrl}
                          alt=""
                          className="h-12 w-8 rounded object-cover bg-foreground/10"
                        />
                      </button>
                    ) : (
                      <div className="flex h-12 w-8 items-center justify-center rounded bg-foreground/10 text-[10px] opacity-40">
                        N/A
                      </div>
                    )}
                  </Td>
                  <Td>
                    <span className="font-medium">{s.title}</span>
                  </Td>
                  <Td>{s.year ?? '—'}</Td>
                  <Td>{s.directors.length ? s.directors.join(', ') : '—'}</Td>
                  <Td>{s.writers.length ? s.writers.join(', ') : '—'}</Td>
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Stored posters are the w200 size; request a larger one for the modal.
  const largeUrl = screenplay.posterUrl?.replace('/w200/', '/w500/')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onMouseDown={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={largeUrl}
        alt={`Poster for ${screenplay.title}`}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-auto rounded-lg shadow-2xl"
      />
    </div>
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
