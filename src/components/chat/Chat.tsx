'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  const { markChannelAsRead, checkUnreadChannels } = useUnread()
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

  const fetchMessages = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/messages/${channelId}?wallet=${publicKey}`)
      const data = await response.json()
      setMessages(data.messages)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      setLoading(false)
    }
  }

  // Fetch messages and check access
  useEffect(() => {
    if (channelId && publicKey) {
      fetchMessages()
      checkAccess()
    }
  }, [channelId, publicKey, checkAccess])

  // Mark channel as read when viewing
  useEffect(() => {
    if (channelId && document.hasFocus()) {
      markChannelAsRead(channelId)
    }

    const handleFocus = () => {
      if (channelId) {
        markChannelAsRead(channelId)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [channelId, markChannelAsRead])

  const handleSendMessage = async (content: string | MessageContent) => {
    if (!channelId) return

    try {
      console.log('📨 Chat: Sending message:', { channelId, contentType: typeof content === 'object' ? content.type : 'text' })
      
      const response = await fetch(`/api/messages/${channelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(typeof content === 'object' ? content : { content, type: 'text' }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Force refresh messages after sending
      await fetchMessages()

      // After sending, check for new messages in other channels
      await checkUnreadChannels()
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
          onReplyTo={setReplyTo}
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