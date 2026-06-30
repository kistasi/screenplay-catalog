import { NextResponse } from 'next/server'
import {
  findScreenplay,
  removeScreenplay,
  updateScreenplay,
} from '@/lib/screenplays-db'
import { deletePdf, savePdf, slugify } from '@/lib/uploads'
import { parseRouteId, pdfFromForm } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]'>
) {
  const { id } = await ctx.params
  const numericId = parseRouteId(id)
  if (numericId instanceof NextResponse) return numericId

  const screenplay = await findScreenplay(numericId)
  const screenplays = await removeScreenplay(numericId)
  await deletePdf(screenplay?.pdfName ?? null)

  return NextResponse.json({ screenplays })
}

// Add or replace the screenplay's PDF.
export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/screenplays/[id]'>
) {
  const { id } = await ctx.params
  const numericId = parseRouteId(id)
  if (numericId instanceof NextResponse) return numericId

  const form = await request.formData().catch(() => null)
  const pdf = form ? pdfFromForm(form) : null
  if (pdf === null) {
    return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 })
  }
  if (pdf === 'invalid') {
    return NextResponse.json({ error: 'Uploaded file must be a PDF.' }, { status: 400 })
  }

  const existing = await findScreenplay(numericId)
  if (!existing) {
    return NextResponse.json({ error: 'Screenplay not found.' }, { status: 404 })
  }

  await deletePdf(existing.pdfName)
  const filename = `${slugify(existing.title, existing.year)}.pdf`
  await savePdf(filename, pdf)
  const screenplays = await updateScreenplay(numericId, { pdfName: filename })

  return NextResponse.json({ screenplays })
}
