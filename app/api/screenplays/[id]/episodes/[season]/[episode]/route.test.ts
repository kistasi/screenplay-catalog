import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE } from './route'
import { removeEpisode } from '@/lib/screenplays-db'
import { deletePdf } from '@/lib/uploads'

vi.mock('@/lib/screenplays-db', () => ({ removeEpisode: vi.fn() }))
vi.mock('@/lib/uploads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/uploads')>()
  return { ...actual, deletePdf: vi.fn() }
})

const mockRemoveEpisode = vi.mocked(removeEpisode)
const mockDeletePdf = vi.mocked(deletePdf)

function ctx(id: string, season: string, episode: string) {
  return { params: Promise.resolve({ id, season, episode }) } as Parameters<typeof DELETE>[1]
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DELETE /api/screenplays/[id]/episodes/[season]/[episode]', () => {
  it('rejects a movie id with 400', async () => {
    const res = await DELETE(new Request('http://localhost'), ctx('movie-603', '1', '1'))
    expect(res.status).toBe(400)
    expect(mockRemoveEpisode).not.toHaveBeenCalled()
  })

  it('rejects an invalid screenplay key with 400', async () => {
    const res = await DELETE(new Request('http://localhost'), ctx('abc', '1', '1'))
    expect(res.status).toBe(400)
  })

  it('rejects a non-numeric season or episode with 400', async () => {
    const res = await DELETE(new Request('http://localhost'), ctx('tv-1399', 'abc', '1'))
    expect(res.status).toBe(400)
    expect(mockRemoveEpisode).not.toHaveBeenCalled()
  })

  it('removes the episode and deletes its PDF', async () => {
    mockRemoveEpisode.mockResolvedValue({
      screenplays: [],
      removed: {
        seasonNumber: 1,
        episodeNumber: 1,
        name: 'Winter Is Coming',
        directors: [],
        writers: [],
        pdfName: 'got-s01e01.pdf',
      },
    })

    const res = await DELETE(new Request('http://localhost'), ctx('tv-1399', '1', '1'))

    expect(mockRemoveEpisode).toHaveBeenCalledWith(1399, 1, 1)
    expect(mockDeletePdf).toHaveBeenCalledWith('got-s01e01.pdf')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ screenplays: [] })
  })

  it('does not delete a PDF when no matching episode was removed', async () => {
    mockRemoveEpisode.mockResolvedValue({ screenplays: [], removed: null })

    await DELETE(new Request('http://localhost'), ctx('tv-1399', '1', '1'))

    expect(mockDeletePdf).not.toHaveBeenCalled()
  })
})
