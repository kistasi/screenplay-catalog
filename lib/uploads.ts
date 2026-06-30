import { promises as fs } from 'node:fs'
import path from 'node:path'

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
