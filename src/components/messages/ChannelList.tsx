import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Message } from '../../types/Message'

const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set())

// Add this back to mark channels as unread
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