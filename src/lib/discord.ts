import { 
  Client, 
  GatewayIntentBits, 
  TextChannel, 
  Message,
  BaseGuildTextChannel
} from 'discord.js'
import { supabase } from '@/lib/supabase'
import { cleanupOldImages } from '@/lib/storage'
import type { Message as AppMessage } from '@/types' // Import our Message type

let client: Client | null = null

// Add these types at the top of the file
interface ImageMessage {
  type: 'image'
  content: string
  url: string
  reply?: {
    messageReference: { messageId: string }
    quotedContent: string
  }
}

interface TextMessage {
  type: 'text'
  content: string
  reply?: {
    messageReference: { messageId: string }
    quotedContent: string
  }
}

type MessageContent = string | ImageMessage | TextMessage

const clientCache = new Map<string, Client>()

interface BotAssignment {
  bot_id: string
  discord_bots: {
    bot_token: string
  }
}

export async function initializeDiscordBot() {
  try {
    if (!client) {
      client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.DirectMessages
        ]
      })
    }
    await client.login(process.env.DISCORD_BOT_TOKEN)
    console.log('Discord bot initialized')

    client.on('messageCreate', async (message) => {
      try {
        // Don't process messages from our own bot
        if (message.author.id === client.user?.id) return;

        console.log('📨 New Discord message:', {
          id: message.id,
          channel: message.channelId,
          author: message.author.username,
          isReply: !!message.reference,
          content: message.content.substring(0, 50),
          mentions: message.mentions.users.map(u => u.id)
        })

        // Store message in Supabase
        const messageData = {
          id: message.id,
          channel_id: message.channelId,
          sender_id: message.author.id,
          content: message.content,
          sent_at: message.createdAt.toISOString(),
          referenced_message_id: message.reference?.messageId || null,
          referenced_message_author_id: message.reference ? 
            (await message.fetchReference()).author.id : null
        }

        await supabase
          .from('messages')
          .upsert(messageData, {
            onConflict: 'id'
          })

        console.log('✅ Message stored:', messageData.id)
      } catch (error) {
        console.error('❌ Error storing message:', error)
      }
    })
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error)
    throw error
  }
}

export { client }

export async function getDiscordClient(walletAddress?: string) {
  if (!walletAddress) throw new Error('No wallet address provided')

  // Get user's bot assignment and associated bot token
  const { data: assignment } = await supabase
    .from('bot_assignments')
    .select(`
      bot_id,
      discord_bots (
        bot_token
      )
    `)
    .eq('wallet_address', walletAddress)
    .single() as { data: BotAssignment | null }

  if (!assignment?.discord_bots?.bot_token) {
    throw new Error('No bot token found for this wallet')
  }

  // Create new client with user's bot token
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages
    ]
  })
  await client.login(assignment.discord_bots.bot_token)
  return client
}

// Add a health check function
export async function checkDiscordConnection() {
  try {
    const discord = await getDiscordClient()
    const isReady = discord.isReady()
    console.log('Discord connection status:', { 
      isReady,
      wsStatus: discord.ws.status
    })
    return isReady
  } catch (error) {
    console.error('Discord connection check failed:', error)
    // Force new connection on next request
    client = null
    return false
  }
}

export async function sendMessage(
  channelId: string, 
  content: string, 
  options?: { 
    messageReference?: { messageId: string },
    embeds?: Array<{ image: { url: string } }>,
    quotedContent?: string
  }
) {
  try {
    console.log('🚀 Discord: Sending message:', {
      channelId,
      contentLength: content?.length,
      hasEmbed: !!options?.embeds,
      hasReply: !!options?.messageReference
    })

    const discord = await getDiscordClient()
    const channel = await discord.channels.fetch(channelId)
    
    if (!channel?.isTextBased()) {
      console.error('❌ Discord: Channel not text-based')
      throw new Error('Channel not found or not a text channel')
    }

    // Type assertion since we've verified it's a text channel
    const textChannel = channel as BaseGuildTextChannel
    const message = await textChannel.send({
      content: content || undefined, // Don't send empty string
      ...options
    })

    // Store the sent message in Supabase
    const { error } = await supabase
      .from('messages')
      .insert({
        id: message.id,
        channel_id: channelId,
        content: message.content,
        author_id: message.author.id,
        author_username: message.author.username,
        timestamp: message.createdAt.toISOString()
      })

    if (error) {
      console.error('Error storing sent message:', error)
    }

    console.log('✅ Discord: Message sent successfully:', message.id)
    return true
  } catch (error) {
    console.error('❌ Discord: Error sending message:', error)
    return false
  }
}

