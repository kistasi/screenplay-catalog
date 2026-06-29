import { promises as fs } from 'node:fs'
import path from 'node:path'

// Uploaded screenplay PDFs live here, keyed by TMDB id (<id>.pdf).
// Kept out of the repo (see .gitignore: /data/*).
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads')

function pdfPath(id: number): string {
  return path.join(UPLOADS_DIR, `${id}.pdf`)
}

/** Persist an uploaded PDF for the given screenplay id. */
export async function savePdf(id: number, file: File): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  const bytes = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(pdfPath(id), bytes)
}

/** Read a stored PDF, or null if none exists. */
export async function readPdf(id: number): Promise<Buffer | null> {
  try {
    return await fs.readFile(pdfPath(id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** Delete a stored PDF if present. */
export async function deletePdf(id: number): Promise<void> {
  try {
    await fs.unlink(pdfPath(id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}
