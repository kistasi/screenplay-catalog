import { NextResponse } from 'next/server'
import { findScreenplay } from '@/lib/screenplays-db'
import { readPdf } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]/pdf'>
) {
  const { id } = await ctx.params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }

  const pdf = await readPdf(numericId)
  if (!pdf) {
    return NextResponse.json({ error: 'No PDF found.' }, { status: 404 })
  }

  // Serve under the original uploaded filename when we have it.
  const screenplay = await findScreenplay(numericId)
  const filename = screenplay?.pdfName ?? `${numericId}.pdf`

  // Provide an ASCII fallback plus an RFC 5987 encoded name so filenames with
  // spaces or non-ASCII characters survive.
  const asciiName = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'")
  const disposition = `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
    filename
  )}`

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
    },
  })
}
