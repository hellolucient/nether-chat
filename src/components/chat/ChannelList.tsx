'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { useUnread } from '@/contexts/UnreadContext'

interface Channel {
  id: string
  name: string
}

interface BotAssignment {
  id: string
  wallet_address: string
  channel_mappings: {
    channel_id: string
  }[]
}

interface Props {
  onSelectChannel: (channelId: string) => void
}

export function ChannelList({ onSelectChannel }: Props) {
  const { unreadChannels, markChannelAsUnread } = useUnread()
  const { publicKey } = useWallet()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  const checkUnreadMessages = useCallback(async (channels: Channel[]) => {
    if (!publicKey) return

    for (const channel of channels) {
      // Get last viewed time
      const { data: lastViewed } = await supabase
        .from('last_viewed')
        .select('last_viewed')
        .eq('channel_id', channel.id)
        .eq('wallet_address', publicKey.toString())
        .single()

      // Get latest message for channel
      const response = await fetch(`/api/messages/${channel.id}?wallet=${publicKey.toString()}`)
      const data = await response.json()
      const messages = data.messages || []

      if (messages.length > 0) {
        const lastViewedTime = lastViewed?.last_viewed ? new Date(lastViewed.last_viewed) : new Date(0)
        const latestMessage = messages[messages.length - 1]
        const messageTime = new Date(latestMessage.timestamp)

        console.log(`Checking channel ${channel.id}:`, {
          lastViewedTime,
          messageTime,
          hasUnread: messageTime > lastViewedTime
        })

        if (messageTime > lastViewedTime) {
          markChannelAsUnread(channel.id)
        }
      }
    }
  }, [publicKey, markChannelAsUnread])

  const fetchChannels = async () => {
    try {
      setLoading(true)
      console.log('🔍 ChannelList: Fetching channels...', publicKey?.toString())
      
      if (!publicKey) {
        console.log('No wallet connected, skipping channel fetch')
        setChannels([])
        return
      }

      // Get bot assignment for this wallet
      const { data: assignment, error: assignmentError } = await supabase
        .from('bot_assignments')
        .select('*')
        .eq('wallet_address', publicKey.toString())
        .maybeSingle()

      console.log('Bot assignment query result:', { assignment, assignmentError })

      // If no assignment found, return empty channels
      if (!assignment) {
        console.log('No bot assignment found for wallet:', publicKey.toString())
        setChannels([])
        return
      }

      // Get channel details from Discord
      const response = await fetch('/api/channels')
      const { channels: allChannels } = await response.json()

      // If admin, show all channels
      if (assignment.is_admin) {
        console.log('Admin user - showing all channels')
        setChannels(allChannels)
        return
      }

      // For regular users, filter by channel_access
      const channelIds = assignment.channel_access || []
      console.log('Channel IDs for wallet:', channelIds)

      const accessibleChannels = allChannels.filter(
        (channel: any) => channelIds.includes(channel.id)
      )
      console.log('Accessible channels:', accessibleChannels)

      setChannels(accessibleChannels)
    } catch (error) {
      console.error('Error fetching channels:', error)
      setChannels([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (publicKey) {  // Only fetch if we have a publicKey
      fetchChannels()
    }
  }, [publicKey]) // Remove fetchChannels from deps to avoid recreation

  // Add real-time subscription
  useEffect(() => {
    if (!channels.length || !publicKey) return
    checkUnreadMessages(channels)
  }, [channels, publicKey, checkUnreadMessages])

  const fetchUnreadStatus = async () => {
    try {
      const { data: lastViewed } = await supabase
        .from('last_viewed')
        .select('*')
        .in('channel_id', channels.map(c => c.id))

      // ... rest of unread logic ...
    } catch (error) {
      console.error('Error fetching unread status:', error)
    }
  }

  console.log('ChannelList render:', {
    channels: channels.map(c => c.id),
    unreadChannels: Array.from(unreadChannels)
  })

  return (
    <div className="flex flex-col space-y-2 w-full">
      {loading ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
        </div>
      ) : (
        channels.map(channel => (
          <div key={channel.id} className="w-full">
            <button
              onClick={() => onSelectChannel(channel.id)}
              className="w-full text-left p-2 hover:bg-[#262626] rounded-md flex items-center"
            >
              <span className="flex-grow">{channel.name}</span>
              {unreadChannels.has(channel.id) && (
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>
        ))
      )}
    </div>
  )
} 