'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Message } from '@/types'
import { ChatInput } from '@/components/chat/ChatInput'
import Message from '@/components/Message'

export default function ChatPage({ params }: { params: { channelId: string } }) {
  const { publicKey } = useWallet()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMessages = async () => {
      if (!params.channelId || !publicKey) return
      setLoading(true)
      try {
        const response = await fetch(`/api/messages/${params.channelId}?wallet=${publicKey}`)
        const data = await response.json()
        setMessages(data.messages)
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [params.channelId, publicKey])

  return (
    <div className="flex-1 flex flex-col bg-[#1E1E24]">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map(message => (
            <Message key={message.id} message={message} />
          ))}
        </div>
      )}
      <ChatInput 
        channelId={params.channelId}
        onSendMessage={/* ... */}
        replyTo={/* ... */}
        onCancelReply={/* ... */}
        onRefreshMessages={/* ... */}
      />
    </div>
  )
} 