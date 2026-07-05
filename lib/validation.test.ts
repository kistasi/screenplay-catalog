import { describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { parseRouteNumber, parseScreenplayKey, pdfFromForm } from './validation'

function pdfFile(name = 'script.pdf', type = 'application/pdf', body = '%PDF') {
  return new File([body], name, { type })
}

describe('parseScreenplayKey', () => {
  it('parses a movie key', () => {
    expect(parseScreenplayKey('movie-42')).toEqual({ mediaType: 'movie', id: 42 })
  })

  it('parses a tv key', () => {
    expect(parseScreenplayKey('tv-1399')).toEqual({ mediaType: 'tv', id: 1399 })
  })

  it('parses zero as a valid id', () => {
    expect(parseScreenplayKey('movie-0')).toEqual({ mediaType: 'movie', id: 0 })
  })

  it('returns a 400 response for an unknown media type', async () => {
    const res = parseScreenplayKey('book-42')
    expect(res).toBeInstanceOf(NextResponse)
    const body = res as NextResponse
    expect(body.status).toBe(400)
    await expect(body.json()).resolves.toEqual({ error: 'Invalid screenplay id.' })
  })

  it('returns a 400 response for a non-integer id', () => {
    expect(parseScreenplayKey('movie-not-a-number')).toBeInstanceOf(NextResponse)
  })

  it('rejects fractional ids', () => {
    expect(parseScreenplayKey('movie-3.5')).toBeInstanceOf(NextResponse)
  })

  it('rejects a key with no separator', () => {
    expect(parseScreenplayKey('42')).toBeInstanceOf(NextResponse)
  })
})

describe('parseRouteNumber', () => {
  it('parses an integer string', () => {
    expect(parseRouteNumber('3', 'season number')).toBe(3)
  })

  it('parses zero', () => {
    expect(parseRouteNumber('0', 'season number')).toBe(0)
  })

  it('returns a 400 response worded with the given label for a non-integer', async () => {
    const res = parseRouteNumber('abc', 'episode number')
    expect(res).toBeInstanceOf(NextResponse)
    const body = res as NextResponse
    expect(body.status).toBe(400)
    await expect(body.json()).resolves.toEqual({ error: 'Invalid episode number.' })
  })

  it('rejects fractional values', () => {
    expect(parseRouteNumber('1.5', 'season number')).toBeInstanceOf(NextResponse)
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
