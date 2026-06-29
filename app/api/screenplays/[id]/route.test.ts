import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from './route'
import {
  findScreenplay,
  removeScreenplay,
  updateScreenplay,
} from '@/lib/screenplays-db'
import { deletePdf, savePdf } from '@/lib/uploads'

vi.mock('@/lib/screenplays-db', () => ({
  findScreenplay: vi.fn(),
  removeScreenplay: vi.fn(),
  updateScreenplay: vi.fn(),
}))
vi.mock('@/lib/uploads', () => ({ savePdf: vi.fn(), deletePdf: vi.fn() }))

const mockFind = vi.mocked(findScreenplay)
const mockRemove = vi.mocked(removeScreenplay)
const mockUpdate = vi.mocked(updateScreenplay)
const mockSavePdf = vi.mocked(savePdf)
const mockDeletePdf = vi.mocked(deletePdf)

const sample = {
  id: 1,
  title: 'The Matrix',
  year: '1999',
  directors: [],
  writers: [],
  posterUrl: null,
  pdfName: null,
}

// The route reads ctx.params (a promise) for the dynamic [id] segment.
function ctx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof DELETE>[1]
}

function patchRequest(form: FormData | null) {
  return new Request('http://localhost/api/screenplays/1', {
    method: 'PATCH',
    ...(form ? { body: form } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DELETE /api/screenplays/[id]', () => {
  it('removes the screenplay and its PDF', async () => {
    mockRemove.mockResolvedValue([])
    const res = await DELETE(new Request('http://localhost'), ctx('1'))

    expect(res.status).toBe(200)
    expect(mockRemove).toHaveBeenCalledWith(1)
    expect(mockDeletePdf).toHaveBeenCalledWith(1)
    await expect(res.json()).resolves.toEqual({ screenplays: [] })
  })

  it('rejects an invalid id with 400 and touches nothing', async () => {
    const res = await DELETE(new Request('http://localhost'), ctx('abc'))
    expect(res.status).toBe(400)
    expect(mockRemove).not.toHaveBeenCalled()
    expect(mockDeletePdf).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/screenplays/[id]', () => {
  function pdfForm(name = 'script.pdf', type = 'application/pdf') {
    const form = new FormData()
    form.set('pdf', new File(['%PDF'], name, { type }))
    return form
  }

  it('rejects an invalid id with 400', async () => {
    const res = await PATCH(patchRequest(pdfForm()), ctx('abc'))
    expect(res.status).toBe(400)
    expect(mockSavePdf).not.toHaveBeenCalled()
  })

  it('requires a PDF in the form', async () => {
    const res = await PATCH(patchRequest(new FormData()), ctx('1'))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'A PDF file is required.' })
  })

  it('rejects a non-PDF upload', async () => {
    const res = await PATCH(patchRequest(pdfForm('notes.txt', 'text/plain')), ctx('1'))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Uploaded file must be a PDF.',
    })
  })

  it('404s when the screenplay does not exist', async () => {
    mockFind.mockResolvedValue(undefined)
    const res = await PATCH(patchRequest(pdfForm()), ctx('1'))
    expect(res.status).toBe(404)
    expect(mockSavePdf).not.toHaveBeenCalled()
  })

  it('saves the PDF and records the new filename', async () => {
    mockFind.mockResolvedValue(sample)
    mockUpdate.mockResolvedValue([{ ...sample, pdfName: 'script.pdf' }])

    const res = await PATCH(patchRequest(pdfForm()), ctx('1'))

    expect(res.status).toBe(200)
    expect(mockSavePdf).toHaveBeenCalledWith(1, expect.any(File))
    expect(mockUpdate).toHaveBeenCalledWith(1, { pdfName: 'script.pdf' })
    await expect(res.json()).resolves.toEqual({
      screenplays: [{ ...sample, pdfName: 'script.pdf' }],
    })
  })
})
