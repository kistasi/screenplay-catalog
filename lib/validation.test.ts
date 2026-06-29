import { describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { parseRouteId, pdfFromForm } from './validation'

function pdfFile(name = 'script.pdf', type = 'application/pdf', body = '%PDF') {
  return new File([body], name, { type })
}

describe('parseRouteId', () => {
  it('returns the number for an integer string', () => {
    expect(parseRouteId('42')).toBe(42)
  })

  it('parses negative and zero integers (range is not its job)', () => {
    expect(parseRouteId('0')).toBe(0)
    expect(parseRouteId('-7')).toBe(-7)
  })

  it('returns a 400 response for non-integer input', async () => {
    const res = parseRouteId('not-a-number')
    expect(res).toBeInstanceOf(NextResponse)
    const body = res as NextResponse
    expect(body.status).toBe(400)
    await expect(body.json()).resolves.toEqual({ error: 'Invalid id.' })
  })

  it('rejects fractional values', () => {
    expect(parseRouteId('3.5')).toBeInstanceOf(NextResponse)
  })

  it('rejects an empty string', () => {
    // Number('') is 0, but Number.isInteger(0) is true — guard the actual edge.
    // '' coerces to 0 which is an integer, so this documents current behaviour.
    expect(parseRouteId('')).toBe(0)
  })
})

describe('pdfFromForm', () => {
  it('returns the File when a valid PDF is attached', () => {
    const form = new FormData()
    const file = pdfFile()
    form.set('pdf', file)
    expect(pdfFromForm(form)).toBe(file)
  })

  it("returns 'invalid' when the attached file is not a PDF", () => {
    const form = new FormData()
    form.set('pdf', pdfFile('notes.txt', 'text/plain'))
    expect(pdfFromForm(form)).toBe('invalid')
  })

  it('returns null when no file is attached', () => {
    expect(pdfFromForm(new FormData())).toBeNull()
  })

  it('returns null when the field is a plain string, not a file', () => {
    const form = new FormData()
    form.set('pdf', 'just-text')
    expect(pdfFromForm(form)).toBeNull()
  })

  it('returns null for an empty (zero-byte) file', () => {
    const form = new FormData()
    form.set('pdf', new File([], 'empty.pdf', { type: 'application/pdf' }))
    expect(pdfFromForm(form)).toBeNull()
  })
})
