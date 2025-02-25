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
import { logger } from '@/lib/logger'
import { sendMessage } from '@/lib/discord'

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

// Update the BotAssignment type
type BotAssignment = {
  bot_id: string;
  discord_bots: {
    bot_token: string;
    bot_name: string;
  };
};

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
  const hasBotMention = msg.content?.includes('<@') && msg.content?.includes('>')
  const replyingToBot = msg.reference?.messageId ? 
    bots.some(bot => bot.discord_id === msg.reference?.messageId) : 
    false

  // Add debug log for flags with distinctive icon
  console.log('⛳ Flag Check:', {
    id: msg.id,
    isFromBot,
    hasBotMention,
    replyingToBot
  })

  // Get referenced message details if it exists
  let referencedAuthorId: string | null = null
  let referencedContent: string | null = null
  
  if (msg.reference?.messageId) {
    // Get the referenced message from the channel
    const referencedMessage = msg.channel.messages.cache.get(msg.reference.messageId)
    if (referencedMessage) {
      referencedAuthorId = referencedMessage.author.id
      referencedContent = referencedMessage.content
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
  console.log('\n🟣 ==================== MESSAGE FETCH START ====================')
  console.log('📥 Fetching messages for channel:', channelId)

  // Get messages with all fields using *
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('sent_at', { ascending: true })
    // We might need to add .limit(300) here to match what we want to show

  if (error) {
    console.error('❌ Failed to fetch messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  // Log a message with reference for debugging
  const referencedMessage = messages?.find(m => m.referenced_message_id)
  if (referencedMessage) {
    console.log('🔍 Found message with reference:', {
      id: referencedMessage.id,
      content: referencedMessage.content,
      referencedId: referencedMessage.referenced_message_id,
      referencedContent: referencedMessage.referenced_message_content
    })
  }

  console.log(`✅ Fetched ${messages?.length || 0} messages from database`)
  console.log('🟣 ==================== MESSAGE FETCH END ====================\n')

  return NextResponse.json({ messages })
}

// POST handler for sending messages
export async function POST(request: Request, context: Context) {
  console.log('\n🔵 ==================== MESSAGE SEND START ====================')
  const requestId = Math.random().toString(36).substring(7)
  console.log(`🚀 [${requestId}] Message POST request started`)
  
  try {
    const { channelId } = context.params
    const { content, reply } = await request.json()
    const walletAddress = request.headers.get('x-wallet-address')

    console.log(`📝 [${requestId}] Request details:`, {
      channelId,
      walletAddress,
      contentPreview: typeof content === 'string' ? 
        content.substring(0, 50) : 
        content.content.substring(0, 50),
      hasReply: !!reply
    })

    if (!walletAddress || !channelId) {
      console.log(`❌ [${requestId}] Missing required fields:`, {
        hasWallet: !!walletAddress,
        hasChannel: !!channelId
      })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get bots list first
    const { data: bots } = await supabase
      .from('discord_bots')
      .select('discord_id, bot_name')

    console.log('📤 Sending message to channel:', channelId)
    
    // Get Discord client and channel
    const discord = await getDiscordClient(walletAddress)
    const channel = await discord.channels.fetch(channelId) as TextChannel

    // Prepare message options
    const messageOptions: any = {
      content: typeof content === 'string' ? content : content.content
    }

    if (reply) {
      messageOptions.reply = {
        messageReference: reply.messageId,
        failIfNotExists: false
      }
    }

    // Send the message
    const sentMessage = await channel.send(messageOptions)
    console.log('✅ Message sent to Discord:', sentMessage.id)
    
    // Get latest messages including our just-sent one
    const messages = await channel.messages.fetch({ limit: 50 })
    console.log('⬇️ Fetched from Discord:', messages.size, 'messages for channel:', channelId)
    
    // After fetching from Discord
    console.log('⬇️ Messages from Discord:', messages.map(m => ({
      id: m.id,
      author: m.author.username,
      isBot: m.author.bot,
      content: m.content.substring(0, 50)
    })))
    
    // Store in Supabase
    console.log('🔄 Starting message storage:', {
      channelId,
      messageCount: messages.size,
      firstMessage: Array.from(messages.values())[0]?.content.substring(0, 50)
    })

    const messagesToStore = Array.from(messages.values()).map(m => ({
      id: m.id,
      channel_id: channelId,
      sender_id: m.author.id,
      content: m.content,
      sent_at: m.createdAt.toISOString(),
      author_username: m.author.username,
      author_display_name: m.member?.displayName || m.author.displayName || m.author.username,
      referenced_message_id: m.reference?.messageId || null,
      referenced_message_author_id: m.reference?.messageId ? messages.get(m.reference.messageId)?.author.id : null,
      referenced_message_content: m.reference?.messageId ? messages.get(m.reference.messageId)?.content : null,
      attachments: Array.from(m.attachments.values()).map(a => ({
        url: a.url,
        content_type: a.contentType,
        filename: a.name,
        size: a.size
      })),
      embeds: m.embeds,
      stickers: Array.from(m.stickers.values()).map(s => ({
        url: s.url,
        name: s.name
      }))
    }))

    console.log('📦 Prepared messages for storage:', {
      count: messagesToStore.length,
      sample: messagesToStore[0]
    })

    const { data: storedMessages, error } = await supabase
      .from('messages')
      .upsert(messagesToStore)
      .select('*')
      .order('sent_at', { ascending: true })

    if (error) {
      console.error('❌ Supabase storage error:', error)
      throw error
    } else {
      console.log('✅ Successfully stored messages:', {
        attempted: messagesToStore.length,
        stored: storedMessages?.length || 0,
        firstStored: storedMessages?.[0]?.content.substring(0, 50)
      })
    }

    console.log('🔵 ==================== MESSAGE SEND END ====================\n')
    return NextResponse.json({ 
      success: true,
      messages: storedMessages || []
    })
  } catch (error) {
    console.error('❌ Error sending message:', error)
    console.log('🔵 ==================== MESSAGE SEND ERROR ====================\n')
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
} 