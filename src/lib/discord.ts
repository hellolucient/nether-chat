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

let client: Client | null = null;

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

export async function getDiscordClient() {
  // Add retries for client initialization
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      if (client?.isReady()) {
        console.log('✅ Discord: Returning existing ready client')
        return client
      }

      console.log('🔄 Discord: Creating new client...')
      client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessageReactions,
        ],
      });
      
      // Handle disconnections
      client.on('shardDisconnect', (event, shardId) => {
        console.log('Discord shard disconnected:', { shardId, event })
        client = null // Force new connection on next request
      })

      client.on('shardReconnecting', (id) => {
        console.log('Discord shard reconnecting:', id)
      })

      client.on('shardResume', (id, replayedEvents) => {
        console.log('Discord shard resumed:', { id, replayedEvents })
      })

      await client.login(process.env.DISCORD_BOT_TOKEN);
      
      // Wait for client to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord client ready timeout'))
        }, 5000)

        // Store client reference since we know it's not null here
        const currentClient = client
        if (!currentClient) {
          clearTimeout(timeout)
          reject(new Error('Client is null'))
          return
        }

        currentClient.once('ready', () => {
          clearTimeout(timeout)
          
          // Set up event handlers
          currentClient.on('messageCreate', async (message: Message) => {
            try {
              // Ignore messages from the bot itself
              if (message.author.id === currentClient.user?.id) return

              console.log('📨 Discord: New message received:', {
                channelId: message.channelId,
                author: message.author.username
              })

              // Check if message.content is an object (image or text message)
              const content = message.content as MessageContent
              let finalContent: string

              if (typeof content === 'object' && 'type' in content) {
                if (content.type === 'image') {
                  console.log('📸 Discord: Sending image message')
                  await sendMessage(message.channelId, content.content || '', {
                    embeds: [{
                      image: {
                        url: content.url
                      }
                    }],
                    messageReference: content.reply?.messageReference
                  })
                  finalContent = `__IMAGE__${content.url}`
                } else {
                  finalContent = content.content
                }
              } else {
                finalContent = content
              }

              // Store the message in Supabase
              const { error } = await supabase
                .from('messages')
                .insert({
                  id: message.id,
                  channel_id: message.channelId,
                  sender_id: message.author.id,
                  content: finalContent,
                  sent_at: message.createdAt.toISOString()
                })

              if (error) {
                console.error('❌ Discord: Error storing message in Supabase:', error)
              } else {
                console.log('✅ Discord: Message stored in Supabase')
                
                // Run cleanup after successfully storing a new message
                await cleanupOldMessages()
              }

            } catch (error) {
              console.error('❌ Discord: Error handling new message:', error)
            }
          })
          
          resolve(true)
        })
      })

      console.log('✅ Discord: Client ready')

      return client
    } catch (error) {
      console.error(`❌ Discord: Client init attempt ${attempts + 1} failed:`, error)
      attempts++
      if (attempts === maxAttempts) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
    }
  }

  throw new Error('Failed to initialize Discord client')
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
    if (!client) {
      client = await getDiscordClient()
    }

    const channel = await client.channels.fetch(channelId) as TextChannel
    const messages = await channel.messages.fetch({ limit: 50 })

    // Store messages in Supabase
    const messagesToUpsert = messages.map(msg => ({
      id: msg.id,
      channel_id: channelId,
      content: msg.content,
      author_id: msg.author.id,
      author_username: msg.author.username,
      timestamp: msg.createdAt.toISOString()
    }))

    const { error } = await supabase
      .from('messages')
      .upsert(messagesToUpsert, {
        onConflict: 'id'
      })

    if (error) {
      console.error('Error storing messages:', error)
    }

    // Return messages as before
    return messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      author: {
        id: msg.author.id,
        username: msg.author.username
      },
      timestamp: msg.createdAt.toISOString(),
      attachments: Array.from(msg.attachments.values()).map(a => ({
        url: a.url,
        content_type: a.contentType || undefined
      })),
      embeds: msg.embeds.map(e => ({
        type: e.data.type || 'rich',
        url: e.url || undefined,
        thumbnail: e.thumbnail ? { url: e.thumbnail.url } : undefined,
        image: e.image ? { url: e.image.url } : undefined
      })),
      stickers: Array.from(msg.stickers.values()).map(s => ({
        id: s.id,
        name: s.name,
        url: s.format === 3 ?
          `https://cdn.discordapp.com/stickers/${s.id}.gif` :
          `https://cdn.discordapp.com/stickers/${s.id}.png`
      }))
    })).reverse()
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
