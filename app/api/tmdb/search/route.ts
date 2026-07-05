import { NextRequest, NextResponse } from 'next/server'
import { searchTitles, TmdbError } from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim()
  if (!query) {
    return NextResponse.json({ results: [] })
  }

  try {
    const results = await searchTitles(query)
    return NextResponse.json({ results })
  } catch (err) {
    if (err instanceof TmdbError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
