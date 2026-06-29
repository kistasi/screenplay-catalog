import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getScreenplay, searchMovies, TmdbError } from './tmdb'

// A stub Response good enough for the code under test (it only reads .ok,
// .status and .json()).
function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body } as unknown as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  process.env.TMDB_API_KEY = 'v3-classic-key'
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.TMDB_API_KEY
})

describe('credential handling', () => {
  it('throws a 500 TmdbError when no API key is configured', async () => {
    delete process.env.TMDB_API_KEY
    await expect(searchMovies('matrix')).rejects.toMatchObject({
      name: 'TmdbError',
      status: 500,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends a classic v3 key as the api_key query param', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await searchMovies('matrix')

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('api_key')).toBe('v3-classic-key')
    const init = fetchMock.mock.calls[0][1]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('sends a v4 JWT token as a Bearer header', async () => {
    process.env.TMDB_API_KEY = 'eyJ-this-looks-like-a-jwt'
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await searchMovies('matrix')

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('api_key')).toBeNull()
    const init = fetchMock.mock.calls[0][1]
    expect(init.headers.Authorization).toBe('Bearer eyJ-this-looks-like-a-jwt')
  })

  it('always requests English results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await searchMovies('matrix')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('language')).toBe('en-US')
  })
})

describe('searchMovies', () => {
  it('maps TMDB search results into TmdbMovie shape', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: 603,
            title: 'The Matrix',
            release_date: '1999-03-30',
            overview: 'A hacker learns the truth.',
            poster_path: '/abc.jpg',
          },
        ],
      })
    )

    const movies = await searchMovies('matrix')
    expect(movies).toEqual([
      {
        id: 603,
        title: 'The Matrix',
        year: '1999',
        overview: 'A hacker learns the truth.',
        posterUrl: 'https://image.tmdb.org/t/p/w200/abc.jpg',
      },
    ])
  })

  it('hits the /search/movie endpoint with the query and adult filter', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await searchMovies('blade runner')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/3/search/movie')
    expect(url.searchParams.get('query')).toBe('blade runner')
    expect(url.searchParams.get('include_adult')).toBe('false')
  })

  it('handles a missing year, overview and poster gracefully', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ results: [{ id: 1, title: 'Untitled' }] })
    )
    const [movie] = await searchMovies('x')
    expect(movie).toEqual({
      id: 1,
      title: 'Untitled',
      year: null,
      overview: '',
      posterUrl: null,
    })
  })

  it('returns an empty array when TMDB omits results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await expect(searchMovies('x')).resolves.toEqual([])
  })

  it('throws a 502 TmdbError when the upstream request is not ok', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }))
    await expect(searchMovies('x')).rejects.toMatchObject({
      name: 'TmdbError',
      status: 502,
    })
  })
})

describe('getScreenplay', () => {
  const movieBody = {
    id: 603,
    title: 'The Matrix',
    release_date: '1999-03-30',
    poster_path: '/poster.jpg',
    credits: {
      crew: [
        { name: 'Lana Wachowski', job: 'Director', department: 'Directing' },
        { name: 'Lilly Wachowski', job: 'Director', department: 'Directing' },
        { name: 'Lana Wachowski', job: 'Writer', department: 'Writing' },
        { name: 'Lilly Wachowski', job: 'Screenplay', department: 'Writing' },
        { name: 'Joel Silver', job: 'Producer', department: 'Production' },
      ],
    },
  }

  it('shapes details + credits into a Screenplay', async () => {
    fetchMock.mockResolvedValue(jsonResponse(movieBody))
    const screenplay = await getScreenplay(603)
    expect(screenplay).toEqual({
      id: 603,
      title: 'The Matrix',
      year: '1999',
      directors: ['Lana Wachowski', 'Lilly Wachowski'],
      writers: ['Lana Wachowski', 'Lilly Wachowski'],
      posterUrl: 'https://image.tmdb.org/t/p/w200/poster.jpg',
      pdfName: null,
    })
  })

  it('requests credits via append_to_response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(movieBody))
    await getScreenplay(603)
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/3/movie/603')
    expect(url.searchParams.get('append_to_response')).toBe('credits')
  })

  it('dedupes a director who is also credited as a writer per field', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 1,
        title: 'Solo Auteur',
        credits: {
          crew: [
            { name: 'A. Director', job: 'Director', department: 'Directing' },
            { name: 'A. Director', job: 'Director', department: 'Directing' },
            { name: 'A. Director', job: 'Writer', department: 'Writing' },
          ],
        },
      })
    )
    const s = await getScreenplay(1)
    expect(s.directors).toEqual(['A. Director'])
    expect(s.writers).toEqual(['A. Director'])
  })

  it('returns empty credit arrays when crew is absent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1, title: 'No Crew' }))
    const s = await getScreenplay(1)
    expect(s.directors).toEqual([])
    expect(s.writers).toEqual([])
  })

  it('throws a 404 TmdbError when the film is unknown', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }))
    await expect(getScreenplay(999)).rejects.toMatchObject({
      name: 'TmdbError',
      status: 404,
    })
  })

  it('throws a 502 TmdbError for other upstream failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }))
    await expect(getScreenplay(1)).rejects.toMatchObject({
      name: 'TmdbError',
      status: 502,
    })
  })
})

describe('TmdbError', () => {
  it('carries a message and status', () => {
    const err = new TmdbError('boom', 418)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('boom')
    expect(err.status).toBe(418)
    expect(err.name).toBe('TmdbError')
  })
})
