import { NextResponse } from 'next/server'
import { getSeasonEpisodes, TmdbError } from '@/lib/tmdb'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/tmdb/tv/[id]/season/[season]'>
) {
  const { id, season } = await ctx.params
  const showId = Number(id)
  const seasonNumber = Number(season)
  if (!Number.isInteger(showId) || !Number.isInteger(seasonNumber)) {
    return NextResponse.json(
      { error: 'Invalid show id or season number.' },
      { status: 400 }
    )
  }

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
