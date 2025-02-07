import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message } from '@/types'

interface ChannelListProps {
  selectedChannel: string
  onChannelSelect: (channelId: string) => void
}

export function ChannelList({ selectedChannel, onChannelSelect }: ChannelListProps) {
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set())

  useEffect(() => {
    const handleNewMessage = (message: Message) => {
      if (message.channelId !== selectedChannel) {
        setUnreadChannels(prev => new Set([...prev, message.channelId]))
      }
    }

    supabase
      .channel('messages')
      .on('INSERT', handleNewMessage)
      .subscribe()

    return () => {
      supabase.channel('messages').unsubscribe()
    }
  }, [selectedChannel])

  // Rest of your component code...
} 