import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'
import { addScreenplay, getScreenplays } from '@/lib/screenplays-db'
import { getScreenplay, TmdbError } from '@/lib/tmdb'
import { savePdf } from '@/lib/uploads'

vi.mock('@/lib/screenplays-db', () => ({
  getScreenplays: vi.fn(),
  addScreenplay: vi.fn(),
}))
vi.mock('@/lib/uploads', () => ({ savePdf: vi.fn() }))
vi.mock('@/lib/tmdb', async () => {
  // Keep the real TmdbError so `instanceof` checks in the route hold.
  const actual = await vi.importActual<typeof import('@/lib/tmdb')>('@/lib/tmdb')
  return { ...actual, getScreenplay: vi.fn() }
})

const mockGetScreenplays = vi.mocked(getScreenplays)
const mockAddScreenplay = vi.mocked(addScreenplay)
const mockGetScreenplay = vi.mocked(getScreenplay)
const mockSavePdf = vi.mocked(savePdf)

const sampleScreenplay = {
  id: 603,
  title: 'The Matrix',
  year: '1999',
  directors: ['Lana Wachowski'],
  writers: ['Lilly Wachowski'],
  posterUrl: null,
  pdfName: null,
}

function postRequest(form: FormData) {
  return new NextRequest('http://localhost/api/screenplays', {
    method: 'POST',
    body: form,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/screenplays', () => {
  it('returns the stored screenplays', async () => {
    mockGetScreenplays.mockResolvedValue([sampleScreenplay])
    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ screenplays: [sampleScreenplay] })
  })
})

describe('POST /api/screenplays', () => {
  it('rejects a request with no id', async () => {
    const res = await POST(postRequest(new FormData()))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('TMDB'),
    })
    expect(mockGetScreenplay).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric id', async () => {
    const form = new FormData()
    form.set('id', 'abc')
    const res = await POST(postRequest(form))
    expect(res.status).toBe(400)
  })

  it('rejects a non-positive id', async () => {
    const form = new FormData()
    form.set('id', '0')
    const res = await POST(postRequest(form))
    expect(res.status).toBe(400)
  })

  it('rejects a non-PDF upload before contacting TMDB', async () => {
    const form = new FormData()
    form.set('id', '603')
    form.set('pdf', new File(['x'], 'notes.txt', { type: 'text/plain' }))
    const res = await POST(postRequest(form))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Uploaded file must be a PDF.',
    })
    expect(mockGetScreenplay).not.toHaveBeenCalled()
  })

  it('adds a screenplay without a PDF', async () => {
    mockGetScreenplay.mockResolvedValue({ ...sampleScreenplay })
    mockAddScreenplay.mockResolvedValue([sampleScreenplay])
    const form = new FormData()
    form.set('id', '603')

    const res = await POST(postRequest(form))

    expect(res.status).toBe(200)
    expect(mockGetScreenplay).toHaveBeenCalledWith(603)
    expect(mockSavePdf).not.toHaveBeenCalled()
    expect(mockAddScreenplay).toHaveBeenCalledWith(
      expect.objectContaining({ id: 603, pdfName: null })
    )
    await expect(res.json()).resolves.toEqual({ screenplays: [sampleScreenplay] })
  })

  it('saves the PDF and records its filename when one is attached', async () => {
    mockGetScreenplay.mockResolvedValue({ ...sampleScreenplay })
    mockAddScreenplay.mockResolvedValue([
      { ...sampleScreenplay, pdfName: 'script.pdf' },
    ])
    const form = new FormData()
    form.set('id', '603')
    form.set('pdf', new File(['%PDF'], 'script.pdf', { type: 'application/pdf' }))

    const res = await POST(postRequest(form))

    expect(res.status).toBe(200)
    expect(mockSavePdf).toHaveBeenCalledWith(603, expect.any(File))
    expect(mockAddScreenplay).toHaveBeenCalledWith(
      expect.objectContaining({ pdfName: 'script.pdf' })
    )
  })

  it('maps a TmdbError to its HTTP status and message', async () => {
    mockGetScreenplay.mockRejectedValue(new TmdbError('No film found.', 404))
    const form = new FormData()
    form.set('id', '999')

    const res = await POST(postRequest(form))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'No film found.' })
  })

  it('rethrows non-TmdbError failures', async () => {
    mockGetScreenplay.mockRejectedValue(new Error('disk on fire'))
    const form = new FormData()
    form.set('id', '603')
    await expect(POST(postRequest(form))).rejects.toThrow('disk on fire')
  })
})
