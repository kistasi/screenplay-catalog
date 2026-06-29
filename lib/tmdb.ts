import type { Screenplay, TmdbMovie } from './types'

const POSTER_BASE = 'https://image.tmdb.org/t/p/w200'

/** Error carrying an HTTP status, so route handlers can respond appropriately. */
export class TmdbError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'TmdbError'
    this.status = status
  }
}

type TmdbCrewMember = { name: string; job?: string; department?: string }

// Build and send a TMDB request, attaching credentials. TMDB accepts either a
// v4 "Read Access Token" (a JWT, sent as a Bearer header) or a classic v3 API
// key (sent as an `api_key` query param); detect which was provided.
function tmdbRequest(path: string, params: Record<string, string>) {
  const token = process.env.TMDB_API_KEY
  if (!token) {
    throw new TmdbError('TMDB_API_KEY is not configured on the server.', 500)
  }

  const url = new URL(`https://api.themoviedb.org/3${path}`)
  url.searchParams.set('language', 'en-US')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${token}`
  } else {
    url.searchParams.set('api_key', token)
  }

  return fetch(url, { headers })
}

function posterUrl(posterPath?: string | null): string | null {
  return posterPath ? `${POSTER_BASE}${posterPath}` : null
}

function yearFromReleaseDate(releaseDate?: string): string | null {
  return releaseDate ? releaseDate.slice(0, 4) : null
}

/** Search TMDB for movies matching a free-text query. */
export async function searchMovies(query: string): Promise<TmdbMovie[]> {
  const res = await tmdbRequest('/search/movie', {
    query,
    include_adult: 'false',
    page: '1',
  })

  if (!res.ok) {
    throw new TmdbError(`TMDB request failed (${res.status}).`, 502)
  }

  const data = (await res.json()) as {
    results?: Array<{
      id: number
      title: string
      release_date?: string
      overview?: string
      poster_path?: string | null
    }>
  }

  return (data.results ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    year: yearFromReleaseDate(m.release_date),
    overview: m.overview ?? '',
    posterUrl: posterUrl(m.poster_path),
  }))
}

function uniqueNames(crew: TmdbCrewMember[], match: (c: TmdbCrewMember) => boolean) {
  const seen = new Set<string>()
  for (const member of crew) {
    if (match(member)) seen.add(member.name)
  }
  return [...seen]
}

/**
 * Fetch a movie's details plus credits and shape it into a Screenplay,
 * extracting director(s) and writer(s) from the crew.
 */
export async function getScreenplay(id: number): Promise<Screenplay> {
  const res = await tmdbRequest(`/movie/${id}`, {
    append_to_response: 'credits',
  })

  if (res.status === 404) {
    throw new TmdbError(`No film found with id ${id}.`, 404)
  }
  if (!res.ok) {
    throw new TmdbError(`TMDB request failed (${res.status}).`, 502)
  }

  const data = (await res.json()) as {
    id: number
    title: string
    release_date?: string
    poster_path?: string | null
    credits?: { crew?: TmdbCrewMember[] }
  }

  const crew = data.credits?.crew ?? []

  return {
    id: data.id,
    title: data.title,
    year: yearFromReleaseDate(data.release_date),
    directors: uniqueNames(crew, (c) => c.job === 'Director'),
    // The "Writing" department covers Screenplay, Writer, Story, Author, etc.
    writers: uniqueNames(crew, (c) => c.department === 'Writing'),
    posterUrl: posterUrl(data.poster_path),
  }
}
