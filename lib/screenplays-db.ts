import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Screenplay } from './types'

// JSON file database. Lives at <project root>/data/screenplays.json.
const DB_PATH = path.join(process.cwd(), 'data', 'screenplays.json')

async function readAll(): Promise<Screenplay[]> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8')
    return JSON.parse(raw) as Screenplay[]
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

/** Return every stored screenplay (most recently added first). */
export async function getScreenplays(): Promise<Screenplay[]> {
  return readAll()
}

/** Look up a single screenplay by its TMDB id. */
export async function findScreenplay(
  id: number
): Promise<Screenplay | undefined> {
  return (await readAll()).find((s) => s.id === id)
}

/**
 * Persist a screenplay, ignoring duplicates (same TMDB id).
 * Returns the full, updated list.
 */
export async function addScreenplay(screenplay: Screenplay): Promise<Screenplay[]> {
  const existing = await readAll()
  if (existing.some((s) => s.id === screenplay.id)) {
    return existing
  }
  const updated = [screenplay, ...existing]
  await writeAll(updated)
  return updated
}

/** Remove a screenplay by id. Returns the full, updated list. */
export async function removeScreenplay(id: number): Promise<Screenplay[]> {
  const existing = await readAll()
  const updated = existing.filter((s) => s.id !== id)
  if (updated.length !== existing.length) {
    await writeAll(updated)
  }
  return updated
}
