import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'

interface UnreadContextType {
  unreadChannels: Set<string>
  markChannelAsRead: (channelId: string) => void
  markChannelAsUnread: (channelId: string) => void
  checkUnreadChannels: () => Promise<void>
  clearAllUnread: () => Promise<void>
}

export const UnreadContext = createContext<UnreadContextType | null>(null)

interface DiscordBot {
  discord_id: string
  bot_name: string
}

interface BotAssignment {
  bot_id: string
  discord_bots: DiscordBot
}

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set())
  const { publicKey } = useWallet()

  const markChannelAsRead = useCallback(async (channelId: string) => {
    if (!publicKey) return

    try {
      console.log('📝 Marking channel as read:', channelId)

      const now = new Date().toISOString()
      
      // Update last_viewed in Supabase - only update last_viewed timestamp
      const { error } = await supabase
        .from('last_viewed')
        .upsert({
          channel_id: channelId,
          wallet_address: publicKey.toString(),
          last_viewed: now
        }, {
          onConflict: 'channel_id,wallet_address'
        })

      if (error) {
        console.error('❌ Error updating last_viewed:', error)
        return
      }

      // Update UI state immediately
      setUnreadChannels(prev => {
        const next = new Set(prev)
        next.delete(channelId)
        return next
      })

    } catch (error) {
      console.error('Failed to mark channel as read:', error)
    }
  }, [publicKey])

  const checkUnreadChannels = useCallback(async () => {
    if (!publicKey) return

    try {
      // First get the current user's bot ID
      const { data: botAssignment } = await supabase
        .from('bot_assignments')
        .select(`
          bot_id,
          discord_bots (
            discord_id,
            bot_name
          )
        `)
        .eq('wallet_address', publicKey.toString())
        .single() as { data: BotAssignment | null }

      if (!botAssignment?.discord_bots?.discord_id) {
        console.log('No bot found for wallet:', publicKey.toString())
        return
      }

      const botId = botAssignment.discord_bots.discord_id
      console.log('Checking unread for bot:', botId)

      // Get last viewed times
      const { data: lastViewed } = await supabase
        .from('last_viewed')
        .select('channel_id, last_viewed')
        .eq('wallet_address', publicKey.toString())

      // Get messages that are:
      // 1. From this bot
      // 2. Replies to this bot
      // 3. Mention this bot
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${botId},referenced_message_author_id.eq.${botId}`)
        .order('sent_at', { ascending: false })

      console.log('Found messages:', {
        total: messages?.length || 0,
        botId,
        lastViewed: lastViewed?.length || 0
      })

      // Update unread state based on bot messages only
      const newUnread = new Set<string>()
      messages?.forEach(msg => {
        const lastViewedTime = lastViewed?.find(lv => 
          lv.channel_id === msg.channel_id
        )?.last_viewed || '1970-01-01'

        if (new Date(msg.sent_at) > new Date(lastViewedTime)) {
          newUnread.add(msg.channel_id)
          console.log('Adding unread channel:', {
            channel: msg.channel_id,
            messageTime: msg.sent_at,
            lastViewed: lastViewedTime
          })
        }
      })

      console.log('Setting unread channels:', Array.from(newUnread))
      setUnreadChannels(newUnread)
    } catch (error) {
      console.error('Failed to check unread channels:', error)
    }
  }, [publicKey])

  const clearAllUnread = useCallback(async () => {
    if (!publicKey) return

    try {
      console.log('🧹 Clearing all unread notifications')
      const now = new Date().toISOString()

      // Get all channels that are currently unread
      const channelsToUpdate = Array.from(unreadChannels)

      if (channelsToUpdate.length === 0) return

      // Update all unread channels at once
      const { error } = await supabase
        .from('last_viewed')
        .upsert(
          channelsToUpdate.map(channelId => ({
            channel_id: channelId,
            wallet_address: publicKey.toString(),
            last_viewed: now
          })),
          { onConflict: 'channel_id,wallet_address' }
        )

      if (error) {
        console.error('❌ Error clearing notifications:', error)
        return
      }

      // Clear UI state immediately
      setUnreadChannels(new Set())

    } catch (error) {
      console.error('Failed to clear notifications:', error)
    }
  }, [publicKey, unreadChannels])

  // Remove or modify the periodic check to not override manual read states
  useEffect(() => {
    if (!publicKey) return

    // Initial check
    checkUnreadChannels()

    // Set up less frequent periodic checks
    const interval = setInterval(() => {
      checkUnreadChannels()
    }, 60000) // Check every minute instead of 30 seconds

    return () => clearInterval(interval)
  }, [publicKey, checkUnreadChannels])

  return (
    <UnreadContext.Provider value={{ 
      unreadChannels, 
      markChannelAsRead, 
      markChannelAsUnread: checkUnreadChannels,
      checkUnreadChannels,
      clearAllUnread
    }}>
      {children}
    </UnreadContext.Provider>
  )
}

export function useUnread() {
  const context = useContext(UnreadContext)
  if (!context) {
    throw new Error('useUnread must be used within an UnreadProvider')
  }
  return context
} 