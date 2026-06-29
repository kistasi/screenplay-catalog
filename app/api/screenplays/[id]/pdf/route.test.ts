import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { findScreenplay } from '@/lib/screenplays-db'
import { readPdf } from '@/lib/uploads'

vi.mock('@/lib/screenplays-db', () => ({ findScreenplay: vi.fn() }))
vi.mock('@/lib/uploads', () => ({ readPdf: vi.fn() }))

const mockFind = vi.mocked(findScreenplay)
const mockReadPdf = vi.mocked(readPdf)

const sample = {
  id: 1,
  title: 'The Matrix',
  year: '1999',
  directors: [],
  writers: [],
  posterUrl: null,
  pdfName: 'My Script.pdf',
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof GET>[1]
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/screenplays/[id]/pdf', () => {
  it('rejects an invalid id with 400', async () => {
    const res = await GET(new Request('http://localhost'), ctx('abc'))
    expect(res.status).toBe(400)
    expect(mockReadPdf).not.toHaveBeenCalled()
  })

  it('404s when no PDF is stored', async () => {
    mockReadPdf.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost'), ctx('1'))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'No PDF found.' })
  })

  it('serves the PDF with the stored original filename', async () => {
    mockReadPdf.mockResolvedValue(Buffer.from('%PDF-1.4'))
    mockFind.mockResolvedValue(sample)

    const res = await GET(new Request('http://localhost'), ctx('1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    const disposition = res.headers.get('Content-Disposition')!
    expect(disposition).toContain('inline')
    expect(disposition).toContain('filename="My Script.pdf"')
    expect(disposition).toContain("filename*=UTF-8''My%20Script.pdf")
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.toString()).toBe('%PDF-1.4')
  })

  it('falls back to <id>.pdf when no record/filename exists', async () => {
    mockReadPdf.mockResolvedValue(Buffer.from('%PDF'))
    mockFind.mockResolvedValue(undefined)

    const res = await GET(new Request('http://localhost'), ctx('7'))

    expect(res.headers.get('Content-Disposition')).toContain('filename="7.pdf"')
  })

  it('sanitises non-ASCII characters in the ASCII filename fallback', async () => {
    mockReadPdf.mockResolvedValue(Buffer.from('%PDF'))
    mockFind.mockResolvedValue({ ...sample, pdfName: 'résumé"quote.pdf' })

    const res = await GET(new Request('http://localhost'), ctx('1'))
    const disposition = res.headers.get('Content-Disposition')!

    // Non-ASCII chars collapse to underscores and double quotes become single
    // quotes in the ASCII fallback...
    expect(disposition).toContain('filename="r_sum_\'quote.pdf"')
    // ...while the RFC 5987 form preserves the real name, percent-encoded.
    expect(disposition).toContain(
      `filename*=UTF-8''${encodeURIComponent('résumé"quote.pdf')}`
    )
  })
})
