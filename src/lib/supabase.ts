import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

export async function getBotForWallet(walletAddress: string) {
  const { data, error } = await supabase
    .from('bot_assignments')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single()

  if (error) throw error
  return data
}

export async function getChannels() {
  const { data, error } = await supabase
    .from('channel_mappings')
    .select('*')
    .order('position', { ascending: true })

  if (error) throw error
  return data
}

export async function getChannelMessages(channelId: string, walletAddress: string) {
  console.log('📊 Fetching messages from Supabase for channel:', channelId)
  
  // Get messages for this channel
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('sent_at', { ascending: false })
    .limit(300)  // Keep last 300 messages

  if (error) {
    console.error('❌ Error fetching messages:', error)
    throw error
  }

  // Get the specific bot for this wallet
  const { data: userBot } = await supabase
    .from('bot_assignments')
    .select('bot_id')
    .eq('wallet_address', walletAddress)
    .single()

  // Get bot details
  const { data: bot } = await supabase
    .from('discord_bots')
    .select('discord_id, bot_name')
    .eq('id', userBot?.bot_id)
    .single()

  // Transform messages and add bot flags - now only for user's bot
  const transformed = messages.map(msg => {
    const isBot = bot?.discord_id === msg.sender_id
    // Check for bot mention using Discord ID format
    const hasBotMention = msg.content.includes(`<@${bot?.discord_id}>`)
    const replyingToBot = msg.referenced_message_id && 
      bot?.discord_id === msg.referenced_message_author_id

    console.log('🔍 Message flags:', {
      content: msg.content,
      botId: bot?.discord_id,
      hasBotMention,  // This should now be true for messages like <@1336956952546377768>
      isBot,
      replyingToBot
    })

    return {
      id: msg.id,
      content: msg.content,
      channelId: msg.channel_id,
      author: {
        id: msg.sender_id,
        username: msg.author_username || 'Unknown'
      },
      timestamp: msg.sent_at,
      isFromBot: isBot,
      hasBotMention,
      replyingToBot,
      referenced_message_id: msg.referenced_message_id,
      referenced_message_content: msg.referenced_message_content,
      referenced_message_author_id: msg.referenced_message_author_id
    }
  })

  return transformed.reverse()
}

// Add this type and function
// type LastViewed = {
//   channel_id: string
//   last_viewed: string
// }

export async function updateLastViewed(channelId: string) {
  try {
    console.log('📝 Supabase: Updating last_viewed for channel:', channelId)
    const timestamp = new Date().toISOString()
    
    const { error } = await supabase
      .from('last_viewed')
      .upsert({ 
        channel_id: channelId,
        last_viewed: timestamp
      }, { 
        onConflict: 'channel_id' 
      })

    if (error) {
      console.error('❌ Supabase: Error updating last_viewed:', error)
      throw error
    }
  } catch (error) {
    console.error('❌ Supabase: Error in updateLastViewed:', error)
  }
}

export async function getUnreadStatus() {
  try {
    console.log('🔄 Supabase: Fetching unread status...')
    
    // Get last_viewed timestamps
    const { data: lastViewed, error: lastViewedError } = await supabase
      .from('last_viewed')
      .select('channel_id, last_viewed')

    if (lastViewedError) {
      console.error('❌ Supabase: Error fetching last_viewed:', lastViewedError)
      return {}
    }

    // Get bot IDs first
    const { data: bots } = await supabase
      .from('discord_bots')
      .select('discord_id')

    const botIds = new Set(bots?.map(b => b.discord_id) || [])

    // Get latest messages for each channel
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('channel_id, sent_at, sender_id, referenced_message_author_id, content')

    if (messagesError) {
      console.error('❌ Supabase: Error fetching messages:', messagesError)
      return {}
    }

    // Calculate unread status for each channel
    const unreadStatus = lastViewed?.reduce((acc, view) => {
      // Find latest bot-related message for this channel
      const latestMessage = messages?.filter(m => {
        // Message is bot-related if:
        const isFromBot = botIds.has(m.sender_id)
        const replyingToBot = botIds.has(m.referenced_message_author_id || '')
        const mentionsBot = botIds.size > 0 && 
          Array.from(botIds).some(id => m.content.includes(`<@${id}>`))

        return m.channel_id === view.channel_id && 
          (isFromBot || replyingToBot || mentionsBot)
      }).sort((a, b) => 
        new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      )[0]

      acc[view.channel_id] = latestMessage ? 
        new Date(latestMessage.sent_at) > new Date(view.last_viewed) : 
        false
      return acc
    }, {})

    console.log('📫 Supabase: Unread status:', unreadStatus)
    return unreadStatus
  } catch (error) {
    console.error('❌ Supabase: Error in getUnreadStatus:', error)
    return {}
  }
}

export async function initializeLastViewed() {
  try {
    console.log('🔄 Supabase: Starting last_viewed initialization')
    
    const { data: channels, error: channelsError } = await supabase
      .from('channel_mappings')
      .select('channel_id')

    if (channelsError) {
      console.error('❌ Supabase: Error fetching channels:', channelsError)
      throw channelsError
    }

    if (!channels || channels.length === 0) {
      console.log('⚠️ Supabase: No channels found to initialize')
      return
    }

    console.log('📊 Supabase: Found channels:', channels.length)

    // For each channel, ensure there's a last_viewed entry
    for (const channel of channels) {
      try {
        const channelId = channel.channel_id
        console.log('🔍 Supabase: Checking last_viewed for channel:', channelId)
        
        const { error: checkError } = await supabase
          .from('last_viewed')
          .select('*')
          .eq('channel_id', channelId)
          .single()

        if (checkError && checkError.code === 'PGRST116') {
          // No entry exists, create one
          console.log('📝 Supabase: Creating new last_viewed entry for channel:', channelId)
          
          const { error: insertError } = await supabase
            .from('last_viewed')
            .insert({
              channel_id: channelId,
              last_viewed: new Date().toISOString(),
              unread: false,
              last_updated: new Date().toISOString()
            })

          if (insertError) {
            console.error('❌ Supabase: Insert error for channel:', channelId, insertError)
            throw insertError
          }
        } else if (checkError) {
          console.error('❌ Supabase: Check error for channel:', channelId, checkError)
          throw checkError
        } else {
          console.log('✅ Supabase: Entry already exists for channel:', channelId)
        }
      } catch (channelError) {
        console.error('❌ Supabase: Error processing channel:', channelError)
        // Continue with other channels even if one fails
      }
    }

    console.log('✅ Supabase: Completed last_viewed initialization')
  } catch (error) {
    console.error('❌ Supabase: Error in initializeLastViewed:', error)
    throw error
  }
}
