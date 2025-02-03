import { NextResponse } from 'next/server'
import { sendMessage, getChannels } from '@/lib/discord'

export async function GET(request: Request) {
  try {
    // Get all text channels
    const channels = await getChannels(process.env.DISCORD_SERVER_ID!)
    
    if (channels.length === 0) {
      return NextResponse.json({ error: 'No channels found' }, { status: 404 })
    }

    // Return the channels
    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
} 