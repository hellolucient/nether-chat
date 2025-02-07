import React, { useRef, useEffect, useState } from 'react'
import LoadingSpinner from '../LoadingSpinner'
import type { Message } from '@/types'

interface MessageListProps {
  messages: Message[]
  selectedChannel: string
  fetchMessages: () => Promise<void>
}

export function MessageList({ messages, selectedChannel, fetchMessages }: MessageListProps) {
  const messageListRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  const scrollToBottom = () => {
    const messageList = messageListRef.current
    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight
    }
  }

  useEffect(() => {
    setIsLoading(true)
    fetchMessages().finally(() => setIsLoading(false))
  }, [selectedChannel, fetchMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, selectedChannel])

  return (
    <div ref={messageListRef} className="message-list">
      {isLoading ? (
        <div className="flex justify-center items-center h-full">
          <LoadingSpinner />
        </div>
      ) : (
        // Message list content
      )}
    </div>
  )
} 