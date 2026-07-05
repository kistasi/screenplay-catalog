import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// uploads.ts derives its directory from process.cwd() at import time, so point
// cwd at a temp dir and import fresh per test.
let tmpDir: string
let uploads: typeof import('./uploads')

function uploadPath(filename: string) {
  return path.join(tmpDir, 'data', 'uploads', filename)
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

describe('slugify', () => {
  it('lowercases and hyphenates the title, appending the year', () => {
    expect(uploads.slugify('The Matrix', '1999')).toBe('the-matrix-1999')
  })

  it('strips punctuation, collapsing runs into a single hyphen', () => {
    expect(uploads.slugify('Amélie!', null)).toBe('am-lie')
  })

  it('omits the year when null', () => {
    expect(uploads.slugify('Drive', null)).toBe('drive')
  })

  it('trims leading/trailing hyphens produced by punctuation', () => {
    expect(uploads.slugify('  Se7en  ', '1995')).toBe('se7en-1995')
  })
})

describe('episodeFilename', () => {
  it('pads single-digit season and episode numbers to two digits', () => {
    expect(uploads.episodeFilename('Game of Thrones', '2011', 1, 3)).toBe(
      'game-of-thrones-2011-s01e03.pdf'
    )
  })

  it('does not truncate season/episode numbers with more than two digits', () => {
    expect(uploads.episodeFilename('Show', null, 10, 100)).toBe('show-s10e100.pdf')
  })
})

describe('savePdf', () => {
  it('writes the file contents, creating the directory', async () => {
    const file = new File(['%PDF-1.4 hello'], 'script.pdf', {
      type: 'application/pdf',
    })
    await uploads.savePdf('script.pdf', file)
    await expect(fs.readFile(uploadPath('script.pdf'), 'utf8')).resolves.toBe(
      '%PDF-1.4 hello'
    )
  })

  it('overwrites an existing PDF stored under the same filename', async () => {
    await uploads.savePdf('a.pdf', new File(['old'], 'a.pdf'))
    await uploads.savePdf('a.pdf', new File(['new'], 'b.pdf'))
    await expect(fs.readFile(uploadPath('a.pdf'), 'utf8')).resolves.toBe('new')
  })
})

describe('readPdf', () => {
  it('reads back a stored PDF as a Buffer', async () => {
    await uploads.savePdf('x.pdf', new File(['data'], 'x.pdf'))
    const buf = await uploads.readPdf('x.pdf')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf?.toString()).toBe('data')
  })

  it('returns null when no PDF exists for the filename', async () => {
    await expect(uploads.readPdf('missing.pdf')).resolves.toBeNull()
  })

  it('returns null when the filename is null', async () => {
    await expect(uploads.readPdf(null)).resolves.toBeNull()
  })
})

describe('deletePdf', () => {
  it('removes an existing PDF', async () => {
    await uploads.savePdf('x.pdf', new File(['data'], 'x.pdf'))
    await uploads.deletePdf('x.pdf')
    await expect(fs.stat(uploadPath('x.pdf'))).rejects.toThrow()
  })

  it('is a no-op when the PDF is already absent', async () => {
    await expect(uploads.deletePdf('missing.pdf')).resolves.toBeUndefined()
  })

  it('is a no-op when the filename is null', async () => {
    await expect(uploads.deletePdf(null)).resolves.toBeUndefined()
  })

  it('round-trips save then delete then read', async () => {
    await uploads.savePdf('x.pdf', new File(['x'], 'x.pdf'))
    await uploads.deletePdf('x.pdf')
    await expect(uploads.readPdf('x.pdf')).resolves.toBeNull()
  })
})

describe('pdfResponse', () => {
  it('serves the PDF inline with a matching Content-Type', async () => {
    const res = uploads.pdfResponse('script.pdf', Buffer.from('%PDF-1.4'))
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.toString()).toBe('%PDF-1.4')
  })

  it('builds an ASCII fallback plus an RFC 5987 filename for non-ASCII names', () => {
    const res = uploads.pdfResponse('résumé"quote.pdf', Buffer.from('x'))
    const disposition = res.headers.get('Content-Disposition')!
    expect(disposition).toContain('filename="r_sum_\'quote.pdf"')
    expect(disposition).toContain(
      `filename*=UTF-8''${encodeURIComponent('résumé"quote.pdf')}`
    )
  })
})
