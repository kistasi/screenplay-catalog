import { NextResponse } from 'next/server'
import { getTvSeasons, TmdbError } from '@/lib/tmdb'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/tmdb/tv/[id]/seasons'>
) {
  const { id } = await ctx.params
  const showId = Number(id)
  if (!Number.isInteger(showId)) {
    return NextResponse.json({ error: 'Invalid show id.' }, { status: 400 })
  }

  try {
    const seasons = await getTvSeasons(showId)
    return NextResponse.json({ seasons })
  } catch (err) {
    if (err instanceof TmdbError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
