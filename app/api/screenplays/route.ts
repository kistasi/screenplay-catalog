import { NextRequest, NextResponse } from 'next/server'
import { addScreenplay, getScreenplays } from '@/lib/screenplays-db'
import { getScreenplay, TmdbError } from '@/lib/tmdb'
import { savePdf } from '@/lib/uploads'
import { pdfFromForm } from '@/lib/validation'

// This route reads/writes the filesystem, so it must run per-request.
export const dynamic = 'force-dynamic'

export async function GET() {
  const screenplays = await getScreenplays()
  return NextResponse.json({ screenplays })
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const rawId = form?.get('id')
  const id = Number(rawId)

  if (!form || typeof rawId !== 'string' || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: 'Request must include a positive numeric TMDB `id`.' },
      { status: 400 }
    )
  }

  const pdf = pdfFromForm(form)
  if (pdf === 'invalid') {
    return NextResponse.json(
      { error: 'Uploaded file must be a PDF.' },
      { status: 400 }
    )
  }

  try {
    // Resolve full details (incl. director/writer credits) from TMDB.
    const screenplay = await getScreenplay(id)

    if (pdf) {
      await savePdf(id, pdf)
      screenplay.pdfName = pdf.name
    }

    const screenplays = await addScreenplay(screenplay)
    return NextResponse.json({ screenplays })
  } catch (err) {
    if (err instanceof TmdbError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
