import { NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { TextChannel } from 'discord.js'

// Add type for messages
interface DBMessage {
  id: string
  channel_id: string
  sender_id: string
  content: string
  sent_at: string
}

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

    // Add debug logging
    console.log('Checking unread messages for channels:', assignment.channel_access)

    // Get messages from Supabase (not Discord)
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .in('channel_id', assignment.channel_access)
      .order('sent_at', { ascending: false }) as { 
        data: DBMessage[] | null, 
        error: any 
      }

    console.log('🔍 All messages in DB:', {
      total: messages?.length || 0,
      byChannel: messages?.reduce((acc, msg) => {
        acc[msg.channel_id] = (acc[msg.channel_id] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      latestByChannel: messages ? Object.fromEntries(
        Object.entries(
          messages.reduce((acc, msg) => {
            if (!acc[msg.channel_id] || new Date(msg.sent_at) > new Date(acc[msg.channel_id].sent_at)) {
              acc[msg.channel_id] = msg
            }
            return acc
          }, {} as Record<string, DBMessage>)
        ).map(([channel, msg]) => [channel, {
          id: msg.id,
          sent_at: msg.sent_at
        }])
      ) : {}
    })

    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to check unread channels' }, { status: 500 })
    }

    // Get last viewed times
    const { data: lastViewed } = await supabase
      .from('last_viewed')
      .select('*')
      .eq('wallet_address', wallet)

    console.log('Last viewed entries:', lastViewed)

    // Create a map of channel IDs to last viewed times
    const lastViewedMap = new Map(
      lastViewed?.map(item => [item.channel_id, new Date(item.last_viewed)]) || []
    )

    // Check each channel for unread messages
    const unreadChannels = assignment.channel_access.filter(channelId => {
      const lastViewedTime = lastViewedMap.get(channelId) || new Date(0)
      const latestMessage = messages?.find(msg => msg.channel_id === channelId)
      
      console.log('🔍 Checking channel:', {
        channelId,
        lastViewed: lastViewedTime,
        latestMessage: latestMessage ? {
          id: latestMessage.id,
          sent_at: latestMessage.sent_at,
          isNewer: new Date(latestMessage.sent_at) > lastViewedTime
        } : null
      })
      
      return latestMessage && new Date(latestMessage.sent_at) > lastViewedTime
    })

    return NextResponse.json({ unreadChannels })
  } catch (error) {
    console.error('Error checking unread channels:', error)
    return NextResponse.json(
      { error: 'Failed to check unread channels' },
      { status: 500 }
    )
  }
} 