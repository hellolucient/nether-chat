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

    try {
      console.log('Checking access...')
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
    } catch (error) {
      console.error('Error checking access:', error)
      setAuthorized(false)
    }
  }, [publicKey, channelId])

  // Add debug logs
  useEffect(() => {
    console.log('Channel changed to:', channelId)
    console.log('Loading state:', loading)
  }, [channelId, loading])

  const fetchMessages = async () => {
    try {
      console.log('Starting to fetch messages...')
      setLoading(true)  // Set loading at start
      
      // Wait for both operations
      await Promise.all([
        checkAccess(),
        (async () => {
          const response = await fetch(`/api/messages/${channelId}?wallet=${publicKey}`)
          const data = await response.json()
          setMessages(data.messages)
        })()
      ])

      console.log('Messages fetched successfully')
      setLoading(false)  // Only set loading false after everything is done
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      setLoading(false)
    }
  }

  // Update the effect to only call fetchMessages
  useEffect(() => {
    if (channelId && publicKey) {
      fetchMessages()
    }
  }, [channelId, publicKey])

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

  if (!authorized) {
    return (
      <div className="flex-1 p-4">
        <div className="text-center text-red-400">
          You don&apos;t have access to this channel
        </div>
      </div>
    )
  }

  if (loading) {
    console.log('Rendering loading state...')
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            <img 
              src="/nether-world.png" 
              alt="Loading" 
              className="w-16 h-16 mx-auto animate-pulse"
            />
            <div className="text-2xl text-purple-300 animate-pulse">
              Loading... chatter incoming
            </div>
          </div>
        </div>
        <div className="mt-auto border-t border-[#262626]">
          {/* Empty div to maintain layout */}
          <div className="h-[76px]"></div>
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