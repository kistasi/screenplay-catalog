import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Screenplay } from './types'

// screenplays-db computes its DB path from process.cwd() at import time, so we
// point cwd at a throwaway temp dir and import the module fresh for each test.
let tmpDir: string
let db: typeof import('./screenplays-db')

function makeScreenplay(over: Partial<Screenplay> = {}): Screenplay {
  return {
    id: 1,
    title: 'The Matrix',
    year: '1999',
    directors: ['Lana Wachowski'],
    writers: ['Lilly Wachowski'],
    posterUrl: null,
    pdfName: null,
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

  it('ignores duplicates by id and does not reorder', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1, title: 'Original' }))
    await db.addScreenplay(makeScreenplay({ id: 2 }))
    const list = await db.addScreenplay(
      makeScreenplay({ id: 1, title: 'Duplicate attempt' })
    )
    expect(list).toHaveLength(2)
    expect(list.find((s) => s.id === 1)?.title).toBe('Original')
  })

  it('creates the data directory if missing', async () => {
    await db.addScreenplay(makeScreenplay())
    await expect(
      fs.stat(path.join(tmpDir, 'data', 'screenplays.json'))
    ).resolves.toBeDefined()
  })
})

describe('findScreenplay', () => {
  it('finds an existing screenplay by id', async () => {
    await db.addScreenplay(makeScreenplay({ id: 42, title: 'Found' }))
    expect((await db.findScreenplay(42))?.title).toBe('Found')
  })

  it('returns undefined when no screenplay matches', async () => {
    await expect(db.findScreenplay(999)).resolves.toBeUndefined()
  })
})

describe('updateScreenplay', () => {
  it('applies partial changes and returns the full list', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1, pdfName: null }))
    const list = await db.updateScreenplay(1, { pdfName: 'script.pdf' })
    expect(list).not.toBeNull()
    expect(list![0].pdfName).toBe('script.pdf')
    expect(await readRawDb()).toEqual([
      expect.objectContaining({ id: 1, pdfName: 'script.pdf' }),
    ])
  })

  it('never lets changes overwrite the id', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    const list = await db.updateScreenplay(1, {
      id: 999,
      title: 'Renamed',
    } as Partial<Screenplay>)
    expect(list![0].id).toBe(1)
    expect(list![0].title).toBe('Renamed')
  })

  it('returns null when the id is unknown', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    await expect(db.updateScreenplay(2, { title: 'x' })).resolves.toBeNull()
  })
})

describe('removeScreenplay', () => {
  it('removes a screenplay by id', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    await db.addScreenplay(makeScreenplay({ id: 2 }))
    const list = await db.removeScreenplay(1)
    expect(list.map((s) => s.id)).toEqual([2])
  })

  it('returns the unchanged list when the id is absent', async () => {
    await db.addScreenplay(makeScreenplay({ id: 1 }))
    const list = await db.removeScreenplay(999)
    expect(list.map((s) => s.id)).toEqual([1])
  })

  it('does not write the file when nothing was removed', async () => {
    // Empty DB, nothing on disk: removing a missing id should not create a file.
    await db.removeScreenplay(123)
    await expect(
      fs.stat(path.join(tmpDir, 'data', 'screenplays.json'))
    ).rejects.toThrow()
  })
})
