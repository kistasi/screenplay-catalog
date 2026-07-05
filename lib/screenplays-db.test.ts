import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MovieScreenplay, Screenplay, TvScreenplay } from './types'

// screenplays-db computes its DB path from process.cwd() at import time, so we
// point cwd at a throwaway temp dir and import the module fresh for each test.
let tmpDir: string
let db: typeof import('./screenplays-db')

function makeScreenplay(over: Partial<MovieScreenplay> = {}): MovieScreenplay {
  return {
    id: 1,
    mediaType: 'movie',
    title: 'The Matrix',
    year: '1999',
    directors: ['Lana Wachowski'],
    writers: ['Lilly Wachowski'],
    posterUrl: null,
    pdfName: null,
    ...over,
  }
}

function makeTvScreenplay(over: Partial<TvScreenplay> = {}): TvScreenplay {
  return {
    id: 1399,
    mediaType: 'tv',
    title: 'Game of Thrones',
    year: '2011',
    directors: ['David Nutter'],
    writers: ['David Benioff'],
    posterUrl: null,
    episodes: [],
    ...over,
  }
}

async function readRawDb(): Promise<Screenplay[]> {
  const raw = await fs.readFile(
    path.join(tmpDir, 'data', 'screenplays.json'),
    'utf8'
  )
  return JSON.parse(raw)
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'screenplays-db-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  vi.resetModules()
  db = await import('./screenplays-db')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('getScreenplays', () => {
  it('returns an empty array when the database file does not exist', async () => {
    await expect(db.getScreenplays()).resolves.toEqual([])
  })

  it('returns previously stored screenplays', async () => {
    await db.addScreenplay(makeScreenplay({ id: 7 }))
    const all = await db.getScreenplays()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(7)
  })

  it('defaults mediaType to movie for records saved before TV support', async () => {
    await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true })
    const legacyRecord = { ...makeScreenplay({ id: 42 }) } as Partial<Screenplay>
    delete legacyRecord.mediaType
    await fs.writeFile(
      path.join(tmpDir, 'data', 'screenplays.json'),
      JSON.stringify([legacyRecord])
    )

    const all = await db.getScreenplays()
    expect(all[0].mediaType).toBe('movie')
  })

  it('defaults episodes to an empty array for tv records saved before per-episode PDFs', async () => {
    await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true })
    const legacyRecord = { ...makeTvScreenplay({ id: 1399 }) } as Partial<TvScreenplay>
    delete legacyRecord.episodes
    await fs.writeFile(
      path.join(tmpDir, 'data', 'screenplays.json'),
      JSON.stringify([legacyRecord])
    )

    const all = await db.getScreenplays()
    expect(all[0]).toMatchObject({ mediaType: 'tv', episodes: [] })
  })

  it('propagates non-ENOENT read errors', async () => {
    // A directory where the JSON file is expected makes readFile fail with EISDIR.
    await fs.mkdir(path.join(tmpDir, 'data', 'screenplays.json'), {
      recursive: true,
    })
    await expect(db.getScreenplays()).rejects.toThrow()
  })
})

describe('addScreenplay', () => {
  it('persists a screenplay and writes a trailing newline', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    const raw = await fs.readFile(
      path.join(tmpDir, 'data', 'screenplays.json'),
      'utf8'
    )
    expect(raw.endsWith('\n')).toBe(true)
    expect(await readRawDb()).toHaveLength(1)
  })

  it('prepends new entries (most recently added first)', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1, title: 'First' }))
    const list = await db.addScreenplay(makeScreenplay({ id: 2, title: 'Second' }))
    expect(list.map((s) => s.id)).toEqual([2, 1])
  })

  it('ignores duplicates by media type and id, and does not reorder', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1, title: 'Original' }))
    await db.addScreenplay(makeScreenplay({ id: 2 }))
    const list = await db.addScreenplay(
      makeScreenplay({ id: 1, title: 'Duplicate attempt' })
    )
    expect(list).toHaveLength(2)
    expect(list.find((s) => s.id === 1)?.title).toBe('Original')
  })

  it('treats a movie and a tv show with the same numeric id as distinct', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1, title: 'Movie' }))
    const list = await db.addScreenplay(makeTvScreenplay({ id: 1, title: 'Show' }))
    expect(list).toHaveLength(2)
  })

  it('creates the data directory if missing', async () => {
    await db.addScreenplay(makeScreenplay())
    await expect(
      fs.stat(path.join(tmpDir, 'data', 'screenplays.json'))
    ).resolves.toBeDefined()
  })
})

describe('findScreenplay', () => {
  it('finds an existing screenplay by media type and id', async () => {
    await db.addScreenplay(makeScreenplay({ id: 42, title: 'Found' }))
    expect((await db.findScreenplay('movie', 42))?.title).toBe('Found')
  })

  it('returns undefined when no screenplay matches', async () => {
    await expect(db.findScreenplay('movie', 999)).resolves.toBeUndefined()
  })

  it('does not match a different media type with the same id', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    await expect(db.findScreenplay('tv', 1)).resolves.toBeUndefined()
  })
})

