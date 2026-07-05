// Shared, low-dependency types (and trivial helpers) safe to import from both
// server and client code.

/** TMDB distinguishes movies and TV shows; ids are only unique within a type. */
export type MediaType = 'movie' | 'tv'

/** A movie or TV show as returned by the TMDB search proxy. */
export type TmdbResult = {
  id: number
  mediaType: MediaType
  title: string
  year: string | null
  overview: string
  posterUrl: string | null
}

/** A TMDB season, as listed in a TV show's details. */
export type TvSeason = {
  seasonNumber: number
  name: string
  episodeCount: number
}

/** A TMDB episode, as listed within a single season. */
export type TvEpisodeInfo = {
  episodeNumber: number
  name: string
  directors: string[]
  writers: string[]
}

/** A single episode's attached screenplay PDF. */
export type Episode = {
  seasonNumber: number
  episodeNumber: number
  name: string
  directors: string[]
  writers: string[]
  // Original filename of the uploaded PDF. The file itself is stored on disk
  // and served via the API.
  pdfName: string
}

type ScreenplayBase = {
  id: number // TMDB id, namespaced by mediaType (movie/tv ids can collide)
  title: string
  year: string | null
  posterUrl: string | null
}

/** A movie has a single attached screenplay PDF, and its own director/writer credits. */
export type MovieScreenplay = ScreenplayBase & {
  mediaType: 'movie'
  directors: string[]
  writers: string[]
  pdfName: string | null
}

/**
 * A TV show has one screenplay PDF per episode a script was attached to.
 * Director/writer credits live on each episode, not the show as a whole.
 */
export type TvScreenplay = ScreenplayBase & {
  mediaType: 'tv'
  episodes: Episode[]
}

/** A screenplay record as stored in the JSON file database. */
export type Screenplay = MovieScreenplay | TvScreenplay

/** Composite identity used as the `[id]` route param and DB lookup key. */
export function screenplayKey(s: { mediaType: MediaType; id: number }): string {
  return `${s.mediaType}-${s.id}`
}
