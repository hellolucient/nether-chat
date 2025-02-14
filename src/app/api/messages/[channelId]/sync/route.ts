import { NextRequest, NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { TextChannel, Message as DiscordMessage, Collection } from 'discord.js'

type Context = {
  params: {
    channelId: string
  }
}

// Add this near the top of the file
interface MessageData {
  id: string
  channel_id: string
  sender_id: string
  author_username: string
  content: string
  sent_at: string
  referenced_message_id: string | null
  referenced_message_author_id: string | null
  referenced_message_content: string | null
  isFromBot: boolean
  isBotMention: boolean
  replyingToBot: boolean
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

    // Transform and store
    const messagesToStore = await Promise.all(Array.from(discordMessages.values())
      .map(async msg => {
        let referencedAuthorId: string | null = null
        let referencedContent: string | null = null
        
        if (msg.reference?.messageId) {
          console.log('🔍 Processing message with reference:', {
            messageId: msg.id,
            referenceId: msg.reference.messageId
          })
          const referenced = await getReferencedMessage(msg.reference.messageId, channel)
          if (referenced) {
            referencedAuthorId = referenced.author_id
            referencedContent = referenced.content
          }
        }

        const messageData = {
          id: msg.id,
          channel_id: msg.channelId,
          sender_id: msg.author.id,
          author_username: msg.member?.displayName || msg.author.displayName || msg.author.username,
          content: msg.content,
          sent_at: msg.createdAt.toISOString(),
          referenced_message_id: msg.reference?.messageId || null,
          referenced_message_author_id: referencedAuthorId,
          referenced_message_content: referencedContent,
          isFromBot: botData?.some(bot => bot.discord_id === msg.author.id) || false,
          isBotMention: msg.mentions.users.some(user => 
            botData?.some(bot => bot.discord_id === user.id)
          ) || false,
          replyingToBot: referencedAuthorId ? 
            botData?.some(bot => bot.discord_id === referencedAuthorId) || false : 
            false
        }

        console.log('📝 Storing message:', {
          id: messageData.id,
          content: messageData.content.substring(0, 50),
          reference: {
            id: messageData.referenced_message_id,
            authorId: messageData.referenced_message_author_id,
            content: messageData.referenced_message_content?.substring(0, 50)
          }
        })

        if (msg.reference?.messageId === '1338978731317788672') {
          console.log('🔍 Found our target message:', {
            messageId: msg.id,
            reference: msg.reference,
            referencedAuthorId,
            referencedContent
          })
        }

        return messageData
      }))

    // Before Supabase upsert
    console.log('💾 Final message data before upsert:', messagesToStore.map(msg => ({
      id: msg.id,
      referenced_message_id: msg.referenced_message_id,
      referenced_message_author_id: msg.referenced_message_author_id,
      // Add this to see if any bot IDs match
      isKnownBotId: botData?.some(bot => bot.discord_id === msg.referenced_message_author_id)
    })))

    // Store in Supabase
    if (messagesToStore.length > 0) {
      const { error } = await supabase
        .from('messages')
        .upsert(messagesToStore, { onConflict: 'id' })

      if (error) {
        console.error('❌ Sync error:', error)
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
      }

      // And just before the upsert
      const targetMessage = messagesToStore.find(m => 
        m.referenced_message_id === '1338978731317788672' ||
        m.id === '1338978731317788672'
      )
      if (targetMessage) {
        console.log('🎯 Target message before upsert:', targetMessage)
      }
    }

    return NextResponse.json({ synced: messagesToStore.length })
  } catch (error) {
    console.error('❌ Sync failed:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
} 