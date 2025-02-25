import { 
  Client, 
  GatewayIntentBits, 
  TextChannel, 
  Message as DiscordMessage,
  BaseGuildTextChannel,
  Collection,
  Channel
} from 'discord.js'
import { supabase } from '@/lib/supabase'
import { cleanupOldImages } from '@/lib/storage'
import type { Message as AppMessage } from '@/types' // Import our Message type
import { SupabaseClient } from '@supabase/supabase-js'

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

interface BotAssignment {
  bot_id: string
  discord_bots: {
    bot_token: string
  }
}

// Add a client cache at the top of the file
const clientCache = new Map<string, Client>()

// Update the message content type to include type and url
interface MessageOptions {
  content: string;
  type?: 'text' | 'image';
  url?: string;
  reply?: {
    messageId: string;
    authorId: string;
    content: string;
  };
}

// Add this near the top of the file
const DISCORD_LISTENER_BOT_TOKEN = process.env.DISCORD_LISTENER_BOT_TOKEN

// Update or add this function
async function initializeListenerBot() {
  try {
    console.log('🎧 Initializing listener bot...')
    
    const listenerClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ]
    })

    // Set up message listener
    listenerClient.on('messageCreate', async (message) => {
      try {
        console.log('📨 New message received:', {
          id: message.id,
          channelId: message.channelId,
          authorId: message.author.id,
          content: message.content.substring(0, 50)
        })

        const { data: bots } = await supabase
          .from('discord_bots')
          .select('discord_id, bot_name')

        // Check if message is bot-related (for logging only)
        const isFromBot = bots?.some(bot => bot.discord_id === message.author.id)
        const mentionsBot = message.mentions.users.some(user => 
          bots?.some(bot => bot.discord_id === user.id)
        )
        const repliedToOurBot = message.reference && 
          bots?.some(bot => bot.discord_id === message.reference?.messageId)

        // Store message with only the fields that exist in our schema
        const messageData = {
          id: message.id,
          channel_id: message.channelId,
          sender_id: message.author.id,
          author_username: message.author.username,
          author_display_name: message.member?.displayName || message.author.username,
          content: message.content,
          sent_at: message.createdAt.toISOString(),
          referenced_message_id: message.reference?.messageId || null,
          referenced_message_author_id: message.reference ? 
            (await message.fetchReference()).author.id : null,
          referenced_message_content: message.reference ? 
            (await message.fetchReference()).content : null,
          attachments: message.attachments.size > 0 ? 
            Array.from(message.attachments.values()).map(a => ({
              url: a.url,
              content_type: a.contentType,
              filename: a.name,
              size: a.size
            })) : [],
          embeds: message.embeds || [],
          stickers: message.stickers ? Array.from(message.stickers.values()) : []
        }

        // Store in Supabase
        const { error } = await supabase
          .from('messages')
          .upsert(messageData)

        if (error) {
          console.error('❌ Error storing message:', error)
        } else {
          console.log('✅ Message stored in Supabase:', message.id)
        }

      } catch (error) {
        console.error('❌ Error handling message:', error)
      }
    })

    // Log when ready
    listenerClient.once('ready', () => {
      console.log('✅ Listener bot ready!')
    })

    // Login with listener bot token
    await listenerClient.login(DISCORD_LISTENER_BOT_TOKEN)
    console.log('✅ Listener bot logged in')

    return listenerClient
  } catch (error) {
    console.error('❌ Failed to initialize listener bot:', error)
    throw error
  }
}

// Update the main initialization function
export async function initializeDiscordClient() {
  try {
    console.log('🚀 Initializing Discord services...')
    
    // Initialize the listener bot
    await initializeListenerBot()
    
    console.log('✅ Discord initialization complete')
  } catch (error) {
    console.error('❌ Discord initialization failed:', error)
    throw error
  }
}

