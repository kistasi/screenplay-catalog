import { NextResponse } from 'next/server'
import type { MediaType } from './types'

/**
 * Parse a route `[id]` param of the form `movie-603` or `tv-1399` into its
 * media type and numeric TMDB id. Returns a ready-to-send 400 response when
 * the param doesn't match that shape.
 */
export function parseScreenplayKey(
  raw: string
): { mediaType: MediaType; id: number } | NextResponse {
  const separatorIndex = raw.indexOf('-')
  const mediaType = separatorIndex === -1 ? raw : raw.slice(0, separatorIndex)
  const id = Number(separatorIndex === -1 ? '' : raw.slice(separatorIndex + 1))

  if ((mediaType !== 'movie' && mediaType !== 'tv') || !Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid screenplay id.' }, { status: 400 })
  }
  return { mediaType, id }
}

/**
 * Pull an uploaded PDF off a form. Returns the `File` when a valid PDF is
 * attached, the string `'invalid'` when a file is attached but isn't a PDF,
 * or `null` when no file was attached.
 */
export function pdfFromForm(form: FormData): File | 'invalid' | null {
  const pdf = form.get('pdf')
  if (!(pdf instanceof File) || pdf.size === 0) return null
  if (pdf.type !== 'application/pdf') return 'invalid'
  return pdf
}
