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

interface BotAssignment {
  discord_bots: {
    discord_id: string
  }
}

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set())
  const { publicKey } = useWallet()

  const markChannelAsRead = useCallback(async (channelId: string) => {
    if (!publicKey) return

    try {
      console.log('📝 Attempting to update last_viewed:', {
        channelId,
        wallet: publicKey.toString(),
        timestamp: new Date().toISOString()
      })

      const { error } = await supabase
        .from('last_viewed')
        .upsert({
          channel_id: channelId,
          wallet_address: publicKey.toString(),
          last_viewed: new Date().toISOString()
        }, {
          onConflict: 'channel_id,wallet_address'
        })

      if (error) {
        console.error('❌ Error updating last_viewed:', error)
        return
      }

      // Verify the update
      const { data: updated } = await supabase
        .from('last_viewed')
        .select('*')
        .eq('channel_id', channelId)
        .eq('wallet_address', publicKey.toString())
        .single()

      console.log('🔍 Last viewed after update:', updated)

      // Need to also update UI state!
      setUnreadChannels(prev => {
        const next = new Set(prev)
        next.delete(channelId)
        return next
      })

      console.log('✅ Marked channel as read:', channelId)
    } catch (error) {
      console.error('Failed to mark channel as read:', error)
    }
  }, [publicKey])

  const checkUnreadChannels = useCallback(async () => {
    if (!publicKey) return

    try {
      console.log('🔍 Checking unread channels for wallet:', publicKey.toString())
      const response = await fetch(`/api/channels/unread?wallet=${publicKey.toString()}`)
      
      if (!response.ok) {
        const error = await response.text()
        console.error('❌ Error response:', error)
        return
      }

      const data = await response.json()
      console.log('📬 Unread channels response:', data)
      
      if (data.unreadChannels) {
        console.log('✨ Setting unread channels:', data.unreadChannels)
        setUnreadChannels(new Set(data.unreadChannels))
      }
    } catch (error) {
      console.error('❌ Failed to check unread channels:', error)
    }
  }, [publicKey])

  const clearAllUnread = useCallback(async () => {
    if (!publicKey) return

    try {
      console.log('🧹 Starting clear all unread:', {
        wallet: publicKey.toString(),
        unreadChannels: Array.from(unreadChannels)
      })

      // First get our bot's ID
      const { data: botAssignment } = await supabase
        .from('bot_assignments')
        .select(`
          discord_bots!inner (
            discord_id
          )
        `)
        .eq('wallet_address', publicKey.toString())
        .single() as { data: BotAssignment | null }

      if (!botAssignment?.discord_bots?.discord_id) {
        console.log('No bot found for wallet')
        return
      }

      const botId = botAssignment.discord_bots.discord_id

      // Get messages that mention/reply to our bot
      const { data: messages } = await supabase
        .from('messages')
        .select('channel_id, sent_at')
        .or(`referenced_message_author_id.eq.${botId},content.ilike.%<@${botId}>%`)
        .order('sent_at', { ascending: false })

      if (!messages?.length) {
        console.log('No messages to clear')
        return
      }

      const now = new Date().toISOString()
      
      // Create last_viewed entries for all channels with messages
      const uniqueChannels = [...new Set(messages.map(m => m.channel_id))]
      console.log('📝 Updating last_viewed for channels:', uniqueChannels)

      const { error } = await supabase
        .from('last_viewed')
        .upsert(
          uniqueChannels.map(channelId => ({
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

      // Clear UI state
      setUnreadChannels(new Set())
      console.log('✨ Cleared all unread notifications')

      // Force refresh unread status
      await checkUnreadChannels()
    } catch (error) {
      console.error('Failed to clear notifications:', error)
    }
  }, [publicKey, unreadChannels, checkUnreadChannels])

  // Add some debug logging to see if we're getting notifications
  useEffect(() => {
    if (!publicKey) return

    console.log('🔔 Setting up unread check for wallet:', publicKey.toString())
    
    // Initial check
    checkUnreadChannels()

    // Set up periodic checks
    const interval = setInterval(() => {
      console.log('🔄 Running periodic unread check...')
      checkUnreadChannels()
    }, 30000)

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