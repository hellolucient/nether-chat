import { NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'

// Add this to mark the route as dynamic
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 API: /api/channels called')
    const client = await getDiscordClient()
    console.log('🔍 API: Got Discord client')
    
    const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID!)
    console.log('🔍 API: Got guild:', guild.name)
    
    const channels = await guild.channels.fetch()
    console.log('🔍 API: Got channels:', channels.size)

    const textChannels = channels
      .filter(channel => channel?.type === 0)  // 0 is GUILD_TEXT
      .map(channel => ({
        id: channel!.id,
        name: channel!.name
      }))

    const result = Array.from(textChannels.values())
    console.log('🔍 API: Returning channels:', result)

    return NextResponse.json({ channels: result })
  } catch (error) {
    console.error('❌ API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
} 