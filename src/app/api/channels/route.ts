import { NextResponse } from 'next/server'
import { Client, GatewayIntentBits } from 'discord.js'

// Add this to mark the route as dynamic
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Initialize Discord client
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ]
    })

    // Login with bot token
    await client.login(process.env.DISCORD_BOT_TOKEN)

    // Wait for client to be ready
    await new Promise((resolve) => {
      if (client.isReady()) resolve(true)
      else client.once('ready', () => resolve(true))
    })

    // Get the guild (server)
    const guild = client.guilds.cache.first()
    if (!guild) {
      throw new Error('No guild found')
    }

    // Get all text channels
    const channels = await guild.channels.fetch()
    const textChannels = channels
      .filter(channel => channel?.type === 0) // 0 is GUILD_TEXT
      .map(channel => ({
        id: channel?.id,
        name: channel?.name
      }))

    // Cleanup
    client.destroy()

    return NextResponse.json({ channels: textChannels })
  } catch (error) {
    console.error('Error fetching channels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
} 