export async function initializeDiscordBot() {
  try {
    console.log('🤖 Starting Discord bot initialization...')
    
    // Initialize the listener bot first
    await initializeListenerBot()
    
    if (!client) {
      console.log('📝 Creating new Discord client...')
      client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.DirectMessages
        ]
      })

      // Move event handlers inside client creation
      client.once('ready', () => {
        // We know client exists here since we just created it
        console.log('🎉 Bot is ready! Logged in as:', client!.user?.tag)
        console.log('🔍 Watching for mentions/replies to bots from discord_bots table')
        
        // Add more detailed logging here
        supabase
          .from('discord_bots')
          .select('*')  // Select all columns to see full data
          .then(({ data: bots, error }) => {
            if (error) {
              console.error('❌ Error fetching bots:', error)
              return
            }
            console.log('📊 Full bot data:', JSON.stringify(bots, null, 2))
            
            // Test string conversion
            const botsWithParsedIds = bots?.map(bot => ({
              name: bot.bot_name,
              rawId: bot.discord_id,
              asString: String(bot.discord_id),
              rawType: typeof bot.discord_id
            }))
            console.log('🔍 Parsed bot IDs:', botsWithParsedIds)
          })
      })

      client.on('messageCreate', async (message) => {
        const logId = Math.random().toString(36).substring(7)
        const ENV = process.env.VERCEL_ENV || 'development'

        try {
          // Log all incoming messages with attachments
          if (message.attachments.size > 0) {
            console.log(`[${ENV}] 📸 [${logId}] Received message with attachments:`, {
              messageId: message.id,
              channelId: message.channelId,
              authorId: message.author.id,
              attachments: Array.from(message.attachments.values()).map(a => ({
                id: a.id,
                url: a.url,
                proxyURL: a.proxyURL,
                contentType: a.contentType,
                size: a.size,
                width: a.width,
                height: a.height
              }))
            })
          }

          const { data: bots, error: botsError } = await supabase
            .from('discord_bots')
            .select('discord_id, bot_name')

          // Log bot check results
          console.log(`[${ENV}] 🤖 [${logId}] Bot check:`, {
            messageAuthor: message.author.id,
            bots: bots?.map(b => ({ id: b.discord_id, name: b.bot_name })),
            hasError: !!botsError
          })

          if (!bots) {
            console.error('❌ No bots found in database')
            return
          }

          // Check if message is from our bot, mentions our bot, or replies to our bot
          const isFromOurBot = bots.some(bot => bot.discord_id === message.author.id)
          const mentionsOurBot = message.mentions.users.some(user => 
            bots.some(bot => bot.discord_id === user.id)
          )
          const repliedToOurBot = message.reference && 
            bots.some(bot => bot.discord_id === message.reference?.messageId)

          // Only process if it mentions or replies to our bots
          if (!isFromOurBot && !mentionsOurBot && !repliedToOurBot) {
            return
          }

          console.log('🎯 Relevant message found:', {
            id: message.id,
            content: message.content,
            author: message.author.username,
            mentions: message.mentions.users.map(u => u.id),
            isReply: !!message.reference,
            matchedBots: bots.filter(bot => 
              message.mentions.users.some(u => u.id === bot.discord_id) ||
              message.reference?.messageId === bot.discord_id
            ).map(b => b.bot_name)
          })

          // Get bot name if message is from one of our bots
          const botName = bots?.find(b => b.discord_id === message.author.id)?.bot_name

          function formatMentions(content: string, bots: Array<{ discord_id: string, bot_name: string }>) {
            // Replace <@BOT_ID> with @BOT_NAME
            let formattedContent = content
            bots.forEach(bot => {
              const mentionRegex = new RegExp(`<@${bot.discord_id}>`, 'g')
              formattedContent = formattedContent.replace(mentionRegex, `@${bot.bot_name}`)
            })
            return formattedContent
          }

          const botMappings = bots?.map(bot => ({
            id: bot.discord_id,
            name: bot.bot_name
          })) || []

          const transformedContent = await transformDiscordMessage(message.content, botMappings)

          const messageData = {
            id: message.id,
            channel_id: message.channelId,
            sender_id: message.author.id,
            author_username: message.author.username,
            author_display_name: message.member?.displayName || message.author.displayName || message.author.username,
            content: transformedContent,
            sent_at: new Date(message.createdTimestamp).toISOString(),
            referenced_message_id: message.reference?.messageId || null,
            referenced_message_author_id: message.reference ? 
              (await message.fetchReference()).author.id : null,
            referenced_message_content: message.reference ? 
              (await message.fetchReference()).content : null,
            attachments: message.attachments.size > 0 ? 
              Array.from(message.attachments.values()).map(a => ({
                url: a.url,
                proxyURL: a.proxyURL, // Add proxy URL as backup
                content_type: a.contentType,
                filename: a.name,
                size: a.size,
                width: a.width,
                height: a.height
              })) : [],
            isFromBot: message.author.bot,
            replyingToBot: message.reference ? 
              bots?.some(bot => bot.discord_id === message.reference?.messageId) : 
              false
          }

          // Log attachment storage
          if (message.attachments.size > 0) {
            console.log(`[${ENV}] 💾 [${logId}] Storing message with attachments:`, {
              messageId: message.id,
              attachmentCount: message.attachments.size,
              attachments: messageData.attachments.map(a => ({
                url: a.url,
                type: a.content_type,
                size: a.size
              }))
            })
          }

          // Store in Supabase with explicit logging
          const { error: messageError, data: stored } = await supabase
            .from('messages')
            .upsert(messageData)
            .select()
            .single()

          if (messageError) {
            console.error(`[${ENV}] ❌ [${logId}] Storage error:`, messageError)
            throw messageError
          }

          // Verify stored data
          console.log(`[${ENV}] ✅ [${logId}] Message stored:`, {
            id: stored.id,
            hasAttachments: stored.attachments?.length > 0,
            attachmentUrls: stored.attachments?.map(a => a.url)
          })
        } catch (error) {
          console.error(`[${ENV}] ❌ [${logId}] Error:`, {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          })
        }
      })
    }

    await client.login(process.env.DISCORD_BOT_TOKEN)
    console.log('✅ Bot logged in successfully')

    return client
  } catch (error) {
    console.error('❌ Error initializing Discord bot:', error)
    throw error
  }
}

