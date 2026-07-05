import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getScreenplay, searchTitles, TmdbError } from './tmdb'

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
    await expect(searchTitles('matrix')).rejects.toMatchObject({
      name: 'TmdbError',
      status: 500,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends a classic v3 key as the api_key query param', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await searchTitles('matrix')

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('api_key')).toBe('v3-classic-key')
    const init = fetchMock.mock.calls[0][1]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('sends a v4 JWT token as a Bearer header', async () => {
    process.env.TMDB_API_KEY = 'eyJ-this-looks-like-a-jwt'
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await searchTitles('matrix')

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('api_key')).toBeNull()
    const init = fetchMock.mock.calls[0][1]
    expect(init.headers.Authorization).toBe('Bearer eyJ-this-looks-like-a-jwt')
  })

  it('always requests English results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await searchTitles('matrix')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('language')).toBe('en-US')
  })
})

describe('searchTitles', () => {
  it('maps a movie search result into TmdbResult shape', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: 603,
            media_type: 'movie',
            title: 'The Matrix',
            release_date: '1999-03-30',
            overview: 'A hacker learns the truth.',
            poster_path: '/abc.jpg',
          },
        ],
      })
    )

    const results = await searchTitles('matrix')
    expect(results).toEqual([
      {
        id: 603,
        mediaType: 'movie',
        title: 'The Matrix',
        year: '1999',
        overview: 'A hacker learns the truth.',
        posterUrl: 'https://image.tmdb.org/t/p/w200/abc.jpg',
      },
    ])
  })

  it('maps a TV search result into TmdbResult shape', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: 1399,
            media_type: 'tv',
            name: 'Game of Thrones',
            first_air_date: '2011-04-17',
            overview: 'Nine noble families fight for control.',
            poster_path: '/got.jpg',
          },
        ],
      })
    )

    const results = await searchTitles('thrones')
    expect(results).toEqual([
      {
        id: 1399,
        mediaType: 'tv',
        title: 'Game of Thrones',
        year: '2011',
        overview: 'Nine noble families fight for control.',
        posterUrl: 'https://image.tmdb.org/t/p/w200/got.jpg',
      },
    ])
  })

  it('filters out non-movie/tv results (e.g. people)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          { id: 1, media_type: 'person', name: 'Some Actor' },
          { id: 2, media_type: 'movie', title: 'A Film' },
        ],
      })
    )
    const results = await searchTitles('x')
    expect(results).toHaveLength(1)
    expect(results[0].mediaType).toBe('movie')
  })

  it('hits the /search/multi endpoint with the query and adult filter', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }))
    await searchTitles('blade runner')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/3/search/multi')
    expect(url.searchParams.get('query')).toBe('blade runner')
    expect(url.searchParams.get('include_adult')).toBe('false')
  })

  it('handles a missing year, overview and poster gracefully', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ results: [{ id: 1, media_type: 'movie', title: 'Untitled' }] })
    )
    const [result] = await searchTitles('x')
    expect(result).toEqual({
      id: 1,
      mediaType: 'movie',
      title: 'Untitled',
      year: null,
      overview: '',
      posterUrl: null,
    })
  })

  it('returns an empty array when TMDB omits results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await expect(searchTitles('x')).resolves.toEqual([])
  })

  it('throws a 502 TmdbError when the upstream request is not ok', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }))
    await expect(searchTitles('x')).rejects.toMatchObject({
      name: 'TmdbError',
      status: 502,
    })
  })
})

describe('getScreenplay (movie)', () => {
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
    const screenplay = await getScreenplay('movie', 603)
    expect(screenplay).toEqual({
      id: 603,
      mediaType: 'movie',
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
    await getScreenplay('movie', 603)
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
    const s = await getScreenplay('movie', 1)
    expect(s.directors).toEqual(['A. Director'])
    expect(s.writers).toEqual(['A. Director'])
  })

  it('returns empty credit arrays when crew is absent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1, title: 'No Crew' }))
    const s = await getScreenplay('movie', 1)
    expect(s.directors).toEqual([])
    expect(s.writers).toEqual([])
  })

  it('throws a 404 TmdbError when the film is unknown', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }))
    await expect(getScreenplay('movie', 999)).rejects.toMatchObject({
      name: 'TmdbError',
      status: 404,
    })
  })

  it('throws a 502 TmdbError for other upstream failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }))
    await expect(getScreenplay('movie', 1)).rejects.toMatchObject({
      name: 'TmdbError',
      status: 502,
    })
  })
})

describe('getScreenplay (tv)', () => {
  const tvBody = {
    id: 1399,
    name: 'Game of Thrones',
    first_air_date: '2011-04-17',
    poster_path: '/got.jpg',
    created_by: [{ name: 'David Benioff' }, { name: 'D. B. Weiss' }],
    aggregate_credits: {
      crew: [
        {
          name: 'David Nutter',
          department: 'Directing',
          jobs: [{ job: 'Director' }],
        },
        {
          name: 'David Benioff',
          department: 'Writing',
          jobs: [{ job: 'Writer' }],
        },
        {
          name: 'D. B. Weiss',
          department: 'Writing',
          jobs: [{ job: 'Writer' }],
        },
        {
          name: 'Some Producer',
          department: 'Production',
          jobs: [{ job: 'Executive Producer' }],
        },
      ],
    },
  }

  it('shapes details + aggregate credits into a Screenplay', async () => {
    fetchMock.mockResolvedValue(jsonResponse(tvBody))
    const screenplay = await getScreenplay('tv', 1399)
    expect(screenplay).toEqual({
      id: 1399,
      mediaType: 'tv',
      title: 'Game of Thrones',
      year: '2011',
      directors: ['David Nutter'],
      writers: ['David Benioff', 'D. B. Weiss'],
      posterUrl: 'https://image.tmdb.org/t/p/w200/got.jpg',
      episodes: [],
    })
  })

  it('requests aggregate_credits via append_to_response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(tvBody))
    await getScreenplay('tv', 1399)
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/3/tv/1399')
    expect(url.searchParams.get('append_to_response')).toBe('aggregate_credits')
  })

  it('falls back to created_by when no aggregate director credit exists', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 1,
        name: 'No Director Data',
        created_by: [{ name: 'A Creator' }],
        aggregate_credits: { crew: [] },
      })
    )
    const s = await getScreenplay('tv', 1)
    expect(s.directors).toEqual(['A Creator'])
  })

  it('returns empty credit arrays when crew and created_by are absent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1, name: 'No Crew' }))
    const s = await getScreenplay('tv', 1)
    expect(s.directors).toEqual([])
    expect(s.writers).toEqual([])
  })

  it('throws a 404 TmdbError when the show is unknown', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }))
    await expect(getScreenplay('tv', 999)).rejects.toMatchObject({
      name: 'TmdbError',
      status: 404,
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
