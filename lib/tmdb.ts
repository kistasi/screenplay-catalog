import type { MediaType, Screenplay, TmdbResult, TvEpisodeInfo, TvSeason } from './types'

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

function yearFromDate(date?: string): string | null {
  return date ? date.slice(0, 4) : null
}

/** Search TMDB for movies and TV shows matching a free-text query. */
export async function searchTitles(query: string): Promise<TmdbResult[]> {
  const res = await tmdbRequest('/search/multi', {
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
      media_type?: string
      title?: string
      name?: string
      release_date?: string
      first_air_date?: string
      overview?: string
      poster_path?: string | null
    }>
  }

  return (data.results ?? [])
    // /search/multi also returns people; only movies and TV shows belong here.
    .filter(
      (r): r is typeof r & { media_type: MediaType } =>
        r.media_type === 'movie' || r.media_type === 'tv'
    )
    .map((r) => ({
      id: r.id,
      mediaType: r.media_type,
      title: (r.media_type === 'movie' ? r.title : r.name) ?? '',
      year: yearFromDate(r.media_type === 'movie' ? r.release_date : r.first_air_date),
      overview: r.overview ?? '',
      posterUrl: posterUrl(r.poster_path),
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
async function getMovie(id: number): Promise<Screenplay> {
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
    mediaType: 'movie',
    title: data.title,
    year: yearFromDate(data.release_date),
    directors: uniqueNames(crew, (c) => c.job === 'Director'),
    // The "Writing" department covers Screenplay, Writer, Story, Author, etc.
    writers: uniqueNames(crew, (c) => c.department === 'Writing'),
    posterUrl: posterUrl(data.poster_path),
    pdfName: null,
  }
}

/**
 * Fetch a TV show's details and shape it into a Screenplay. Unlike movies, a
 * show has no single director/writer credit — those live on each episode
 * (see getSeasonEpisodes), so the show starts with an empty episode list.
 */
async function getTvShow(id: number): Promise<Screenplay> {
  const res = await tmdbRequest(`/tv/${id}`, {})

  if (res.status === 404) {
    throw new TmdbError(`No TV show found with id ${id}.`, 404)
  }
  if (!res.ok) {
    throw new TmdbError(`TMDB request failed (${res.status}).`, 502)
  }

  const data = (await res.json()) as {
    id: number
    name: string
    first_air_date?: string
    poster_path?: string | null
  }

  return {
    id: data.id,
    mediaType: 'tv',
    title: data.name,
    year: yearFromDate(data.first_air_date),
    posterUrl: posterUrl(data.poster_path),
    episodes: [],
  }
}

/** Fetch a movie's or TV show's full details and shape them into a Screenplay. */
export async function getScreenplay(mediaType: MediaType, id: number): Promise<Screenplay> {
  return mediaType === 'movie' ? getMovie(id) : getTvShow(id)
}

/** List a TV show's seasons, used to let a user pick which episode to attach a PDF to. */
export async function getTvSeasons(id: number): Promise<TvSeason[]> {
  const res = await tmdbRequest(`/tv/${id}`, {})

  if (res.status === 404) {
    throw new TmdbError(`No TV show found with id ${id}.`, 404)
  }
  if (!res.ok) {
    throw new TmdbError(`TMDB request failed (${res.status}).`, 502)
  }

  const data = (await res.json()) as {
    seasons?: Array<{ season_number: number; name: string; episode_count: number }>
  }

  return (data.seasons ?? []).map((s) => ({
    seasonNumber: s.season_number,
    name: s.name,
    episodeCount: s.episode_count,
  }))
}

/** List a season's episodes, used to let a user pick which episode to attach a PDF to. */
export async function getSeasonEpisodes(id: number, seasonNumber: number): Promise<TvEpisodeInfo[]> {
  const res = await tmdbRequest(`/tv/${id}/season/${seasonNumber}`, {})

  if (res.status === 404) {
    throw new TmdbError(`No season ${seasonNumber} found for show ${id}.`, 404)
  }
  if (!res.ok) {
    throw new TmdbError(`TMDB request failed (${res.status}).`, 502)
  }

  const data = (await res.json()) as {
    episodes?: Array<{
      episode_number: number
      name: string
      crew?: TmdbCrewMember[]
    }>
  }

  return (data.episodes ?? []).map((e) => {
    const crew = e.crew ?? []
    return {
      episodeNumber: e.episode_number,
      name: e.name,
      directors: uniqueNames(crew, (c) => c.job === 'Director'),
      writers: uniqueNames(crew, (c) => c.department === 'Writing'),
    }
  })
}
