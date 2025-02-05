'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { useUnread } from '@/contexts/UnreadContext'

interface Channel {
  id: string
  name: string
}

interface Props {
  onSelectChannel: (channelId: string) => void
}

export function ChannelList({ onSelectChannel }: Props) {
  const { unreadChannels, markChannelAsUnread } = useUnread()
  const { publicKey } = useWallet()
  const [channels, setChannels] = useState<Channel[]>([])

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
      console.log('🔍 ChannelList: Fetching channels...')
      const response = await fetch('/api/channels')
      console.log('🔍 ChannelList: Got response:', response.status)
      const data = await response.json()
      console.log('🔍 ChannelList: Got data:', data)
      // First get the bot assignment for this wallet
      const { data: assignments, error: assignmentError } = await supabase
        .from('bot_assignments')
        .select(`
          id,
          channels:channel_mappings(channel_id)
        `)
        .eq('wallet_address', publicKey?.toString())
        .single()

      if (assignmentError) throw assignmentError

      // Get the channel IDs this user has access to
      const channelIds = assignments?.channels?.map(c => c.channel_id) || []

      // Then fetch channel details from Discord
      const allChannels = data.channels || []

      // Filter to only show channels the user has access to
      const accessibleChannels = allChannels.filter(
        channel => channelIds.includes(channel.id)
      )

      setChannels(accessibleChannels)
    } catch (error) {
      console.error('Error fetching channels:', error)
    }
  }

  useEffect(() => {
    fetchChannels()
  }, [publicKey, fetchChannels])

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
      {channels.map(channel => (
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
      ))}
    </div>
  )
} 