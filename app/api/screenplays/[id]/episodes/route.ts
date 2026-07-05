import { NextResponse } from 'next/server'
import { findScreenplay, upsertEpisode } from '@/lib/screenplays-db'
import { deletePdf, episodeFilename, savePdf } from '@/lib/uploads'
import { parseScreenplayKey, pdfFromForm } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// Add or replace a single episode's attached PDF (matched by season +
// episode number, so this doubles as the "replace" operation).
export async function POST(
  request: Request,
  ctx: RouteContext<'/api/screenplays/[id]/episodes'>
) {
  const { id } = await ctx.params
  const key = parseScreenplayKey(id)
  if (key instanceof NextResponse) return key
  if (key.mediaType !== 'tv') {
    return NextResponse.json(
      { error: 'Only TV shows have per-episode PDFs.' },
      { status: 400 }
    )
  }

  const form = await request.formData().catch(() => null)
  const seasonNumber = Number(form?.get('seasonNumber'))
  const episodeNumber = Number(form?.get('episodeNumber'))
  const name = form?.get('name')

  if (
    !form ||
    !Number.isInteger(seasonNumber) ||
    seasonNumber < 0 ||
    !Number.isInteger(episodeNumber) ||
    episodeNumber < 1 ||
    typeof name !== 'string' ||
    !name
  ) {
    return NextResponse.json(
      { error: 'Request must include seasonNumber, episodeNumber, and name.' },
      { status: 400 }
    )
  }

  const pdf = pdfFromForm(form)
  if (pdf === null) {
    return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 })
  }
  if (pdf === 'invalid') {
    return NextResponse.json({ error: 'Uploaded file must be a PDF.' }, { status: 400 })
  }

  const show = await findScreenplay('tv', key.id)
  if (!show || show.mediaType !== 'tv') {
    return NextResponse.json({ error: 'TV show not found.' }, { status: 404 })
  }

  const existingEpisode = show.episodes.find(
    (e) => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber
  )
  if (existingEpisode) {
    await deletePdf(existingEpisode.pdfName)
  }

  const filename = episodeFilename(show.title, show.year, seasonNumber, episodeNumber)
  await savePdf(filename, pdf)

  const directors = form.getAll('directors').filter((v): v is string => typeof v === 'string')
  const writers = form.getAll('writers').filter((v): v is string => typeof v === 'string')

  const screenplays = await upsertEpisode(key.id, {
    seasonNumber,
    episodeNumber,
    name,
    directors,
    writers,
    pdfName: filename,
  })

  return NextResponse.json({ screenplays })
}
