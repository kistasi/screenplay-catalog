import { NextResponse } from 'next/server'
import { removeEpisode } from '@/lib/screenplays-db'
import { deletePdf } from '@/lib/uploads'
import { parseScreenplayKey } from '@/lib/validation'

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

  const seasonNumber = Number(season)
  const episodeNumber = Number(episode)
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) {
    return NextResponse.json(
      { error: 'Invalid season or episode number.' },
      { status: 400 }
    )
  }

  const { screenplays, removed } = await removeEpisode(key.id, seasonNumber, episodeNumber)
  if (removed) {
    await deletePdf(removed.pdfName)
  }

  return NextResponse.json({ screenplays })
}
