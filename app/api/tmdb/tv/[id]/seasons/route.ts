import { NextResponse } from 'next/server'
import { getTvSeasons, TmdbError } from '@/lib/tmdb'
import { parseRouteNumber } from '@/lib/validation'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/tmdb/tv/[id]/seasons'>
) {
  const { id } = await ctx.params
  const showId = parseRouteNumber(id, 'show id')
  if (showId instanceof NextResponse) return showId

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
