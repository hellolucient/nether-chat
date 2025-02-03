import { NextResponse } from 'next/server'
import { disconnectClient } from '@/lib/discord'

export async function POST() {
  try {
    await disconnectClient()
    return NextResponse.json({ message: 'Discord client disconnected' })
  } catch (error) {
    console.error('Error disconnecting client:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect client' },
      { status: 500 }
    )
  }
} 