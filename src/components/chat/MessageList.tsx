'use client'

import { useEffect, useState, useRef } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import type { Message } from '@/types'

function formatDiscordMessage(content: string): string {
  // Handle custom emojis <:name:id> or <a:name:id>
  return content.replace(/<a?:\w+:\d+>/g, '🔸') // Replace with a placeholder for now
  // Later we can fetch the actual emoji URLs using the ID
}

function formatMessageContent(content: string) {
  // Check for our special GIF marker
  if (content.startsWith('__GIF__')) {
    const gifUrl = content.replace('__GIF__', '')
    return (
      <div className="!w-[200px] !h-[200px] overflow-hidden">
        <img 
          src={gifUrl} 
          alt="GIF" 
          className="!w-full !h-full !object-contain" 
          style={{ maxWidth: '200px', maxHeight: '200px' }}
        />
      </div>
    )
  }

  // Handle custom emojis and regular text
  return <p className="text-gray-100">{formatDiscordMessage(content)}</p>
}

function formatMessageWithQuotes(content: string) {
  const lines = content.split('\n')
  return lines.map((line, index) => {
    if (line.startsWith('> ')) {
      return (
        <div key={index} className="pl-2 border-l-2 border-gray-600 text-gray-400 mb-2">
          {line.substring(2)} {/* Remove the '> ' prefix */}
        </div>
      )
    }
    return <div key={index}>{line}</div>
  })
}

function MessageContent({ message }: { message: Message }) {
  console.log('Message content:', { 
    message,
    hasAttachments: !!message.attachments?.length,
    attachments: message.attachments,
    embeds: message.embeds,
    content: message.content
  })

  // If message has attachments (images)
  if (message.attachments?.length) {
    return (
      <div className="mt-1">
        {message.attachments.map((attachment, index) => {
          console.log('Rendering attachment:', attachment)
          return (
            <div key={`attachment-${index}`} className="max-w-[300px]">
              <img 
                src={attachment.url} 
                alt={attachment.filename || 'Attached image'}
                className="rounded-lg"
              />
            </div>
          )
        })}
      </div>
    )
  }

  // If it's a sticker message
  if (message.sticker_items?.length) {
    return (
      <div className="mt-1">
        {message.sticker_items.map((sticker, index) => (
          <div key={`sticker-${index}`} className="max-w-[160px]">
            <img
              src={`https://media.discordapp.net/stickers/${sticker.id}.png`}
              alt={sticker.name || 'Sticker'}
              className="rounded-lg"
            />
          </div>
        ))}
      </div>
    )
  }

  // If the message has a GIF/image embed or sticker, show that
  if (message.embeds?.some(embed => embed.type === 'gif' || embed.type === 'image') || message.stickers?.length) {
    return (
      <div className="mt-1">
        {/* Handle embeds (GIFs/images) */}
        {message.embeds?.map((embed, index) => (
          <div key={`embed-${index}`} className="max-w-[300px]">
            <img 
              src={embed.url || embed.image?.url} 
              alt="GIF" 
              className="rounded-lg"
            />
          </div>
        ))}

        {/* Handle stickers */}
        {message.stickers?.map((sticker, index) => (
          <div key={`sticker-${index}`} className="max-w-[200px]">
            <img
              src={sticker.url}
              alt={sticker.name}
              className="rounded-lg"
              style={{ maxWidth: '200px', maxHeight: '200px' }}
            />
          </div>
        ))}
      </div>
    )
  }

  // Otherwise show regular content
  return (
    <div className="text-gray-100 space-y-1">
      {formatMessageWithQuotes(message.content)}
    </div>
  )
}

interface MessageListProps {
  messages: Message[]
  loading: boolean
  channelId: string
  onRefresh: () => Promise<void>
  onReplyTo: (message: Message) => void
}

export function MessageList({ messages, loading, channelId, onRefresh, onReplyTo }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [displayMessages, setDisplayMessages] = useState<Message[]>([])

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
    setTimeout(() => {
      const messagesContainer = messagesEndRef.current?.parentElement
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight + 100
      }
    }, 100)
  }

  // Keep and enhance the original effect
  useEffect(() => {
    if (messages?.length > 0) {
      scrollToBottom(isInitialLoad ? 'auto' : 'smooth')
      if (isInitialLoad) {
        setIsInitialLoad(false)
      }
    }
  }, [messages, isInitialLoad])

  // Reset initial load state when channel changes
  useEffect(() => {
    setIsInitialLoad(true)
  }, [channelId])

  // Use a useEffect to smoothly transition messages
  useEffect(() => {
    if (loading) {
      // Don't update messages while loading
      return
    }
    
    // Update messages with a slight delay to prevent flash
    const timer = setTimeout(() => {
      setDisplayMessages(messages)
    }, 100)

    return () => clearTimeout(timer)
  }, [messages, loading])

  const handleRefresh = async () => {
    try {
      await onRefresh()
    } catch (error) {
      console.error('Failed to refresh messages:', error)
    }
  }

  console.log('🎯 MessageList: Rendering with:', {
    messageCount: messages?.length || 0,
    loading,
    channelId,
    hasRefresh: !!onRefresh,
    firstMessage: messages?.[0]
  })

  if (loading) {
    console.log('⏳ MessageList: Showing loading state')
    return <div className="flex items-center justify-center h-full">
      <div className="animate-pulse">Loading messages...</div>
    </div>
  }

  if (!messages || messages.length === 0) {
    console.log('⚠️ MessageList: No messages to display')
    return (
      <div className="flex flex-col flex-1">
        <div className="p-4 text-center text-gray-400">
          No messages in the last 48 hours
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - simplified */}
      <div className="p-4 border-b border-[#262626]">
        <h2 className="font-semibold text-purple-300">Messages</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayMessages.map((message) => (
          <div key={message.id} className="flex gap-2 group">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-purple-300">
                  {message.author.username}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(message.timestamp).toLocaleString()}
                </span>
                <button
                  onClick={() => onReplyTo(message)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-purple-300 text-sm"
                >
                  Reply
                </button>
              </div>
              <MessageContent message={message} />
            </div>
          </div>
        ))}
        
        {/* Add this invisible div at the bottom */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
} 