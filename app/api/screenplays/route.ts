import { NextRequest, NextResponse } from 'next/server'
import { addScreenplay, getScreenplays } from '@/lib/screenplays-db'
import { getScreenplay, TmdbError } from '@/lib/tmdb'

// This route reads/writes the filesystem, so it must run per-request.
export const dynamic = 'force-dynamic'

export async function GET() {
  const screenplays = await getScreenplays()
  return NextResponse.json({ screenplays })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const id = body?.id

  if (typeof id !== 'number') {
    return NextResponse.json(
      { error: 'Request body must include a numeric TMDB `id`.' },
      { status: 400 }
    )
  }

  try {
    // Resolve full details (incl. director/writer credits) from TMDB, then store.
    const screenplay = await getScreenplay(id)
    const screenplays = await addScreenplay(screenplay)
    return NextResponse.json({ screenplays })
  } catch (err) {
    if (err instanceof TmdbError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
