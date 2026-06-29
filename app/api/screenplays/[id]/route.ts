import { NextResponse } from 'next/server'
import { removeScreenplay } from '@/lib/screenplays-db'
import { deletePdf } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/screenplays/[id]'>
) {
  const { id } = await ctx.params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }

  const screenplays = await removeScreenplay(numericId)
  await deletePdf(numericId)

  return NextResponse.json({ screenplays })
}
