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
  bot_token: string
  discord_id: string
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
      const response = await fetch(`/api/channels/unread?wallet=${publicKey.toString()}`)
      const { unreadChannels: newUnreadChannels } = await response.json()

      // Only update if we have new unread channels
      if (newUnreadChannels?.length > 0) {
        setUnreadChannels(new Set(newUnreadChannels))
      }
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