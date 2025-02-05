'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import type { Message } from '@/types'
import { supabase } from '@/lib/supabase'
import { useWallet } from '@solana/wallet-adapter-react'
import { useUnread } from '@/contexts/UnreadContext'

interface ChatProps {
  channelId: string
}

interface MessageContent {
  type: string
  url: string
  reply?: {
    messageReference: { messageId: string }
    quotedContent: string
  }
}

export function Chat({ channelId }: ChatProps) {
  const { publicKey } = useWallet()
  const { markChannelAsRead, markChannelAsUnread } = useUnread()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  const checkAccess = useCallback(async () => {
    if (!publicKey) return

    const { data } = await supabase
      .from('bot_assignments')
      .select('channel_access')
      .eq('wallet_address', publicKey.toString())
      .single()

    if (data?.channel_access?.includes(channelId)) {
      setAuthorized(true)
    } else {
      setAuthorized(false)
    }
    setLoading(false)
  }, [publicKey, channelId])

  const fetchMessages = useCallback(async () => {
    if (!channelId || !publicKey) {
      console.log('⚠️ Chat: No channelId or wallet provided')
      return
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        setLoading(true)
        const response = await fetch(`/api/messages/${channelId}?wallet=${publicKey.toString()}`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        setMessages(data.messages || [])
        return
      } catch (error) {
        console.error(`❌ Chat: Error attempt ${attempts + 1}:`, error)
        attempts++
        if (attempts === maxAttempts) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
      } finally {
        setLoading(false)
      }
    }
  }, [channelId, publicKey])

  // Fetch messages and check access
  useEffect(() => {
    if (channelId && publicKey) {
      fetchMessages()
      checkAccess()
    }
  }, [channelId, publicKey, fetchMessages, checkAccess])

  // Update last viewed time in database
  const updateLastViewed = useCallback(async () => {
    if (!channelId || !publicKey) return

    try {
      console.log('Updating last_viewed:', {
        channel_id: channelId,
        wallet_address: publicKey.toString()
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
        console.error('Error updating last_viewed:', error)
      }
    } catch (err) {
      console.error('Failed to update last_viewed:', err)
    }
  }, [channelId, publicKey])

  // Handle focus changes
  useEffect(() => {
    const handleFocus = async () => {
      if (document.hasFocus() && channelId) {
        await updateLastViewed()
        markChannelAsRead(channelId)
      }
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleFocus)
    
    // Initial check
    handleFocus()

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleFocus)
    }
  }, [channelId, publicKey, updateLastViewed, markChannelAsRead])

  // Check for new messages
  useEffect(() => {
    async function checkNewMessages() {
      if (!messages.length || !channelId || !publicKey) return

      // Get last viewed time from database
      const { data: lastViewed } = await supabase
        .from('last_viewed')
        .select('last_viewed')
        .eq('channel_id', channelId)
        .eq('wallet_address', publicKey.toString())
        .single()

      const lastViewedTime = lastViewed?.last_viewed ? new Date(lastViewed.last_viewed) : new Date(0)
      const latestMessage = messages[messages.length - 1]
      const messageTime = new Date(latestMessage.timestamp)

      console.log('Checking messages:', {
        lastViewedTime,
        messageTime,
        isWindowFocused: document.hasFocus(),
        shouldMarkUnread: messageTime > lastViewedTime && !document.hasFocus()
      })

      if (messageTime > lastViewedTime && !document.hasFocus()) {
        console.log('Marking channel as unread:', channelId)
        markChannelAsUnread(channelId)
      }
    }

    checkNewMessages()
  }, [messages, channelId, publicKey, markChannelAsUnread])

  const handleSendMessage = async (content: string | MessageContent) => {
    try {
      console.log('📨 Chat: Sending message:', {
        channelId,
        contentType: typeof content === 'object' ? content.type : 'text'
      })

      const response = await fetch(`/api/messages/${channelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      await fetchMessages()
    } catch (error) {
      console.error('❌ Chat: Error sending message:', error)
    }
  }

  if (loading) return <div>Loading...</div>
  
  if (!authorized) {
    return (
      <div className="flex-1 p-4">
        <div className="text-center text-red-400">
          You don&apos;t have access to this channel
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <MessageList 
          messages={messages} 
          loading={loading}
          channelId={channelId}
          onRefresh={fetchMessages}
        />
      </div>
      <div className="mt-auto border-t border-[#262626]">
        <ChatInput 
          channelId={channelId}
          onSendMessage={handleSendMessage}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onRefreshMessages={fetchMessages}
        />
      </div>
    </div>
  )
} 