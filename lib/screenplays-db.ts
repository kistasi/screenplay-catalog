import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Episode, MediaType, MovieScreenplay, Screenplay, TvScreenplay } from './types'

// JSON file database. Lives at <project root>/data/screenplays.json.
const DB_PATH = path.join(process.cwd(), 'data', 'screenplays.json')

async function readAll(): Promise<Screenplay[]> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Array<Partial<Screenplay> & { id: number }>
    // Records saved before TV show support don't carry a mediaType, and
    // records saved before per-episode PDFs don't carry an episodes list;
    // normalize both so every record matches the current shape.
    return parsed.map((s) => {
      const mediaType = s.mediaType ?? 'movie'
      if (mediaType === 'tv') {
        const episodes = (s as Partial<TvScreenplay>).episodes ?? []
        // Episodes saved before per-episode credits don't carry directors/writers.
        return {
          ...s,
          mediaType,
          episodes: episodes.map((e) => ({
            ...e,
            directors: e.directors ?? [],
            writers: e.writers ?? [],
          })),
        } as TvScreenplay
      }
      return { ...s, mediaType, pdfName: (s as Partial<MovieScreenplay>).pdfName ?? null } as MovieScreenplay
    })
  } catch (err) {
    // A missing file just means an empty database.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

async function writeAll(screenplays: Screenplay[]): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
  await fs.writeFile(DB_PATH, JSON.stringify(screenplays, null, 2) + '\n', 'utf8')
}

// TMDB ids are only unique within a media type, so identity is the pair.
function isMatch(s: Screenplay, mediaType: MediaType, id: number): boolean {
  return s.mediaType === mediaType && s.id === id
}

/** Return every stored screenplay (most recently added first). */
export async function getScreenplays(): Promise<Screenplay[]> {
  return readAll()
}

/** Look up a single screenplay by its media type and TMDB id. */
export async function findScreenplay(
  mediaType: MediaType,
  id: number
): Promise<Screenplay | undefined> {
  return (await readAll()).find((s) => isMatch(s, mediaType, id))
}

/**
 * Persist a screenplay, ignoring duplicates (same media type and TMDB id).
 * Returns the full, updated list.
 */
export async function addScreenplay(screenplay: Screenplay): Promise<Screenplay[]> {
  const existing = await readAll()
  if (existing.some((s) => isMatch(s, screenplay.mediaType, screenplay.id))) {
    return existing
  }
  const updated = [screenplay, ...existing]
  await writeAll(updated)
  return updated
}

/**
 * Apply partial changes to a screenplay by media type and id. Returns the
 * full, updated list, or null if no matching screenplay exists.
 */
export async function updateScreenplay(
  mediaType: MediaType,
  id: number,
  changes: Partial<Screenplay>
): Promise<Screenplay[] | null> {
  const existing = await readAll()
  const index = existing.findIndex((s) => isMatch(s, mediaType, id))
  if (index === -1) return null

  const updated = [...existing]
  updated[index] = { ...updated[index], ...changes, id, mediaType } as Screenplay
  await writeAll(updated)
  return updated
}

/** Remove a screenplay by media type and id. Returns the full, updated list. */
export async function removeScreenplay(
  mediaType: MediaType,
  id: number
): Promise<Screenplay[]> {
  const existing = await readAll()
  const updated = existing.filter((s) => !isMatch(s, mediaType, id))
  if (updated.length !== existing.length) {
    await writeAll(updated)
  }
  return updated
}

/**
 * Add or replace a single episode's attached PDF on a TV show (matched by
 * season + episode number). Returns null if no matching TV show exists.
 */
export async function upsertEpisode(
  id: number,
  episode: Episode
): Promise<Screenplay[] | null> {
  const existing = await readAll()
  const index = existing.findIndex((s) => s.mediaType === 'tv' && s.id === id)
  if (index === -1) return null

  const show = existing[index] as TvScreenplay
  const episodes = [
    ...show.episodes.filter(
      (e) => !(e.seasonNumber === episode.seasonNumber && e.episodeNumber === episode.episodeNumber)
    ),
    episode,
  ].sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)

  const updated = [...existing]
  updated[index] = { ...show, episodes }
  await writeAll(updated)
  return updated
}

/**
 * Remove a single episode's attached PDF from a TV show. Returns the full,
 * updated list along with the removed episode (so its PDF file can be
 * deleted), or `removed: null` if no such episode was attached.
 */
export async function removeEpisode(
  id: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<{ screenplays: Screenplay[]; removed: Episode | null }> {
  const existing = await readAll()
  const index = existing.findIndex((s) => s.mediaType === 'tv' && s.id === id)
  if (index === -1) return { screenplays: existing, removed: null }

  const show = existing[index] as TvScreenplay
  const removed =
    show.episodes.find(
      (e) => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber
    ) ?? null
  const episodes = show.episodes.filter(
    (e) => !(e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber)
  )

  const updated = [...existing]
  updated[index] = { ...show, episodes }
  await writeAll(updated)
  return { screenplays: updated, removed }
}
