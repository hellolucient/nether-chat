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

    // Get user's bot info
    const { data: botAssignment } = await supabase
      .from('bot_assignments')
      .select(`
        channel_access,
        discord_bots (
          bot_name,
          bot_id
        )
      `)
      .eq('wallet_address', wallet)
      .single()

    if (!botAssignment?.discord_bots) {
      return NextResponse.json({ unreadChannels: [] })
    }

    const botId = botAssignment.discord_bots.bot_id
    const botName = botAssignment.discord_bots.bot_name

    // Get messages that either:
    // 1. Contains a mention of our bot (<@botId>)
    // 2. Is a reply to our bot's message
    console.log('🔍 Checking for mentions/replies:', {
      botId,
      botName,
      channels: botAssignment.channel_access,
      mentionFormat: `<@${botId}>` // This is how Discord formats mentions
    })

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .in('channel_id', botAssignment.channel_access)
      .or(`content.ilike.%<@${botId}>%,referenced_message_author_id.eq.${botId}`)
      .order('sent_at', { ascending: false })

    console.log('📨 Found messages:', {
      count: messages?.length || 0,
      messages: messages?.map(m => ({
        id: m.id,
        content: m.content.substring(0, 50),
        mentions_bot: m.content.includes(`<@${botId}>`),
        replies_to_bot: m.referenced_message_author_id === botId,
        channel: m.channel_id
      }))
    })

    // Get last viewed times
    const { data: lastViewed } = await supabase
      .from('last_viewed')
      .select('*')
      .eq('wallet_address', wallet)

    const lastViewedMap = new Map(
      lastViewed?.map(item => [item.channel_id, new Date(item.last_viewed)]) || []
    )

    // Check which channels have unread mentions/replies
    const unreadChannels = messages?.reduce((acc: string[], msg) => {
      const lastViewedTime = lastViewedMap.get(msg.channel_id) || new Date(0)
      if (new Date(msg.sent_at) > lastViewedTime) {
        acc.push(msg.channel_id)
      }
      return acc
    }, [])

    return NextResponse.json({ unreadChannels })
  } catch (error) {
    console.error('Error checking unread channels:', error)
    return NextResponse.json(
      { error: 'Failed to check unread channels' },
      { status: 500 }
    )
  }
} 