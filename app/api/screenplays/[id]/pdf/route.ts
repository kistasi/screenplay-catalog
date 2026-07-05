import { NextResponse } from 'next/server'
import { findScreenplay } from '@/lib/screenplays-db'
import { pdfResponse, readPdf } from '@/lib/uploads'
import { parseScreenplayKey } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]/pdf'>
) {
  const { id } = await ctx.params
  const key = parseScreenplayKey(id)
  if (key instanceof NextResponse) return key

  const screenplay = await findScreenplay(key.mediaType, key.id)
  const filename = screenplay?.mediaType === 'movie' ? screenplay.pdfName : null
  const pdf = await readPdf(filename)
  if (!pdf || !filename) {
    return NextResponse.json({ error: 'No PDF found.' }, { status: 404 })
  }

  return pdfResponse(filename, pdf)
}
