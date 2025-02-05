import { NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'

// Add this to mark the route as dynamic
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 Fetching Discord client...')
    const client = await getDiscordClient()
    
    console.log('🔍 Fetching guild with ID:', process.env.DISCORD_SERVER_ID)
    const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID!)
    
    console.log('🔍 Fetching channels...')
    const channels = await guild.channels.fetch()

    console.log('🔍 Found channels:', channels.size)
    const textChannels = channels
      .filter(channel => {
        console.log('Channel:', channel?.name, 'Type:', channel?.type)
        return channel?.type === 0  // 0 is GUILD_TEXT
      })
      .map(channel => ({
        id: channel!.id,
        name: channel!.name
      }))

    const result = Array.from(textChannels.values())
    console.log('🔍 Returning channels:', result)

    return NextResponse.json({ channels: result })
  } catch (error) {
    // More detailed error logging
    console.error('Error fetching channels:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      guildId: process.env.DISCORD_SERVER_ID,
      botToken: process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not set'
    })

    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
} 