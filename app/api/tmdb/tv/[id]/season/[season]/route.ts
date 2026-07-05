import { NextResponse } from 'next/server'
import { getSeasonEpisodes, TmdbError } from '@/lib/tmdb'
import { parseRouteNumber } from '@/lib/validation'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/tmdb/tv/[id]/season/[season]'>
) {
  const { id, season } = await ctx.params
  const showId = parseRouteNumber(id, 'show id')
  if (showId instanceof NextResponse) return showId
  const seasonNumber = parseRouteNumber(season, 'season number')
  if (seasonNumber instanceof NextResponse) return seasonNumber

  try {
    const episodes = await getSeasonEpisodes(showId, seasonNumber)
    return NextResponse.json({ episodes })
  } catch (err) {
    if (err instanceof TmdbError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
