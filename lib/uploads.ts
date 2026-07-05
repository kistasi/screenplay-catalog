import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

// Uploaded screenplay PDFs live here, keyed by slug (title-year.pdf).
// Kept out of the repo (see .gitignore: /data/*).
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads')

export function slugify(title: string, year: string | null): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return year ? `${slug}-${year}` : slug
}

/** Filename for a single episode's attached PDF, e.g. `show-2011-s01e03.pdf`. */
export function episodeFilename(
  title: string,
  year: string | null,
  seasonNumber: number,
  episodeNumber: number
): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${slugify(title, year)}-s${pad(seasonNumber)}e${pad(episodeNumber)}.pdf`
}

function pdfPath(filename: string): string {
  return path.join(UPLOADS_DIR, filename)
}

/** Persist an uploaded PDF under the given filename. */
export async function savePdf(filename: string, file: File): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  const bytes = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(pdfPath(filename), bytes)
}

/** Read a stored PDF by filename, or null if none exists. */
export async function readPdf(filename: string | null): Promise<Buffer | null> {
  if (!filename) return null
  try {
    return await fs.readFile(pdfPath(filename))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** Delete a stored PDF by filename if present. */
export async function deletePdf(filename: string | null): Promise<void> {
  if (!filename) return
  try {
    await fs.unlink(pdfPath(filename))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

/** Serve a PDF buffer inline under its original filename. */
export function pdfResponse(filename: string, pdf: Buffer): NextResponse {
  // Provide an ASCII fallback plus an RFC 5987 encoded name so filenames with
  // spaces or non-ASCII characters survive.
  const asciiName = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'")
  const disposition = `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
    filename
  )}`

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
    },
  })
}
