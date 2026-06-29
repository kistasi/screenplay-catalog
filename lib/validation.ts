import { NextResponse } from 'next/server'

/**
 * Parse a route `[id]` param into a positive-or-any integer. Returns the number,
 * or a ready-to-send 400 response when the param isn't a valid integer.
 */
export function parseRouteId(raw: string): number | NextResponse {
  const id = Number(raw)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }
  return id
}

/**
 * Pull an uploaded PDF off a form. Returns the `File` when a valid PDF is
 * attached, the string `'invalid'` when a file is attached but isn't a PDF,
 * or `null` when no file was attached.
 */
export function pdfFromForm(form: FormData): File | 'invalid' | null {
  const pdf = form.get('pdf')
  if (!(pdf instanceof File) || pdf.size === 0) return null
  if (pdf.type !== 'application/pdf') return 'invalid'
  return pdf
}
