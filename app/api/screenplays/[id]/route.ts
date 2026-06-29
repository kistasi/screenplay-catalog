import { NextResponse } from 'next/server'
import {
  findScreenplay,
  removeScreenplay,
  updateScreenplay,
} from '@/lib/screenplays-db'
import { deletePdf, savePdf } from '@/lib/uploads'
import { parseRouteId, pdfFromForm } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]'>
) {
  const { id } = await ctx.params
  const numericId = parseRouteId(id)
  if (numericId instanceof NextResponse) return numericId

  const screenplays = await removeScreenplay(numericId)
  await deletePdf(numericId)

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

  if (!(await findScreenplay(numericId))) {
    return NextResponse.json({ error: 'Screenplay not found.' }, { status: 404 })
  }

  await savePdf(numericId, pdf)
  const screenplays = await updateScreenplay(numericId, { pdfName: pdf.name })

  return NextResponse.json({ screenplays })
}
