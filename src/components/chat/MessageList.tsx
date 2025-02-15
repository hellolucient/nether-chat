'use client'

import React, { useRef, useEffect, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import type { Message } from '@/types'
import LoadingSpinner from '@/components/LoadingSpinner'
import { supabase } from '@/lib/supabase'

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

function formatDate(dateString: string) {
  try {
    // Handle Supabase format directly (2025-02-01 04:42:36.56+00)
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString)
      return 'Invalid date'
    }
    return date.toLocaleString()
  } catch (error) {
    console.error('Error formatting date:', dateString, error)
    return 'Invalid date'
  }
}

function MessageContent({ message }: { message: Message }) {
  // If message has attachments (images)
  if (message.attachments?.length) {
    return (
      <div className="mt-1">
        {message.attachments.map((attachment, index) => (
          <div key={`attachment-${index}`} className="max-w-[300px]">
            <img 
              src={attachment.url} 
              alt={attachment.filename || 'Attached image'}
              className="rounded-lg"
            />
          </div>
        ))}
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

  // If the message has a GIF/image embed or sticker
  if (message.embeds?.some(embed => embed.type === 'gif' || embed.type === 'image') || message.stickers?.length) {
    return (
      <div className="mt-1">
        {message.embeds?.map((embed, index) => (
          <div key={`embed-${index}`} className="max-w-[300px]">
            <img 
              src={embed.url || embed.image?.url} 
              alt="GIF" 
              className="rounded-lg"
            />
          </div>
        ))}

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

  // Regular text content
  return (
    <div className="text-gray-100 space-y-1">
      {formatMessageWithQuotes(message.content)}
    </div>
  )
}

interface BotInfo {
  discord_id: string
  bot_name: string
}

interface MessageListProps {
  messages: Message[]
  channelId: string
  onRefresh: () => Promise<void>
  onReplyTo: (message: Message | null) => void
  loading: boolean
}

// Helper function to clean Discord IDs
const cleanDiscordId = (id: string) => id.replace(/[<@>]/g, '')

// Helper function to replace bot IDs with names in message content
const replaceBotMentions = (content: string, botNames: Record<string, string>) => {
  return content.replace(/<@(\d+)>/g, (match, id) => {
    return `@${botNames[id] || id}`
  })
}

// Add CSS classes for different message types
function getMessageClasses(message: Message): string {
  const baseClasses = "p-4 rounded-lg group relative"
  
  // Messages FROM bots get a purple gradient
  if (message.isFromBot) {
    return `${baseClasses} bg-gradient-to-r from-purple-900/50 to-purple-800/30`
  }
  
  // Messages that @mention bots get a blue tint
  if (message.isBotMention) {
    return `${baseClasses} bg-blue-900/30`
  }
  
  // Messages replying to bots get a different purple tint
  if (message.replyingToBot) {
    return `${baseClasses} bg-purple-800/20`
  }
  
  return `${baseClasses} bg-[#1E1E1E]`
}

// At the top of the file, add a helper function for bot mentions
function formatBotMentions(content: string, botNames: Record<string, string>) {
  // First replace all bot IDs with their names
  const contentWithNames = replaceBotMentions(content, botNames)
  
  // Then find and wrap all @mentions in bold spans
  return contentWithNames.split(' ').map((word, i, arr) => {
    if (word.startsWith('@')) {
      // Check if this is the start of a multi-word bot name
      let fullName = word.substring(1) // Remove @ symbol
      let j = i + 1
      // Keep adding words until we find the full bot name
      while (j < arr.length && Object.values(botNames).some(name => 
        name.toLowerCase() === (fullName + ' ' + arr[j]).toLowerCase()
      )) {
        fullName += ' ' + arr[j]
        j++
      }
      
      // If we found a bot name, return it wrapped in a span
      if (Object.values(botNames).some(name => name.toLowerCase() === fullName.toLowerCase())) {
        return <span key={i} className="font-bold text-purple-300">@{fullName}</span>
      }
    }
    return <span key={i}>{word} </span>
  })
}

export function MessageList({ messages, loading, channelId, onRefresh, onReplyTo }: MessageListProps) {
  const messageListRef = useRef<HTMLDivElement>(null)
  const [botNames, setBotNames] = useState<Record<string, string>>({})
  const [referencedAuthors, setReferencedAuthors] = useState<Record<string, string>>({})
  const [botIds, setBotIds] = useState<string[]>([])
  
  // Add debug logging for messages and bot names
  useEffect(() => {
    console.log('🔄 MessageList: Messages updated:', messages.map(m => ({
      id: m.id,
      content: m.content?.substring(0, 50),
      author: m.author_username,
      hasReference: !!m.referenced_message_id,
      referenceId: m.referenced_message_id,
      referenceContent: m.referenced_message_content?.substring(0, 50),
      referenceAuthor: m.referenced_message_author_id
    })))
  }, [messages])

  useEffect(() => {
    console.log('👤 MessageList: Bot names updated:', botNames)
  }, [botNames])

  // Get bot names once when component mounts
  useEffect(() => {
    const fetchBotNames = async () => {
      const { data: bots } = await supabase
        .from('discord_bots')
        .select('discord_id, bot_name')
      
      if (bots) {
        const names = bots.reduce((acc, bot) => ({
          ...acc,
          [bot.discord_id]: bot.bot_name
        }), {})
        setBotNames(names)
        console.log('🤖 Loaded bot names:', names)
      }
    }
    
    fetchBotNames()
  }, [])

  // Add function to fetch author username
  const fetchReferencedAuthor = async (authorId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('author_display_name')
      .eq('sender_id', authorId)
      .limit(1)
      .single()
    
    if (data) {
      setReferencedAuthors(prev => ({
        ...prev,
        [authorId]: data.author_display_name
      }))
    }
  }

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    const messageList = messageListRef.current
    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, channelId])

  useEffect(() => {
    console.log('🔄 MessageList: Received new messages:', messages)
    console.log('🔍 MessageList: First message details:', messages[0])
    console.log('📊 MessageList: Messages with references:', 
      messages.filter(m => m.referenced_message_id)
    )
  }, [messages])

  useEffect(() => {
    console.log('🖥️ Displaying Messages:', {
      count: messages.length,
      oldestMessage: messages[0]?.sent_at,
      newestMessage: messages[messages.length - 1]?.sent_at,
      messageTimestamps: messages.map(m => m.sent_at)
    })
  }, [messages])

  // Add logging when messages are received
  useEffect(() => {
    console.log('MessageList received messages with dates:', {
      sample: messages.slice(0, 2).map(m => ({
        sent_at: m.sent_at,
        parsed: new Date(m.sent_at),
        display: formatDate(m.sent_at)
      }))
    })
  }, [messages])

  // Add effect to fetch author names
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.referenced_message_author_id && 
          !botNames[msg.referenced_message_author_id] && 
          !referencedAuthors[msg.referenced_message_author_id]) {
        fetchReferencedAuthor(msg.referenced_message_author_id)
      }
    })
  }, [messages, botNames])

  useEffect(() => {
    console.log('🟢 REFERENCE CHECK - UI:', messages
      .filter(m => m.referenced_message_id)  // Only show messages with references
      .map(m => ({
        id: m.id,
        refId: m.referenced_message_id,
        refAuthor: m.referenced_message_author_id,
        refContent: m.referenced_message_content
    })))
  }, [messages])

  // Add at top of component
  useEffect(() => {
    console.log('🎯 Messages in MessageList:', messages.map(m => ({
      id: m.id,
      refId: m.referenced_message_id,
      refAuthor: m.referenced_message_author_id,
      refContent: m.referenced_message_content
    })))
  }, [messages])

  // Add this near the top of MessageList component
  useEffect(() => {
    console.log('Message flags:', messages.map(m => ({
      content: m.content,
      isFromBot: botNames[m.sender_id] || false,
      isBotMention: m.content.includes('<@') && m.content.includes('>'),
      replyingToBot: m.referenced_message_author_id && botNames[m.referenced_message_author_id]
    })))
  }, [messages, botNames])

  // Add this effect to check all messages' styling
  useEffect(() => {
    console.log('🎨 Message Styling Debug:', {
      totalMessages: messages.length,
      messagesWithFlags: messages.map(m => ({
        id: m.id,
        content: m.content.substring(0, 50),
        flags: {
          isFromBot: botNames[m.sender_id] || false,
          isBotMention: m.content.includes('<@') && m.content.includes('>'),
          replyingToBot: m.referenced_message_author_id && botNames[m.referenced_message_author_id]
        },
        appliedClass: getMessageClasses(m)
      }))
    })
  }, [messages, botNames])

  // Fetch bot IDs once when component mounts
  useEffect(() => {
    const fetchBotIds = async () => {
      const { data: bots } = await supabase
        .from('discord_bots')
        .select('discord_id')
      
      if (bots) {
        setBotIds(bots.map(bot => bot.discord_id))
      }
    }
    
    fetchBotIds()
  }, [])

  return (
    <div ref={messageListRef} className="message-list h-full overflow-y-auto relative">
      {loading ? (
        <div className="absolute inset-0 flex justify-center items-center bg-black/50">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={getMessageClasses(message)}
            >
              {/* Show referenced message if it exists */}
              {message.referenced_message_id && (
                <div className="mb-2 pl-4 border-l-2 border-[#363640]">
                  <div className="text-gray-400 text-sm">
                    <div className="flex items-center gap-2">
                      <span>
                        <span className="text-purple-300">
                          @{message.referenced_message_author_id && (
                            botNames[message.referenced_message_author_id] || 
                            referencedAuthors[message.referenced_message_author_id] ||
                            "Unknown User"
                          )}
                        </span>
                        {' '}
                        {message.referenced_message_content && 
                          message.referenced_message_content.split(' ').map((word, i) => {
                            if (word.startsWith('<@') && word.endsWith('>')) {
                              const botId = word.slice(2, -1)
                              const botName = botNames[botId]
                              return botName ? (
                                <React.Fragment key={i}>
                                  <span className="font-bold text-purple-300">@{botName}</span>
                                  {' '}
                                </React.Fragment>
                              ) : word + ' '
                            }
                            return word + ' '
                          })
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Author and timestamp */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-purple-300">
                  {message.author_display_name}
                  {botIds.includes(message.sender_id) && (
                    <span className="ml-2 text-xs bg-purple-600 px-2 py-0.5 rounded">APP</span>
                  )}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(message.sent_at)}
                </span>
                <button
                  onClick={() => onReplyTo(message)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-purple-300 text-sm"
                >
                  Reply
                </button>
              </div>

              {/* Current message content */}
              <div className="text-gray-300">
                {replaceBotMentions(message.content, botNames).split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 