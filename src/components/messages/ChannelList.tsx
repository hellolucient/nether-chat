import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Message {
  id: string
  content: string
  channelId: string
  created_at: string
}

interface ChannelListProps {
  selectedChannel: string
  onChannelSelect: (channelId: string) => void
}

export function ChannelList({ selectedChannel, onChannelSelect }: ChannelListProps) {
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set())

  useEffect(() => {
    const handleNewMessage = (payload: { new: Message }) => {
      if (payload.new.channelId !== selectedChannel) {
        setUnreadChannels(prev => new Set([...prev, payload.new.channelId]))
      }
    }

    supabase
      .channel('messages')
      .on(
        'INSERT',
        'public:messages',
        handleNewMessage
      )
      .subscribe()

    return () => {
      supabase.channel('messages').unsubscribe()
    }
  }, [selectedChannel])

  // Rest of your component code...
} 