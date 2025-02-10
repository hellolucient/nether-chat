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
  const [authorized, setAuthorized] = useState(true)  // Start as true to prevent flash
  const [checkingAccess, setCheckingAccess] = useState(true)  // New state
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  // Add ref for message container
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Scroll when messages load or change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const checkAccess = useCallback(async () => {
    if (!publicKey) return
    
    try {
      setCheckingAccess(true)
      const { data } = await supabase
        .from('bot_assignments')
        .select('channel_access')
        .eq('wallet_address', publicKey.toString())
        .single()

      setAuthorized(data?.channel_access?.includes(channelId) ?? false)
    } catch (error) {
      console.error('Error checking access:', error)
      setAuthorized(false)
    } finally {
      setCheckingAccess(false)
    }
  }, [publicKey, channelId])

  // Add debug logs
  useEffect(() => {
    console.log('Channel changed to:', channelId)
    console.log('Loading state:', loading)
  }, [channelId, loading])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      console.log('🔎 Attempting to fetch messages:', {
        channelId,
        wallet: publicKey?.toString()
      })
      
      if (!publicKey) {
        console.log('❌ No wallet connected, skipping fetch')
        return
      }

      if (!channelId) {
        console.log('❌ No channel ID, skipping fetch')
        return
      }

      const url = `/api/messages/${channelId}?wallet=${publicKey}`
      console.log('📡 Making request to:', url)

      const response = await fetch(url)
      console.log('📥 Got response:', {
        status: response.status,
        ok: response.ok
      })

      if (!response.ok) {
        const text = await response.text()
        console.error('❌ Message fetch failed:', {
          status: response.status,
          text
        })
        return
      }

      const data = await response.json()
      console.log('✅ Got messages:', {
        count: data.messages?.length
      })
      setMessages(data.messages)
    } catch (error) {
      console.error('❌ Error in fetchMessages:', error)
    } finally {
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
      console.log('📨 Chat: Sending message...')
      
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

      // Add delay to allow Discord to process
      console.log('Waiting for Discord to process...')
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Force refresh messages after delay
      console.log('Refreshing messages...')
      await fetchMessages()
      console.log('Messages refreshed')

      // After sending, check for new messages in other channels
      await checkUnreadChannels()
    } catch (error) {
      console.error('❌ Chat: Error sending message:', error)
    }
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

  if (!checkingAccess && !authorized) {
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
        <div ref={messagesEndRef} /> {/* Add scroll anchor */}
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