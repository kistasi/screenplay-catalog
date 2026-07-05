import { NextResponse } from 'next/server'
import { findScreenplay } from '@/lib/screenplays-db'
import { pdfResponse, readPdf } from '@/lib/uploads'
import { parseScreenplayKey } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]/episodes/[season]/[episode]/pdf'>
) {
  const { id, season, episode } = await ctx.params
  const key = parseScreenplayKey(id)
  if (key instanceof NextResponse) return key

  const seasonNumber = Number(season)
  const episodeNumber = Number(episode)
  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) {
    return NextResponse.json(
      { error: 'Invalid season or episode number.' },
      { status: 400 }
    )
  }

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
