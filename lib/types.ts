// Shared, runtime-free types. Safe to import from both server and client code.

/** A movie as returned by the TMDB search proxy. */
export type TmdbMovie = {
  id: number
  title: string
  year: string | null
  overview: string
  posterUrl: string | null
}

/** A screenplay record as stored in the JSON file database. */
export type Screenplay = {
  id: number // TMDB movie id, used as the primary key
  title: string
  year: string | null
  directors: string[]
  writers: string[]
  posterUrl: string | null
  // Original filename of the uploaded PDF, or null if none was attached.
  // The file itself is stored on disk as <id>.pdf and served via the API.
  pdfName: string | null
}
