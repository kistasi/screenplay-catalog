import { NextResponse } from 'next/server'
import {
  findScreenplay,
  removeScreenplay,
  updateMoviePdf,
} from '@/lib/screenplays-db'
import { deletePdf, savePdf, slugify } from '@/lib/uploads'
import { parseScreenplayKey, pdfFromForm } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]'>
) {
  const { id } = await ctx.params
  const key = parseScreenplayKey(id)
  if (key instanceof NextResponse) return key

  const screenplay = await findScreenplay(key.mediaType, key.id)
  const screenplays = await removeScreenplay(key.mediaType, key.id)

  if (screenplay?.mediaType === 'tv') {
    await Promise.all(screenplay.episodes.map((e) => deletePdf(e.pdfName)))
  } else {
    await deletePdf(screenplay?.pdfName ?? null)
  }

  return NextResponse.json({ screenplays })
}

// Add or replace the movie's PDF. TV shows use /episodes instead, since they
// don't have a single PDF slot.
export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/screenplays/[id]'>
) {
  const { id } = await ctx.params
  const key = parseScreenplayKey(id)
  if (key instanceof NextResponse) return key

  const form = await request.formData().catch(() => null)
  const pdf = form ? pdfFromForm(form) : null
  if (pdf === null) {
    return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 })
  }
  if (pdf === 'invalid') {
    return NextResponse.json({ error: 'Uploaded file must be a PDF.' }, { status: 400 })
  }

  const existing = await findScreenplay(key.mediaType, key.id)
  if (!existing) {
    return NextResponse.json({ error: 'Screenplay not found.' }, { status: 404 })
  }
  if (existing.mediaType === 'tv') {
    return NextResponse.json(
      { error: 'TV shows use per-episode PDFs; see /episodes.' },
      { status: 400 }
    )
  }

  await deletePdf(existing.pdfName)
  const filename = `${slugify(existing.title, existing.year)}.pdf`
  await savePdf(filename, pdf)
  const screenplays = await updateMoviePdf(key.id, filename)

  return NextResponse.json({ screenplays })
}