describe('updateScreenplay', () => {
  it('applies partial changes and returns the full list', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1, pdfName: null }))
    const list = await db.updateScreenplay('movie', 1, { pdfName: 'script.pdf' })
    expect(list).not.toBeNull()
    expect((list![0] as MovieScreenplay).pdfName).toBe('script.pdf')
    expect(await readRawDb()).toEqual([
      expect.objectContaining({ id: 1, pdfName: 'script.pdf' }),
    ])
  })

  it('never lets changes overwrite the id or media type', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    const list = await db.updateScreenplay('movie', 1, {
      id: 999,
      mediaType: 'tv',
      title: 'Renamed',
    } as Partial<Screenplay>)
    expect(list![0].id).toBe(1)
    expect(list![0].mediaType).toBe('movie')
    expect(list![0].title).toBe('Renamed')
  })

  it('returns null when the id is unknown', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    await expect(db.updateScreenplay('movie', 2, { title: 'x' })).resolves.toBeNull()
  })

  it('returns null when the media type does not match', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    await expect(db.updateScreenplay('tv', 1, { title: 'x' })).resolves.toBeNull()
  })
})

describe('removeScreenplay', () => {
  it('removes a screenplay by media type and id', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    await db.addScreenplay(makeScreenplay({ id: 2 }))
    const list = await db.removeScreenplay('movie', 1)
    expect(list.map((s) => s.id)).toEqual([2])
  })

  it('returns the unchanged list when the id is absent', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    const list = await db.removeScreenplay('movie', 999)
    expect(list.map((s) => s.id)).toEqual([1])
  })

  it('does not write the file when nothing was removed', async () => {
    // Empty DB, nothing on disk: removing a missing id should not create a file.
    await db.removeScreenplay('movie', 123)
    await expect(
      fs.stat(path.join(tmpDir, 'data', 'screenplays.json'))
    ).rejects.toThrow()
  })
})

describe('upsertEpisode', () => {
  it('adds a new episode to a tv show', async () => {
    await db.addScreenplay(makeTvScreenplay({ id: 1399 }))
    const list = await db.upsertEpisode(1399, {
      seasonNumber: 1,
      episodeNumber: 1,
      name: 'Winter Is Coming',
      pdfName: 'got-2011-s01e01.pdf',
    })
    const show = list!.find((s) => s.id === 1399) as TvScreenplay
    expect(show.episodes).toEqual([
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: 'Winter Is Coming',
        pdfName: 'got-2011-s01e01.pdf',
      },
    ])
  })

  it('replaces an existing episode matched by season + episode number', async () => {
    await db.addScreenplay(
      makeTvScreenplay({
        episodes: [
          { seasonNumber: 1, episodeNumber: 1, name: 'Old Name', pdfName: 'old.pdf' },
        ],
      })
    )
    const list = await db.upsertEpisode(1399, {
      seasonNumber: 1,
      episodeNumber: 1,
      name: 'Winter Is Coming',
      pdfName: 'new.pdf',
    })
    const show = list!.find((s) => s.id === 1399) as TvScreenplay
    expect(show.episodes).toHaveLength(1)
    expect(show.episodes[0].pdfName).toBe('new.pdf')
  })

  it('keeps episodes sorted by season then episode number', async () => {
    await db.addScreenplay(makeTvScreenplay())
    await db.upsertEpisode(1399, {
      seasonNumber: 2,
      episodeNumber: 1,
      name: 'S2E1',
      pdfName: 's2e1.pdf',
    })
    const list = await db.upsertEpisode(1399, {
      seasonNumber: 1,
      episodeNumber: 5,
      name: 'S1E5',
      pdfName: 's1e5.pdf',
    })
    const show = list!.find((s) => s.id === 1399) as TvScreenplay
    expect(show.episodes.map((e) => `${e.seasonNumber}-${e.episodeNumber}`)).toEqual([
      '1-5',
      '2-1',
    ])
  })

  it('returns null when no tv show matches the id', async () => {
    await expect(
      db.upsertEpisode(999, {
        seasonNumber: 1,
        episodeNumber: 1,
        name: 'x',
        pdfName: 'x.pdf',
      })
    ).resolves.toBeNull()
  })
})

describe('removeEpisode', () => {
  it('removes the matching episode and returns it', async () => {
    await db.addScreenplay(
      makeTvScreenplay({
        episodes: [
          { seasonNumber: 1, episodeNumber: 1, name: 'Winter Is Coming', pdfName: 'a.pdf' },
        ],
      })
    )
    const { screenplays, removed } = await db.removeEpisode(1399, 1, 1)
    expect(removed).toEqual({
      seasonNumber: 1,
      episodeNumber: 1,
      name: 'Winter Is Coming',
      pdfName: 'a.pdf',
    })
    const show = screenplays.find((s) => s.id === 1399) as TvScreenplay
    expect(show.episodes).toEqual([])
  })

  it('returns removed: null when no such episode is attached', async () => {
    await db.addScreenplay(makeTvScreenplay())
    const { removed } = await db.removeEpisode(1399, 1, 1)
    expect(removed).toBeNull()
  })

  it('returns removed: null when no such tv show exists', async () => {
    const { screenplays, removed } = await db.removeEpisode(999, 1, 1)
    expect(removed).toBeNull()
    expect(screenplays).toEqual([])
  })
})
