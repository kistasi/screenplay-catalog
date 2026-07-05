import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { getTvSeasons, TmdbError } from '@/lib/tmdb'

vi.mock('@/lib/tmdb', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tmdb')>('@/lib/tmdb')
  return { ...actual, getTvSeasons: vi.fn() }
})

const mockGetTvSeasons = vi.mocked(getTvSeasons)

function ctx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof GET>[1]
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/tmdb/tv/[id]/seasons', () => {
  it('rejects a non-numeric show id with 400', async () => {
    const res = await GET(new Request('http://localhost'), ctx('abc'))
    expect(res.status).toBe(400)
    expect(mockGetTvSeasons).not.toHaveBeenCalled()
  })

  it('returns the seasons for a valid show id', async () => {
    const seasons = [{ seasonNumber: 1, name: 'Season 1', episodeCount: 10 }]
    mockGetTvSeasons.mockResolvedValue(seasons)

    const res = await GET(new Request('http://localhost'), ctx('1399'))

    expect(mockGetTvSeasons).toHaveBeenCalledWith(1399)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ seasons })
  })

  it('maps a TmdbError to its HTTP status and message', async () => {
    mockGetTvSeasons.mockRejectedValue(new TmdbError('No TV show found with id 999.', 404))
    const res = await GET(new Request('http://localhost'), ctx('999'))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'No TV show found with id 999.' })
  })

  it('rethrows non-TmdbError failures', async () => {
    mockGetTvSeasons.mockRejectedValue(new Error('boom'))
    await expect(GET(new Request('http://localhost'), ctx('1399'))).rejects.toThrow('boom')
  })
})
