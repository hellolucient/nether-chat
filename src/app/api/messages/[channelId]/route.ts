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
    stickers: Array.from(msg.stickers.values()).map(sticker => ({
      url: `https://cdn.discordapp.com/stickers/${sticker.id}.png`,
      name: sticker.name
    })),
    attachments: Array.from(msg.attachments.values()).map(a => ({
      url: a.url,
      content_type: a.contentType || undefined,
      filename: a.name
    })),
    embeds: msg.embeds.map(e => ({
      type: e.type,
      url: e.url || undefined,
      image: e.image ? { url: e.image.url } : undefined
    })),
    sticker_items: Array.from(msg.stickers.values()).map(s => ({
      id: s.id,
      name: s.name
    })),
    isFromBot: msg.author.bot,
    isBotMention: false,
    replyingToBot: false
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
export async function POST(request: Request, { params }: { params: { channelId: string } }) {
  try {
    const { content, type, url, reply, stickerId } = await request.json()
    console.log('🔍 API: Received payload:', { content, type, url, reply, stickerId })

    // Get the wallet from the request headers
    const wallet = request.headers.get('x-wallet-address')
    if (!wallet) {
      return NextResponse.json({ error: 'No wallet address provided' }, { status: 400 })
    }

    // Get user's bot token
    const { data: botData } = await supabase
      .from('bot_tokens')
      .select('bot_token')
      .eq('wallet_address', wallet)
      .single()

    if (!botData?.bot_token) {
      console.log('❌ No bot token found for wallet:', wallet)
      return NextResponse.json({ error: 'No bot token found for this wallet' }, { status: 400 })
    }

    console.log('🤖 Using bot token for wallet:', wallet)

    // Initialize Discord client with user's bot token
    const client = new Client({ intents: [] })
    await client.login(botData.bot_token)

    const channel = await client.channels.fetch(params.channelId)
    if (!(channel instanceof TextChannel)) {
      throw new Error('Channel is not a text channel')
    }

    // Prepare message options
    const messageOptions: any = {
      content: content || '',
    }

    // Add reply reference if exists
    if (reply?.messageReference) {
      messageOptions.messageReference = reply.messageReference
      if (reply.quotedContent) {
        messageOptions.content = reply.quotedContent + (messageOptions.content ? '\n' + messageOptions.content : '')
      }
    }

    // Handle different message types
    switch (type) {
      case 'gif':
        console.log('🎯 Handling GIF message:', { url, content })
        messageOptions.files = [{
          attachment: url,
          name: 'gif.gif'
        }]
        break
        
      case 'image':
        console.log('🖼️ Handling image message:', { url })
        messageOptions.files = [url]
        break
        
      case 'sticker':
        if (stickerId) {
          console.log('🏷️ Handling sticker message:', { stickerId })
          try {
            // Get sticker from sticker packs
            const stickerPacks = await client.fetchStickerPacks()
            let foundSticker = undefined as Sticker | undefined

            // Search through all packs for the sticker
            for (const pack of stickerPacks.values()) {
              const packSticker = pack.stickers.get(stickerId)
              if (packSticker) {
                foundSticker = packSticker
                break
              }
            }

            // If not found in packs, try guild stickers
            if (!foundSticker) {
              const guildStickers = await channel.guild.stickers.fetch()
              const guildSticker = guildStickers.get(stickerId)
              if (guildSticker) {
                foundSticker = guildSticker
              }
            }

            if (!foundSticker) {
              throw new Error('Sticker not found')
            }

            messageOptions.stickers = [foundSticker]
            console.log('✅ Found sticker:', foundSticker.name)
          } catch (error) {
            console.error('❌ Error fetching sticker:', error)
            throw new Error('Failed to fetch sticker')
          }
        }
        break
        
      default:
        console.log('📝 Handling text message')
        break
    }

    console.log('📤 Sending message with options:', messageOptions)
    await channel.send(messageOptions)
    console.log('✅ Message sent successfully to Discord')
    await client.destroy() // Clean up the client connection
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Failed to send message to Discord:', error)
    throw error
  }
} 