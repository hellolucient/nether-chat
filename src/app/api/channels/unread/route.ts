import { NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { TextChannel } from 'discord.js'

export async function GET(request: Request) {
  try {
    // Get the wallet from the query params
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    if (!wallet) {
      return NextResponse.json({ error: 'No wallet provided' }, { status: 400 })
    }

    // Get user's channels
    const { data: assignment } = await supabase
      .from('bot_assignments')
      .select('channel_access')
      .eq('wallet_address', wallet)
      .single()

    if (!assignment?.channel_access) {
      return NextResponse.json({ unreadChannels: [] })
    }

    // Get last viewed timestamps for all channels
    const { data: lastViewed } = await supabase
      .from('last_viewed')
      .select('channel_id, last_viewed')
      .eq('wallet_address', wallet)

    const lastViewedMap = new Map(
      lastViewed?.map(lv => [lv.channel_id, new Date(lv.last_viewed)]) || []
    )

    // Check each channel for new messages
    const client = await getDiscordClient()
    const unreadChannels = []

    for (const channelId of assignment.channel_access) {
      const channel = await client.channels.fetch(channelId)
      if (!(channel instanceof TextChannel)) continue

      const lastViewedTime = lastViewedMap.get(channelId) || new Date(0)
      const messages = await channel.messages.fetch({ limit: 1 })
      const latestMessage = messages.first()

      if (latestMessage && new Date(latestMessage.createdAt) > lastViewedTime) {
        unreadChannels.push(channelId)
      }
    }

    return NextResponse.json({ unreadChannels })
  } catch (error) {
    console.error('Failed to check unread channels:', error)
    return NextResponse.json({ error: 'Failed to check unread channels' }, { status: 500 })
  }
} 