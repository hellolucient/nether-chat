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

  useEffect(() => {
    async function fetchChannels() {
      if (!publicKey) return

      // First, check if user has any channel restrictions
      const { data: botAssignment } = await supabase
        .from('bot_assignments')
        .select('channel_access')
        .eq('wallet_address', publicKey.toString())
        .single()

      // Fetch all channels
      const response = await fetch('/api/channels')
      const data = await response.json()

      if (data.channels) {
        // If user has restrictions, filter channels
        if (botAssignment?.channel_access) {
          const allowedChannels = data.channels.filter(
            (channel: Channel) => botAssignment.channel_access.includes(channel.id)
          )
          setChannels(allowedChannels)
          // Check unread status for all channels
          await checkUnreadMessages(allowedChannels)
        } else {
          // If no bot assignment found, show no channels
          setChannels([])
        }
      }
    }

    fetchChannels()
  }, [publicKey, checkUnreadMessages])

  // Add real-time subscription
  useEffect(() => {
    if (!channels.length || !publicKey) return
    checkUnreadMessages(channels)
  }, [channels, publicKey, checkUnreadMessages])

  console.log('ChannelList render:', {
    channels: channels.map(c => c.id),
    unreadChannels: Array.from(unreadChannels)
  })

  return (
    <div className="space-y-2">
      {channels.map(channel => {
        const hasUnread = unreadChannels.has(channel.id)
        console.log(`Channel ${channel.id}:`, { hasUnread })
        
        return (
          <button
            key={channel.id}
            onClick={() => {
              onSelectChannel(channel.id)
            }}
            className="w-full text-left px-2 py-1 rounded hover:bg-[#262626] transition-colors flex justify-between items-center"
          >
            <span>{channel.name}</span>
            {hasUnread && (
              <span className="w-2 h-2 rounded-full bg-purple-500" />
            )}
          </button>
        )
      })}
    </div>
  )
} 