import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'

interface UnreadContextType {
  unreadChannels: Set<string>
  markChannelAsRead: (channelId: string) => void
  markChannelAsUnread: (channelId: string) => void
  checkUnreadChannels: () => Promise<void>
}

export const UnreadContext = createContext<UnreadContextType | null>(null)

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set())
  const { publicKey } = useWallet()

  const markChannelAsRead = useCallback(async (channelId: string) => {
    if (!publicKey) return

    try {
      const timestamp = new Date().toISOString()
      console.log('📝 Attempting to update last_viewed:', {
        channelId,
        wallet: publicKey.toString(),
        timestamp
      })

      // First check if entry exists
      const { data: existing } = await supabase
        .from('last_viewed')
        .select('*')
        .eq('channel_id', channelId)
        .eq('wallet_address', publicKey.toString())
        .single()

      console.log('Existing last_viewed entry:', existing)

      const { error } = await supabase.from('last_viewed').upsert({
        channel_id: channelId,
        wallet_address: publicKey.toString(),
        last_viewed: timestamp,
        viewed_at: timestamp
      })

      if (error) {
        console.error('❌ Error updating last_viewed:', {
          error,
          code: error.code,
          details: error.details,
          message: error.message
        })
        return
      }

      console.log('✅ Updated last_viewed:', { channelId, timestamp })
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
      console.log('🔍 Checking unread channels for wallet:', publicKey.toString())
      const response = await fetch(`/api/channels/unread`, {
        headers: {
          'x-wallet-address': publicKey.toString()
        }
      })
      
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

  // Check for unread messages periodically
  useEffect(() => {
    if (!publicKey) return

    // Initial check
    checkUnreadChannels()

    // Set up periodic checks
    const interval = setInterval(checkUnreadChannels, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [publicKey, checkUnreadChannels])

  return (
    <UnreadContext.Provider value={{ 
      unreadChannels, 
      markChannelAsRead, 
      markChannelAsUnread: checkUnreadChannels, // Use checkUnreadChannels as markChannelAsUnread
      checkUnreadChannels 
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