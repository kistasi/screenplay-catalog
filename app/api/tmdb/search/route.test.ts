import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { searchMovies, TmdbError } from '@/lib/tmdb'

vi.mock('@/lib/tmdb', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tmdb')>('@/lib/tmdb')
  return { ...actual, searchMovies: vi.fn() }
})

const mockSearch = vi.mocked(searchMovies)

function request(query?: string) {
  const url = new URL('http://localhost/api/tmdb/search')
  if (query !== undefined) url.searchParams.set('query', query)
  return new NextRequest(url)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/tmdb/search', () => {
  it('returns empty results without a query param', async () => {
    const res = await GET(request())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ results: [] })
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('returns empty results for a whitespace-only query', async () => {
    const res = await GET(request('   '))
    await expect(res.json()).resolves.toEqual({ results: [] })
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('passes the trimmed query to searchMovies and returns its results', async () => {
    const movie = {
      id: 1,
      title: 'The Matrix',
      year: '1999',
      overview: '',
      posterUrl: null,
    }
    mockSearch.mockResolvedValue([movie])

    const res = await GET(request('  matrix  '))

    expect(mockSearch).toHaveBeenCalledWith('matrix')
    await expect(res.json()).resolves.toEqual({ results: [movie] })
  })

  it('maps a TmdbError to its status and message', async () => {
    mockSearch.mockRejectedValue(new TmdbError('Upstream failed.', 502))
    const res = await GET(request('matrix'))
    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({ error: 'Upstream failed.' })
  })

  it('rethrows non-TmdbError failures', async () => {
    mockSearch.mockRejectedValue(new Error('boom'))
    await expect(GET(request('matrix'))).rejects.toThrow('boom')
  })
})
