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
      <img 
        src={gifUrl} 
        alt="GIF" 
        className="max-w-[300px] rounded-lg"
      />
    )
  }

  // Handle custom emojis and regular text
  return <p className="text-gray-100">{formatDiscordMessage(content)}</p>
}

function MessageContent({ message }: { message: Message }) {
  const { content, attachments, embeds, stickers } = message

  return (
    <div className="mt-1">
      {/* Regular text content */}
      {content && <div className="mb-2">{formatMessageContent(content)}</div>}

      {/* Attachments (direct uploads) */}
      {attachments?.map((attachment, index) => {
        if (attachment.content_type?.startsWith('image/')) {
          return (
            <img 
              key={`attachment-${index}`}
              src={attachment.url}
              alt="Attachment"
              className="max-w-[300px] rounded-lg mb-2"
              loading="lazy"
            />
          )
        }
        return null
      })}

      {/* Stickers */}
      {stickers?.map((sticker, index) => (
        <img
          key={`sticker-${index}`}
          src={sticker.url}
          alt={sticker.name}
          className="max-w-[200px] rounded-lg mb-2"
          loading="lazy"
        />
      ))}

      {/* Embeds (links, GIFs) */}
      {embeds?.map((embed, index) => {
        const imageUrl = embed.image?.url || embed.thumbnail?.url || embed.url
        if (imageUrl && (
          imageUrl.endsWith('.gif') || 
          imageUrl.includes('tenor.com') || 
          imageUrl.includes('giphy.com') ||
          embed.type === 'image'
        )) {
          return (
            <img 
              key={`embed-${index}`}
              src={imageUrl}
              alt="Embedded content"
              className="max-w-[300px] rounded-lg mb-2"
              loading="lazy"
            />
          )
        }
        return null
      })}
    </div>
  )
}

interface MessageListProps {
  messages: Message[]
  loading: boolean
  channelId: string
  onRefresh: () => Promise<void>
}

export function MessageList({ messages, loading, channelId, onRefresh }: MessageListProps) {
  const [refreshing, setRefreshing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView()
  }

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, channelId])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await onRefresh()
    } catch (error) {
      console.error('Failed to refresh messages:', error)
    } finally {
      setRefreshing(false)
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
    return <div className="p-4 text-center">Loading messages...</div>
  }

  if (!messages?.length) {
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
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="p-4 border-b border-[#262626] flex justify-between items-center">
        <h2 className="font-semibold text-purple-300">Messages</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`p-2 rounded-full hover:bg-[#262626] ${refreshing ? 'animate-spin' : ''}`}
        >
          <ArrowPathIcon className="h-5 w-5 text-purple-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[calc(100vh-73px-80px)]">
        {loading ? (
          <div className="text-center text-gray-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-4">
            No messages in the last 48 hours
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-2">
                {/* Message content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-purple-300">
                      {message.author.username}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(message.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <MessageContent message={message} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
} 