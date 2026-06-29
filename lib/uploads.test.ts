import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// uploads.ts derives its directory from process.cwd() at import time, so point
// cwd at a temp dir and import fresh per test.
let tmpDir: string
let uploads: typeof import('./uploads')

function uploadPath(id: number) {
  return path.join(tmpDir, 'data', 'uploads', `${id}.pdf`)
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'screenplays-uploads-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  vi.resetModules()
  uploads = await import('./uploads')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('savePdf', () => {
  it('writes the file contents to <id>.pdf, creating the directory', async () => {
    const file = new File(['%PDF-1.4 hello'], 'script.pdf', {
      type: 'application/pdf',
    })
    await uploads.savePdf(5, file)
    await expect(fs.readFile(uploadPath(5), 'utf8')).resolves.toBe(
      '%PDF-1.4 hello'
    )
  })

  it('overwrites an existing PDF for the same id', async () => {
    await uploads.savePdf(5, new File(['old'], 'a.pdf'))
    await uploads.savePdf(5, new File(['new'], 'b.pdf'))
    await expect(fs.readFile(uploadPath(5), 'utf8')).resolves.toBe('new')
  })
})

describe('readPdf', () => {
  it('reads back a stored PDF as a Buffer', async () => {
    await uploads.savePdf(9, new File(['data'], 'x.pdf'))
    const buf = await uploads.readPdf(9)
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf?.toString()).toBe('data')
  })

  it('returns null when no PDF exists for the id', async () => {
    await expect(uploads.readPdf(404)).resolves.toBeNull()
  })
})

describe('deletePdf', () => {
  it('removes an existing PDF', async () => {
    await uploads.savePdf(3, new File(['data'], 'x.pdf'))
    await uploads.deletePdf(3)
    await expect(fs.stat(uploadPath(3))).rejects.toThrow()
  })

  it('is a no-op when the PDF is already absent', async () => {
    await expect(uploads.deletePdf(123)).resolves.toBeUndefined()
  })

  it('round-trips save then delete then read', async () => {
    await uploads.savePdf(1, new File(['x'], 'x.pdf'))
    await uploads.deletePdf(1)
    await expect(uploads.readPdf(1)).resolves.toBeNull()
  })
})
