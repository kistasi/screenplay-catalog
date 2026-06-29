import { NextResponse } from 'next/server'
import {
  findScreenplay,
  removeScreenplay,
  updateScreenplay,
} from '@/lib/screenplays-db'
import { deletePdf, savePdf } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]'>
) {
  const { id } = await ctx.params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }

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
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }

  const form = await request.formData().catch(() => null)
  const pdf = form?.get('pdf')
  if (!(pdf instanceof File) || pdf.size === 0) {
    return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 })
  }
  if (pdf.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Uploaded file must be a PDF.' }, { status: 400 })
  }

  if (!(await findScreenplay(numericId))) {
    return NextResponse.json({ error: 'Screenplay not found.' }, { status: 404 })
  }

  await savePdf(numericId, pdf)
  const screenplays = await updateScreenplay(numericId, { pdfName: pdf.name })

  return NextResponse.json({ screenplays })
}
