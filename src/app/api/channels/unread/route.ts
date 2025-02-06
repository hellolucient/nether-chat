import { NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { TextChannel } from 'discord.js'

export async function GET(request: Request) {
  try {
    const wallet = request.headers.get('x-wallet-address')
    if (!wallet) {
      return NextResponse.json({ error: 'No wallet address provided' }, { status: 400 })
    }

    // Get user's channel access
    const { data: assignment } = await supabase
      .from('bot_assignments')
      .select('channel_access')
      .eq('wallet_address', wallet)
      .single()

    if (!assignment?.channel_access) {
      return NextResponse.json({ unreadChannels: [] })
    }

    // Get last viewed times for all channels
    const { data: lastViewed } = await supabase
      .from('last_viewed')
      .select('channel_id, last_viewed')
      .eq('wallet_address', wallet)

    // Create a map of channel IDs to last viewed times
    const lastViewedMap = new Map(
      lastViewed?.map(item => [item.channel_id, new Date(item.last_viewed)]) || []
    )

    // Get latest message for each channel
    const { data: latestMessages } = await supabase
      .from('messages')
      .select('channel_id, created_at')
      .in('channel_id', assignment.channel_access)
      .order('created_at', { ascending: false })

    // Initialize array to store unread channel IDs
    const unreadChannels: string[] = []  // Add explicit type here

    // Check each channel for unread messages
    for (const channelId of assignment.channel_access) {
      const lastViewedTime = lastViewedMap.get(channelId) || new Date(0)
      const latestMessage = latestMessages?.find(msg => msg.channel_id === channelId)

      if (latestMessage && new Date(latestMessage.created_at) > lastViewedTime) {
        unreadChannels.push(channelId)
      }
    }

    return NextResponse.json({ unreadChannels })
  } catch (error) {
    console.error('Error checking unread channels:', error)
    return NextResponse.json(
      { error: 'Failed to check unread channels' },
      { status: 500 }
    )
  }
} 