export async function getChannels(serverId: string) {
  try {
    const discord = await getDiscordClient()
    console.log('Bot connected as:', discord.user?.tag)
    
    const guild = await discord.guilds.fetch(serverId)
    console.log('Found guild:', guild.name)
    
    const channels = await guild.channels.fetch()
    console.log('Total channels found:', channels.size)
    
    const textChannels = channels
      .filter((channel): channel is TextChannel => 
        channel !== null && channel instanceof TextChannel
      )
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type
      }))
    
    console.log('Text channels found:', textChannels.length)
    return textChannels
  } catch (error) {
    console.error('Error fetching channels:', error)
    return []
  }
}

export async function getChannelMessages(channelId: string): Promise<AppMessage[]> {
  try {
    console.log('🔍 Fetching messages for channel:', channelId)
    
    if (!client) {
      client = await getDiscordClient()
    }

    const channel = await client.channels.fetch(channelId) as TextChannel
    const discordMessages = await channel.messages.fetch({ limit: 50 })
    console.log(`📨 Found ${discordMessages.size} messages`)

    // Store messages in Supabase
    const messagesToUpsert = Array.from(discordMessages.values()).map(msg => ({
      id: msg.id,
      channel_id: channelId,
      content: msg.content,
      sender_id: msg.author.id,
      sent_at: msg.createdAt.toISOString()
    }))

    console.log('💾 Upserting messages to Supabase:', messagesToUpsert.length)
    const { error } = await supabase
      .from('messages')
      .upsert(messagesToUpsert, {
        onConflict: 'id'
      })

    if (error) {
      console.error('❌ Error storing messages:', error)
    } else {
      console.log('✅ Messages stored successfully')
    }

    // Transform Discord messages to our app format
    const transformedMessages = Array.from(discordMessages.values()).map(msg => ({
      id: msg.id,
      content: msg.content,
      channelId: msg.channelId,
      author: {
        id: msg.author.id,
        username: msg.author.username
      },
      timestamp: msg.createdAt.toISOString(),
      attachments: Array.from(msg.attachments.values()).map(a => ({
        url: a.url,
        content_type: a.contentType || undefined,
        filename: a.name || 'untitled'
      })),
      embeds: msg.embeds.map(e => ({
        type: e.data.type || 'rich',
        url: e.url || undefined,
        thumbnail: e.thumbnail ? { url: e.thumbnail.url } : undefined,
        image: e.image ? { url: e.image.url } : undefined
      })),
      stickers: Array.from(msg.stickers.values()).map(s => ({
        url: s.format === 3 
          ? `https://cdn.discordapp.com/stickers/${s.id}.gif`
          : `https://cdn.discordapp.com/stickers/${s.id}.png`,
        name: s.name
      })),
      created_at: msg.createdAt.toISOString()
    }))

    return transformedMessages.reverse()
  } catch (error) {
    console.error('Error fetching messages:', error)
    throw error
  }
}

export async function searchUsers(query: string) {
  try {
    const discord = await getDiscordClient()
    const serverId = process.env.DISCORD_SERVER_ID!
    const guild = await discord.guilds.fetch(serverId)
    const members = await guild.members.fetch()

    return members
      .filter(member => 
        member.displayName.toLowerCase().includes(query.toLowerCase()) ||
        member.user.username.toLowerCase().includes(query.toLowerCase())
      )
      .map(member => ({
        id: member.id,
        displayName: member.displayName,
        username: member.user.username
      }))
      .slice(0, 5) // Limit to 5 results
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}

// Add this function to help with debugging/restarting
export async function disconnectClient() {
  if (client) {
    await client.destroy()
    client = null
    console.log('Discord client destroyed')
  }
}

async function cleanupOldMessages() {
  try {
    // Keep 72 hours of messages
    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - 72)
    
    const { error, count } = await supabase
      .from('messages')
      .delete()
      .lt('sent_at', cutoffDate.toISOString())

    if (error) {
      console.error('❌ Discord: Error cleaning up old messages:', error)
    } else if (count && count > 0) {
      console.log(`🧹 Discord: Cleaned up ${count} messages older than 72 hours`)
    }

    // Also cleanup old images
    await cleanupOldImages()
  } catch (error) {
    console.error('❌ Discord: Error in cleanupOldMessages:', error)
  }
}
