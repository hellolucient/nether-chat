'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { Message, MessageContent } from '@/types'
import { supabase } from '@/lib/supabase'
import { useWallet } from '@solana/wallet-adapter-react'
import { useUnread } from '@/contexts/UnreadContext'
import { getChannelMessages } from '@/lib/supabase'

interface ChatProps {
  channelId: string
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

  // Keep fetchMessages as a separate function for refresh functionality
  const fetchMessages = async () => {
    try {
      setLoading(true)
      const messages = await getChannelMessages(channelId, publicKey?.toString() || '')
      setMessages(messages)
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoading(false)
    }
  }

  // Use fetchMessages in the loadChannel function
  useEffect(() => {
    if (!channelId || !publicKey) return
    
    const loadChannel = async () => {
      setLoading(true)
      // Clear messages immediately when switching channels
      setMessages([])
      
      try {
        await fetchMessages()
        markChannelAsRead(channelId)
      } catch (error) {
        console.error('Failed to load channel:', error)
      }
    }

    loadChannel()
  }, [channelId, publicKey])

  const handleSendMessage = async (content: string | MessageContent) => {
    if (!channelId || !publicKey) return

    try {
      // Send the message first
      const response = await fetch(`/api/messages/${channelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': publicKey.toString()
        },
        body: JSON.stringify(
          typeof content === 'string' 
            ? { content, type: 'text' } 
            : content
        ),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('❌ Message send failed:', error)
        throw new Error('Failed to send message')
      }

      // Small delay before refreshing messages
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Refresh without loading state
      await fetchMessages()
      await checkUnreadChannels()
    } catch (error) {
      console.error('❌ Chat: Error sending message:', error)
      throw error
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
      {/* Messages container - add relative positioning */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <MessageList 
          messages={messages} 
          loading={loading}
          channelId={channelId}
          onRefresh={fetchMessages}
          onReplyTo={setReplyTo}
        />
      </div>
      
      {/* Input always at bottom */}
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