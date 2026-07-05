import { NextResponse } from 'next/server'
import { findScreenplay } from '@/lib/screenplays-db'
import { pdfResponse, readPdf } from '@/lib/uploads'
import { parseRouteNumber, parseScreenplayKey } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]/episodes/[season]/[episode]/pdf'>
) {
  const { id, season, episode } = await ctx.params
  const key = parseScreenplayKey(id)
  if (key instanceof NextResponse) return key

  const seasonNumber = parseRouteNumber(season, 'season number')
  if (seasonNumber instanceof NextResponse) return seasonNumber
  const episodeNumber = parseRouteNumber(episode, 'episode number')
  if (episodeNumber instanceof NextResponse) return episodeNumber

  const show = await findScreenplay(key.mediaType, key.id)
  const episodeRecord =
    show?.mediaType === 'tv'
      ? show.episodes.find(
          (e) => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber
        )
      : undefined

  const filename = episodeRecord?.pdfName ?? null
  const pdf = await readPdf(filename)
  if (!pdf || !filename) {
    return NextResponse.json({ error: 'No PDF found.' }, { status: 404 })
  }

  return pdfResponse(filename, pdf)
}
