import { NextResponse } from 'next/server'
import { removeEpisode } from '@/lib/screenplays-db'
import { deletePdf } from '@/lib/uploads'
import { parseRouteNumber, parseScreenplayKey } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]/episodes/[season]/[episode]'>
) {
  const { id, season, episode } = await ctx.params
  const key = parseScreenplayKey(id)
  if (key instanceof NextResponse) return key
  if (key.mediaType !== 'tv') {
    return NextResponse.json(
      { error: 'Only TV shows have per-episode PDFs.' },
      { status: 400 }
    )
  }

  const seasonNumber = parseRouteNumber(season, 'season number')
  if (seasonNumber instanceof NextResponse) return seasonNumber
  const episodeNumber = parseRouteNumber(episode, 'episode number')
  if (episodeNumber instanceof NextResponse) return episodeNumber

  const { screenplays, removed } = await removeEpisode(key.id, seasonNumber, episodeNumber)
  if (removed) {
    await deletePdf(removed.pdfName)
  }

  return NextResponse.json({ screenplays })
}
