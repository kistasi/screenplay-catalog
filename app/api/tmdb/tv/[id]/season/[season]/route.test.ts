import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { getSeasonEpisodes, TmdbError } from '@/lib/tmdb'

vi.mock('@/lib/tmdb', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tmdb')>('@/lib/tmdb')
  return { ...actual, getSeasonEpisodes: vi.fn() }
})

const mockGetSeasonEpisodes = vi.mocked(getSeasonEpisodes)

function ctx(id: string, season: string) {
  return { params: Promise.resolve({ id, season }) } as Parameters<typeof GET>[1]
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/tmdb/tv/[id]/season/[season]', () => {
  it('rejects a non-numeric show id with 400', async () => {
    const res = await GET(new Request('http://localhost'), ctx('abc', '1'))
    expect(res.status).toBe(400)
    expect(mockGetSeasonEpisodes).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric season number with 400', async () => {
    const res = await GET(new Request('http://localhost'), ctx('1399', 'abc'))
    expect(res.status).toBe(400)
    expect(mockGetSeasonEpisodes).not.toHaveBeenCalled()
  })

  it('returns the episodes for a valid show + season', async () => {
    const episodes = [
      { episodeNumber: 1, name: 'Winter Is Coming', directors: ['Tim Van Patten'], writers: [] },
    ]
    mockGetSeasonEpisodes.mockResolvedValue(episodes)

    const res = await GET(new Request('http://localhost'), ctx('1399', '1'))

    expect(mockGetSeasonEpisodes).toHaveBeenCalledWith(1399, 1)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ episodes })
  })

  it('maps a TmdbError to its HTTP status and message', async () => {
    mockGetSeasonEpisodes.mockRejectedValue(
      new TmdbError('No season 99 found for show 1399.', 404)
    )
    const res = await GET(new Request('http://localhost'), ctx('1399', '99'))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'No season 99 found for show 1399.' })
  })

  it('rethrows non-TmdbError failures', async () => {
    mockGetSeasonEpisodes.mockRejectedValue(new Error('boom'))
    await expect(
      GET(new Request('http://localhost'), ctx('1399', '1'))
    ).rejects.toThrow('boom')
  })
})
