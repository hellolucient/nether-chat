import { NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { TextChannel } from 'discord.js'

// Update interfaces at top of file
interface DiscordBot {
  discord_id: string
}

interface BotAssignment {
  discord_bots: {
    discord_id: string
  }
}

interface LastViewed {
  channel_id: string
  last_viewed: string
}

interface Message {
  channel_id: string
  sent_at: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    console.log('🔎 Checking unread for wallet:', wallet)

    if (!wallet) {
      return NextResponse.json({ error: 'No wallet address provided' }, { status: 400 })
    }

    // Get user's bot ID first
    const { data: botAssignment } = await supabase
      .from('bot_assignments')
      .select(`
        discord_bots (
          discord_id
        )
      `)
      .eq('wallet_address', wallet)
      .single() as unknown as { data: { discord_bots: { discord_id: string } } }

    if (!botAssignment?.discord_bots?.discord_id) {
      return NextResponse.json({ unreadChannels: [] })
    }

    const botId = botAssignment.discord_bots.discord_id

    console.log('🤖 Found bot:', {
      wallet,
      botId: botAssignment.discord_bots.discord_id
    })

    // Get last viewed timestamps for this wallet
    const { data: lastViewed } = await supabase
      .from('last_viewed')
      .select('channel_id, last_viewed')
      .eq('wallet_address', wallet)

    // Create map of last viewed times
    const lastViewedMap = new Map(
      lastViewed?.map(item => [item.channel_id, item.last_viewed]) || []
    )

    console.log('👀 Last viewed times:', {
      wallet,
      lastViewed: Array.from(lastViewedMap.entries())
    })

    // Get messages that are bot-related (from/mentions/replies to bot)
    const { data: messages } = await supabase
      .from('messages')
      .select('channel_id, sent_at')
      .or(`sender_id.eq.${botId},referenced_message_author_id.eq.${botId},content.ilike.%<@${botId}>%`)
      .order('sent_at', { ascending: false })

    // Check which channels have unread messages
    const unreadChannels = messages?.reduce((acc: string[], msg) => {
      const lastViewedTime = lastViewedMap.get(msg.channel_id) || '1970-01-01'
      if (new Date(msg.sent_at) > new Date(lastViewedTime) && !acc.includes(msg.channel_id)) {
        acc.push(msg.channel_id)
      }
      return acc
    }, []) || []

    console.log('📨 Found messages:', {
      total: messages?.length || 0,
      messages: messages?.map(m => ({
        channel: m.channel_id,
        sent: m.sent_at
      }))
    })

    console.log('🟣 Unread channels:', unreadChannels)

    return NextResponse.json({ unreadChannels })
  } catch (error) {
    console.error('❌ Error checking unread:', error)
    return NextResponse.json({ error: 'Failed to check unread' }, { status: 500 })
  }
} 