import { NextRequest, NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { TextChannel, Message as DiscordMessage, Collection } from 'discord.js'

type Context = {
  params: {
    channelId: string
  }
}

// Update the MessageData interface to match our Message type
interface MessageData {
  id: string
  channel_id: string
  sender_id: string
  author_username: string
  author_display_name: string
  content: string
  sent_at: string
  referenced_message_id: string | null
  referenced_message_author_id: string | null
  referenced_message_content: string | null
  isFromBot: boolean
  isBotMention: boolean
  replyingToBot: boolean
  stickers: Array<{
    url: string
    name: string
  }>
  attachments: Array<{
    url: string
    content_type?: string
    filename: string
  }>
  embeds: Array<{
    type: string
    url?: string
    image?: { url: string }
  }>
  sticker_items: Array<{
    id: string
    name: string
  }>
  hasBotMention: boolean
}

// Add interface for bot assignment
interface BotAssignment {
  discord_bots: {
    bot_token: string
  }
}

// Fetch messages in batches of 100 until we have 300 or run out
async function fetchMessages(channel: TextChannel, limit: number = 300) {
  let messages = new Map<string, DiscordMessage>()
  let lastId: string | undefined

  while (messages.size < limit) {
    const options: any = { limit: 100 }
    if (lastId) {
      options.before = lastId
    }

    const batch = (await channel.messages.fetch(options)) as unknown as Collection<string, DiscordMessage>
    if (!batch.size) break // No more messages

    batch.forEach(msg => {
      if (messages.size < limit) {
        messages.set(msg.id, msg)
      }
    })

    const lastMessage = batch.last()
    lastId = lastMessage?.id
    if (!lastId) break
  }

  return messages
}

// Add this helper function
async function getReferencedMessage(messageId: string, channel: TextChannel): Promise<{
  author_id: string,
  content: string
} | null> {
  console.log('🔍 Getting reference for message:', messageId)
  
  try {
    // First try Discord
    const referencedMessage = await channel.messages.fetch(messageId)
    console.log('✅ Found referenced message in Discord:', {
      id: messageId,
      content: referencedMessage.content,
      authorId: referencedMessage.author.id
    })
    return {
      author_id: referencedMessage.author.id,
      content: referencedMessage.content
    }
  } catch (error) {
    console.error('❌ Failed to fetch from Discord, trying Supabase:', error)
    
    // If Discord fails, try Supabase
    const { data: message } = await supabase
      .from('messages')
      .select('sender_id, content, author_username')  // Added author_username
      .eq('id', messageId)
      .single()

    if (message) {
      console.log('✅ Found reference in Supabase:', {
        id: messageId,
        authorId: message.sender_id,  // This should now be properly passed back
        content: message.content
      })
      return {
        author_id: message.sender_id,  // This should now be properly passed back
        content: message.content
      }
    }
    console.log('❌ Message not found in either Discord or Supabase')
  }
  return null
}

export async function GET(req: NextRequest, context: Context) {
  try {
    const { channelId } = context.params
    const wallet = req.nextUrl.searchParams.get('wallet')

    if (!channelId || !wallet) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Get Discord client
    const client = await getDiscordClient(wallet)
    const channel = await client.channels.fetch(channelId)
    if (!(channel instanceof TextChannel)) {
      throw new Error('Channel is not a text channel')
    }

    console.log('🔄 Starting sync for channel:', channelId)
    console.log('👛 Wallet:', wallet)
    console.log('🔄 Fetching up to 300 messages from Discord...')

    // At the start of the function, log the table structure
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'messages' })
    
    console.log('📋 Database table structure:', tableInfo)

    // Fetch messages in batches of 100 until we have 300 or run out
    const discordMessages = await fetchMessages(channel)

    console.log('📥 Fetched from Discord:', {
      count: discordMessages.size,
      sample: Array.from(discordMessages.values())
        .slice(0, 2)
        .map(m => ({
          id: m.id,
          content: m.content.substring(0, 50),
          author: m.author.username,
          timestamp: m.createdAt // Let's check what Discord is giving us
        }))
    })

    // At the top, add botData to track bot IDs
    const { data: botData } = await supabase
      .from('discord_bots')
      .select('discord_id, bot_name')

    // Transform Discord messages to match our database schema exactly
    const messagesToStore = await Promise.all(Array.from(discordMessages.values())
      .map(async msg => {
        // Get referenced message content and author if it exists
        let referencedContent: string | null = null
        let referencedAuthorId: string | null = null
        let referencedMessage: DiscordMessage | undefined = undefined

        if (msg.reference?.messageId) {
          try {
            // First try to get from the current batch of messages
            referencedMessage = discordMessages.get(msg.reference.messageId)
            
            // If not in current batch, fetch from Discord
            if (!referencedMessage) {
              referencedMessage = await channel.messages.fetch(msg.reference.messageId)
            }

            if (referencedMessage) {
              referencedContent = referencedMessage.content
              referencedAuthorId = referencedMessage.author.id
              console.log('✅ Found referenced message:', {
                id: msg.reference.messageId,
                content: referencedContent,
                authorId: referencedAuthorId
              })
            }
          } catch (error) {
            console.warn('Could not fetch referenced message:', error)
          }
        }

        // Return only the core message fields we know exist
        return {
          id: msg.id,
          channel_id: msg.channelId,
          sender_id: msg.author.id,
          content: msg.content,
          sent_at: msg.createdAt.toISOString(),
          referenced_message_id: msg.reference?.messageId || null,
          referenced_message_author_id: referencedAuthorId,
          referenced_message_content: referencedContent,
          author_username: msg.author.username,
          author_display_name: msg.member?.displayName || msg.author.displayName || msg.author.username,
          attachments: Array.from(msg.attachments.values()),
          embeds: msg.embeds,
          stickers: Array.from(msg.stickers.values()),
          hasBotMention: msg.content?.includes('<@') && msg.content?.includes('>')
        }
      }))

    // Before Supabase upsert, log the full structure of the first message
    if (messagesToStore.length > 0) {
      console.log('📊 Message structure:', {
        firstMessage: Object.keys(messagesToStore[0]),
        sampleValues: messagesToStore[0]
      })

      const { error } = await supabase
        .from('messages')
        .upsert(messagesToStore, { onConflict: 'id' })

      if (error) {
        console.error('❌ Sync error:', error)
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
      }
    }

    return NextResponse.json({ synced: messagesToStore.length })
  } catch (error) {
    console.error('❌ Sync failed:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
} 