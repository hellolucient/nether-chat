import { NextRequest, NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { TextChannel, Collection, Message as DiscordMessage } from 'discord.js'

// Simplified message store interface
interface MessageStore {
  id: string
  channel_id: string
  sender_id: string
  content: string
  sent_at: string
  author_username: string
  author_display_name: string
  referenced_message_id: string | null
  referenced_message_author_id: string | null
  referenced_message_content: string | null
  attachments: Array<{
    url: string
    content_type?: string
    filename: string
  }>
  embeds: any[]
  stickers: any[]
}

export async function GET(request: NextRequest, { params }: { params: { channelId: string } }) {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`🔄 [${requestId}] Starting sync for channel: ${params.channelId}`)

  try {
    // Get Discord client
    const client = await getDiscordClient()
    const channel = await client.channels.fetch(params.channelId) as TextChannel

    if (!channel || channel.type !== 0) {
      throw new Error('Invalid channel')
    }

    // Fetch messages in smaller batches
    const messages = await channel.messages.fetch({ limit: 100 })
    console.log(`📨 [${requestId}] Fetched ${messages.size} messages`)

    // Transform messages
    const messagesToStore: MessageStore[] = await transformMessages(messages, channel)

    // Store in batches
    const BATCH_SIZE = 50
    for (let i = 0; i < messagesToStore.length; i += BATCH_SIZE) {
      const batch = messagesToStore.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('messages')
        .upsert(batch)

      if (error) {
        console.error(`❌ [${requestId}] Storage error for batch ${i}:`, error)
        throw error
      }
    }

    console.log(`✅ [${requestId}] Sync complete: ${messagesToStore.length} messages`)
    return NextResponse.json({ synced: messagesToStore.length })

  } catch (error) {
    console.error(`❌ [${requestId}] Sync failed:`, error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

async function transformMessages(
  messages: Collection<string, DiscordMessage>, 
  channel: TextChannel
): Promise<MessageStore[]> {
  const messagesToStore: MessageStore[] = []

  for (const msg of messages.values()) {
    // Get referenced message details if it exists
    let referencedMessage: DiscordMessage | null = null
    if (msg.reference?.messageId) {
      try {
        const ref = await channel.messages.fetch(msg.reference.messageId)
        referencedMessage = ref
      } catch (error) {
        console.log('⚠️ Could not fetch referenced message:', msg.reference.messageId)
      }
    }

    // Only include fields that exist in our schema
    messagesToStore.push({
      id: msg.id,
      channel_id: msg.channelId,
      sender_id: msg.author.id,
      content: msg.content,
      sent_at: msg.createdAt.toISOString(),
      author_username: msg.author.username,
      author_display_name: msg.member?.displayName || msg.author.displayName || msg.author.username,
      referenced_message_id: msg.reference?.messageId || null,
      referenced_message_author_id: referencedMessage?.author.id || null,
      referenced_message_content: referencedMessage?.content || null,
      attachments: Array.from(msg.attachments.values()).map(a => ({
        url: a.url,
        content_type: a.contentType || undefined,
        filename: a.name
      })),
      embeds: msg.embeds,
      stickers: Array.from(msg.stickers.values())
    })
  }

  return messagesToStore
} 