export { client }

export async function getDiscordClient(walletAddress?: string) {
  if (!walletAddress) throw new Error('No wallet address provided')

  // Check cache first
  const cachedClient = clientCache.get(walletAddress)
  if (cachedClient?.isReady()) {
    return cachedClient
  }

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
  
  // Cache the client
  clientCache.set(walletAddress, client)

  return client
}

// Update or add the checkDiscordConnection function
export async function checkDiscordConnection() {
  try {
    if (!client) {
      console.log('🔄 Initializing new Discord connection...')
      client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.DirectMessages
        ]
      })

      await client.login(process.env.DISCORD_BOT_TOKEN)
      
      // Wait for ready event
      await new Promise((resolve) => {
        if (client?.isReady()) {
          resolve(true)
        } else {
          client?.once('ready', () => resolve(true))
        }
      })

      console.log('✅ Discord connection established')
    }

    return true
  } catch (error) {
    console.error('❌ Discord connection failed:', error)
    return false
  }
}

// Update sendMessage function to require wallet address
export async function sendMessage(
  channelId: string,
  messageOptions: MessageOptions,
  walletAddress: string
) {
  try {
    console.log('🤖 Discord: Getting client for wallet:', walletAddress)
    const discord = await getDiscordClient(walletAddress)
    
    console.log('🤖 Discord: Fetching channel:', channelId)
    const channel = await discord.channels.fetch(channelId) as TextChannel
    
    if (!channel) {
      throw new Error('Channel not found')
    }

    console.log('📝 Discord: Constructing message options:', messageOptions)
    const discordMessageOptions: any = {
      content: messageOptions.content
    }

    if (messageOptions.reply) {
      console.log('💬 Discord: Adding reply options:', messageOptions.reply)
      discordMessageOptions.reply = {
        messageReference: messageOptions.reply.messageId,
        failIfNotExists: false
      }
    }

    if (messageOptions.type === 'image' && messageOptions.url) {
      console.log('🖼 Discord: Adding image:', messageOptions.url)
      discordMessageOptions.files = [messageOptions.url]
    }

    console.log('📤 Discord: Sending message with options:', discordMessageOptions)
    await channel.send(discordMessageOptions)
    return true
  } catch (error) {
    console.error('❌ Discord: Failed to send message:', error)
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
        type: channel.type,
        position: channel.position
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
    
    // Get bots list first
    const { data: bots } = await supabase
      .from('discord_bots')
      .select('discord_id, bot_name')

    const botMappings = bots?.map(bot => ({
      id: bot.discord_id,
      name: bot.bot_name
    })) || []

    // 1. First fetch from Discord
    if (!client) {
      throw new Error('Discord client not initialized')
    }

    const channel = await client.channels.fetch(channelId)
    if (!(channel instanceof TextChannel)) {
      throw new Error('Channel is not a text channel')
    }

    let discordMessages: Collection<string, DiscordMessage> | null = null
    
    console.log('📥 Fetching messages from Discord...')
    const fortyEightHoursAgo = new Date()
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48)

    discordMessages = await channel.messages.fetch({ 
      after: fortyEightHoursAgo.getTime().toString(),
      cache: false
    })
    console.log(`✅ Fetched ${discordMessages.size} messages from Discord`)

    if (!discordMessages) {
      console.log('❌ No messages found')
      return []
    }

    // Transform Discord messages to our app's Message type
    const messages = await Promise.all(Array.from(discordMessages.values())
      .map(async msg => {
        // Get referenced message author if it exists
        let referencedAuthorId: string | null = null
        if (msg.reference?.messageId) {
          const referencingBot = bots?.find(bot => 
            msg.reference && bot.discord_id === msg.reference.messageId
          )
          referencedAuthorId = referencingBot?.discord_id || null
        }

        // Get referenced message content
        let referencedContent: string | null = null
        if (msg.reference?.messageId) {
          try {
            const referencedMsg = await channel.messages.fetch(msg.reference.messageId)
            referencedContent = referencedMsg.content
          } catch (error) {
            console.warn('Could not fetch referenced message:', error)
            referencedContent = null
          }
        }

        const transformedContent = await transformDiscordMessage(msg.content, botMappings)

        const transformedMessage: AppMessage = {
          id: msg.id,
          content: transformedContent,
          channel_id: msg.channelId,
          sender_id: msg.author.id,
          author_username: msg.author.username,
          author_display_name: msg.member?.displayName || msg.author.displayName || msg.author.username,
          sent_at: msg.createdAt.toISOString(),
          referenced_message_id: msg.reference?.messageId || null,
          referenced_message_author_id: referencedAuthorId,
          referenced_message_content: referencedContent,
          attachments: [],
          embeds: [],
          stickers: [],
          isFromBot: msg.author.bot,
          replyingToBot: msg.reference ? 
            (bots?.some(bot => bot.discord_id === msg.reference?.messageId) ?? false) : 
            false
        }

        return transformedMessage
      }))

    return messages
  } catch (error) {
    console.error('Error fetching messages:', error)
    return []
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
    // Keep last 300 messages per channel, plus all bot-related messages
    const { error } = await supabase.rpc('cleanup_old_messages')

    if (error) {
      console.error('❌ Discord: Error cleaning up old messages:', error)
    } else {
      console.log('🧹 Discord: Cleaned up old messages')
    }

    // Also cleanup old images
    await cleanupOldImages()
  } catch (error) {
    console.error('❌ Discord: Error in cleanupOldMessages:', error)
  }
}

interface BotMapping {
  id: string;
  name: string;
}

export async function transformDiscordMessage(content: string, botMappings: BotMapping[]): Promise<string> {
  // Replace bot mentions with display names
  let transformedContent = content;
  
  for (const bot of botMappings) {
    const mentionRegex = new RegExp(`<@${bot.id}>`, 'g');
    transformedContent = transformedContent.replace(mentionRegex, `@${bot.name}`);
  }

  // Handle other Discord message transformations
  // ... existing code for other transformations ...

  return transformedContent;
}

export async function getBotMappings(supabase: SupabaseClient): Promise<BotMapping[]> {
  const { data: bots, error } = await supabase
    .from('discord_bots')
    .select('discord_id, bot_name');

  if (error) {
    console.error('Error fetching bot mappings:', error);
    return [];
  }

  return bots.map(bot => ({
    id: bot.discord_id,
    name: bot.bot_name
  }));
}
