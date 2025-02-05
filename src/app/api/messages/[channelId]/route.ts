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

// Helper function to transform Discord message to our format
function transformDiscordMessage(msg: DiscordMessage): Message {
  return {
    id: msg.id,
    content: msg.content,
    author: {
      username: msg.author.username,
      id: msg.author.id
    },
    timestamp: msg.createdAt.toISOString(),
    attachments: Array.from(msg.attachments.values()).map(attachment => ({
      url: attachment.url,
      content_type: attachment.contentType || undefined,
      filename: attachment.name
    })),
    embeds: msg.embeds.map(embed => ({
      type: embed.data.type as string || 'rich',
      url: embed.data.url || undefined,
      image: embed.data.image ? { 
        url: embed.data.image.url 
      } : undefined
    })),
    sticker_items: msg.stickers.map(sticker => ({
      id: sticker.id,
      name: sticker.name
    }))
  }
}

// GET handler for fetching messages
export async function GET(
  req: NextRequest,
  context: Context
) {
  try {
    const { channelId } = context.params
    const wallet = req.nextUrl.searchParams.get('wallet')

    if (!channelId || !wallet) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Check if user has access to this channel
    const { data: assignment } = await supabase
      .from('bot_assignments')
      .select('channel_access')
      .eq('wallet_address', wallet)
      .single()

    if (!assignment?.channel_access?.includes(channelId)) {
      console.log('❌ No channel access for wallet:', wallet, 'channel:', channelId)
      return NextResponse.json(
        { error: 'No access to this channel' }, 
        { status: 403 }
      )
    }

    // Get Discord client and fetch messages
    const client = await getDiscordClient(wallet)
    const channel = await client.channels.fetch(channelId)
    
    if (!(channel instanceof TextChannel)) {
      throw new Error('Channel is not a text channel')
    }

    const discordMessages = await channel.messages.fetch({ limit: 50 })
    const messageArray = Array.from(discordMessages.values())
      .reverse()
      .map(transformDiscordMessage)

    // Get last viewed time
    const { data: lastViewed } = await supabase
      .from('last_viewed')
      .select('last_viewed')
      .eq('channel_id', channelId)
      .eq('wallet_address', wallet)
      .single()

    return NextResponse.json({ 
      messages: messageArray,
      lastViewed: lastViewed?.last_viewed 
    })
  } catch (error) {
    console.error('Error in GET messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
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