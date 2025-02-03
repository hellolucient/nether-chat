import { NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'

export async function GET() {
  try {
    const client = await getDiscordClient()
    const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID!)
    const channels = await guild.channels.fetch()
    
    // Filter for text channels and format them
    const textChannels = channels
      .filter(channel => 
        channel?.type === 0 && // 0 is text channel
        // Add specific channels you want to show
        ['general', 'gen-chat', 'alpha', 'insiders-only'].includes(channel.name)
      )
      .map(channel => ({
        id: channel.id,
        name: `#${channel.name}`, // Add the # prefix
        type: channel.type
      }))

    return NextResponse.json({ channels: textChannels })
  } catch (error) {
    console.error('Error fetching channels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
} 