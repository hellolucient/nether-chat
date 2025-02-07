import React, { useRef, useEffect, useState } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { Message } from '@/types'

interface MessageListProps {
  messages: Message[]
  channelId: string
  onRefresh: () => Promise<void>
  onReplyTo: (message: Message | null) => void
  loading: boolean
}

export function MessageList({ 
  messages, 
  channelId, 
  onRefresh,
  onReplyTo,
  loading 
}: MessageListProps) {
  const messageListRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    const messageList = messageListRef.current
    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, channelId])

  return (
    <div ref={messageListRef} className="message-list h-full overflow-y-auto relative">
      {loading ? (
        <div className="absolute inset-0 flex justify-center items-center bg-black/50">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {messages.map((message) => (
            <div key={message.id} className="message">
              <div className="text-sm text-gray-300">{message.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 