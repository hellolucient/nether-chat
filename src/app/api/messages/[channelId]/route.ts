import { NextRequest, NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { 
  TextChannel, 
  Message as DiscordMessage, 
  EmbedType,
  Sticker
} from 'discord.js'
import { Message } from '@/types' // Import our Message type
import { Client } from 'discord.js'

// Define the context type exactly as Next.js expects
type Context = {
  params: {
    channelId: string
  }
}

// Add type for bot data
type BotData = {
  discord_id: string
  bot_name: string
}

// Helper function to transform Discord message to our format
function transformDiscordMessage(msg: DiscordMessage, bots: BotData[]): Message {
  // Add debug log with distinctive icon
  console.log('⚡ Message Transform:', {
    id: msg.id,
    authorId: msg.author.id,
    bots: bots.map(b => b.discord_id)
  })

  const isFromBot = bots.some(bot => bot.discord_id === msg.author.id)
  const isBotMention = msg.mentions.users.some(user => 
    bots.some(bot => bot.discord_id === user.id)
  )
  const replyingToBot = msg.reference?.messageId ? 
    bots.some(bot => bot.discord_id === msg.reference?.messageId) : 
    false

  // Add debug log for flags with distinctive icon
  console.log('⛳ Flag Check:', {
    id: msg.id,
    isFromBot,
    isBotMention,
    replyingToBot
  })

  // Get referenced message author if it exists
  let referencedAuthorId: string | null = null
  let referencedContent: string | null = null
  if (msg.reference?.messageId) {
    const referencingBot = bots.find(bot => 
      msg.reference && bot.discord_id === msg.reference.messageId
    )
    if (referencingBot) {
      referencedAuthorId = referencingBot.discord_id
    }
  }

  // Get the raw Discord message timestamp before transformation
  const timestamp = msg.createdAt.toISOString()

  return {
    id: msg.id,
    content: msg.content,
    channel_id: msg.channelId,
    sender_id: msg.author.id,
    author_username: msg.author.username,
    author_display_name: msg.member?.displayName || msg.author.displayName || msg.author.username,
    sent_at: timestamp,
    referenced_message_id: msg.reference?.messageId || null,
    referenced_message_author_id: referencedAuthorId,
    referenced_message_content: referencedContent,
    isFromBot: isFromBot,
    isBotMention: isBotMention,
    replyingToBot: replyingToBot,
    attachments: Array.from(msg.attachments.values()).map(a => ({
      url: a.url,
      content_type: a.contentType || undefined,
      filename: a.name
    })),
    embeds: msg.embeds.map(e => ({
      type: e.data.type || 'rich',
      url: e.url || undefined,
      image: e.image ? { url: e.image.url } : undefined
    })),
    stickers: Array.from(msg.stickers.values())
  }
}

// Add export marker to ensure Next.js picks up the route
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET handler that fetches messages
export async function GET(req: NextRequest, context: Context) {
  const { channelId } = context.params
  
  const { data: messages, error } = await supabase
    .from('messages')  // ✅ Correct - querying 'messages' table
    .select('*')
    .eq('channel_id', channelId)
    .order('sent_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  console.log('🔍 First message from Supabase:', messages?.[0])
  return NextResponse.json({ messages })
}

// POST handler for sending messages
export async function POST(request: Request, { params }: Context) {
  try {
    const { channelId } = params
    const { content, type = 'text', url } = await request.json()
    const walletAddress = request.headers.get('x-wallet-address')

    console.log('📨 Message request:', {
      channelId,
      type,
      hasContent: !!content,
      hasUrl: !!url,
      wallet: walletAddress
    })

    // Allow image-only messages
    if (!content && !url) {
      return NextResponse.json(
        { error: 'Message must have either content or an image' },
        { status: 400 }
      )
    }

    // Get bot token for this wallet
    const { data: botAssignment } = await supabase
      .from('bot_assignments')
      .select(`
        discord_bots (
          bot_token
        )
      `)
      .eq('wallet_address', walletAddress)
      .single() as { data: { discord_bots: { bot_token: string } } | null }

    if (!botAssignment?.discord_bots?.[0]?.bot_token) {
      console.error('❌ No bot token found for wallet:', walletAddress)
      return NextResponse.json(
        { error: 'No bot token found for this wallet' },
        { status: 400 }
      )
    }

    const client = new Client({ intents: [] })
    await client.login(botAssignment.discord_bots[0].bot_token)

    const channel = await client.channels.fetch(channelId) as TextChannel
    
    // Prepare message options
    const messageOptions: any = {
      content: content || '',
    }

    // Handle different message types
    if (type === 'image' && url) {
      console.log('🖼️ Sending image message:', { url })
      messageOptions.files = [url]
      // If no content provided, add a blank space to prevent Discord API issues
      if (!content) messageOptions.content = '\u200B'
    }

    console.log('📤 Sending message with options:', messageOptions)
    await channel.send(messageOptions)
    
    await client.destroy()
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
} 