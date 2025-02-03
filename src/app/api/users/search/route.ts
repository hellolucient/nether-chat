import { NextResponse } from 'next/server'
import { searchUsers } from '@/lib/discord'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ users: [] })
  }

  try {
    const users = await searchUsers(query)
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error searching users:', error)
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 })
  }
} 