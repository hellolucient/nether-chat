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

// Add color helper at top of file
const purple = (text: string) => `\x1b[35m${text}\x1b[0m`
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`

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
  const requestId = Math.random().toString(36).substring(7)
  const log = (emoji: string, msg: string, data?: any) => {
    console.log(purple(`${emoji} [${requestId}] ${msg}`), data ? dim(JSON.stringify(data)) : '')
  }
  
  try {
    const { channelId } = params
    const { content, type = 'text', url } = await request.json()
    const walletAddress = request.headers.get('x-wallet-address')

    log('🚀', 'New image message:', {
      channelId,
      type,
      hasContent: !!content,
      hasUrl: !!url,
      urlLength: url?.length
    })

    // Get bot token for this wallet
    log('🔍', 'Fetching bot token...')
    const { data: botAssignment, error: botError } = await supabase
      .from('bot_assignments')
      .select(`
        discord_bots (
          bot_token,
          bot_name,
          discord_id
        )
      `)
      .eq('wallet_address', walletAddress)
      .single()

    if (botError) {
      log('❌', 'Bot lookup error:', botError)
      return NextResponse.json({ error: 'Failed to find bot' }, { status: 400 })
    }

    const bot = botAssignment?.discord_bots?.[0]
    log('✅', 'Found bot:', {
      hasToken: !!bot?.bot_token,
      botName: bot?.bot_name,
      botId: bot?.discord_id
    })

    // Initialize Discord client
    log('🤖', 'Initializing Discord client...')
    const client = new Client({ intents: [] })
    
    try {
      await client.login(bot.bot_token)
      log('✅', 'Bot logged in')
      
      const channel = await client.channels.fetch(channelId) as TextChannel
      log('✅', 'Channel fetched:', {
        name: channel.name,
        id: channel.id
      })

      // Prepare message
      const messageOptions: any = {
        content: content || '\u200B',
      }

      if (type === 'image' && url) {
        log('📸', 'Processing image:', { 
          url,
          urlLength: url.length,
          isValidUrl: url.startsWith('http'),
          contentType: url.split('.').pop()
        })
        messageOptions.files = [url]
      }

      // Send message
      log('📤', 'Sending message:', messageOptions)
      const sent = await channel.send(messageOptions)
      log('✅', 'Message sent:', {
        id: sent.id,
        hasAttachments: sent.attachments.size > 0,
        attachmentInfo: Array.from(sent.attachments.values()).map(a => ({
          id: a.id,
          url: a.url,
          size: a.size
        }))
      })

      await client.destroy()
      return NextResponse.json({ 
        success: true,
        messageId: sent.id
      })

    } catch (discordError) {
      log('❌', 'Discord error:', {
        error: discordError,
        message: discordError instanceof Error ? discordError.message : 'Unknown error'
      })
      throw discordError
    }
  } catch (error) {
    log('❌', 'Request failed:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
} 