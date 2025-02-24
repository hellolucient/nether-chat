'use client'

import React, { useRef, useEffect, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import type { Message } from '@/types'
import LoadingSpinner from '@/components/LoadingSpinner'
import { supabase } from '@/lib/supabase'

function formatDiscordMessage(content: string, botNames: Record<string, string>): JSX.Element[] {
  // Split content into segments, preserving spaces
  return content.split(/(<@\d+>)/).map((segment, index) => {
    // Check if this segment is a bot mention
    const mentionMatch = segment.match(/<@(\d+)>/)
    if (mentionMatch) {
      const botId = mentionMatch[1]
      const botName = botNames[botId]
      return (
        <span key={index} className="font-bold text-purple-300">
          @{botName || botId}
        </span>
      )
    }
    // Return regular text segment
    return <span key={index}>{segment}</span>
  })
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
  return <p className="text-gray-100">{formatDiscordMessage(content, {})}</p>
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

function MessageContent({ 
  message, 
  onReplyTo, 
  botNames 
}: { 
  message: Message; 
  onReplyTo: (message: Message) => void;
  botNames: Record<string, string>;
}) {
  // Handle attachments first
  if (message.attachments && message.attachments.length > 0) {
    const images = message.attachments.filter(a => 
      a.content_type?.startsWith('image/') || a.url.match(/\.(jpg|jpeg|png|gif)$/i)
    )
    
    return (
      <div className="space-y-2">
        {message.content && (
          <div className="text-white whitespace-pre-wrap">
            {formatDiscordMessage(message.content, botNames)}
          </div>
        )}
        
        {images.map((image, index) => (
          <div key={index} className="max-w-[300px]">
            <img 
              src={image.url} 
              alt={image.filename || 'Uploaded image'}
              className="rounded-lg w-full"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    )
  }
  
  // Then check for GIFs (from Tenor)
  if (message.content?.startsWith('__GIF__')) {
    const gifUrl = message.content.replace('__GIF__', '')
    return (
      <div className="max-w-[300px]">
        <img 
          src={gifUrl} 
          alt="GIF" 
          className="rounded-lg w-full"
          loading="lazy"
        />
      </div>
    )
  }

  // Check for image URLs in content (from our uploads)
  if (message.content && message.content.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return (
      <div className="max-w-[300px]">
        <img 
          src={message.content} 
          alt="Uploaded image" 
          className="rounded-lg w-full"
          loading="lazy"
        />
      </div>
    )
  }

  // Finally, handle regular text messages
  return (
    <div className="space-y-2">
      <div className="text-white whitespace-pre-wrap">
        {formatDiscordMessage(message.content, botNames)}
      </div>
    </div>
  )
}

interface MessageListProps {
  messages: Message[]
  channelId: string
  onRefresh: () => Promise<void>
  onReplyTo: (message: Message | null) => void
  loading: boolean
}

// Add CSS classes for different message types
function getMessageClasses(message: Message, botNames: Record<string, string>) {
  const isFromBot = botNames[message.sender_id] !== undefined
  return `relative group flex flex-col p-2 rounded ${
    isFromBot ? 'hover:bg-[#1E1E24]' : 'hover:bg-[#1E1E24]'
  }`
}

export function MessageList({ messages, loading, channelId, onRefresh, onReplyTo }: MessageListProps) {
  console.log('❤️ MessageList render:', { 
    messageCount: messages.length,
    channelId,
    loading 
  })

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
      isFromBot: botNames[m.sender_id] !== undefined,
      hasBotMention: m.content?.includes('<@') && m.content?.includes('>'),
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
          isFromBot: botNames[m.sender_id] !== undefined,
          hasBotMention: m.content?.includes('<@') && m.content?.includes('>'),
          replyingToBot: m.referenced_message_author_id && botNames[m.referenced_message_author_id]
        },
        appliedClass: getMessageClasses(m, botNames)
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

  // Update this effect
  useEffect(() => {
    // Get last 3 messages
    const recentMessages = messages.slice(-3)
    
    console.log('🍉 MessageList Bot Check:', {
      botNames,
      recentMessages: recentMessages.map(m => ({
        id: m.id,
        content: m.content.substring(0, 50),
        author: m.author_username,
        flags: {
          isFromBot: botNames[m.sender_id] !== undefined,  // Changed from m.isFromBot
          hasBotMention: m.content?.includes('<@') && m.content?.includes('>'),  // Changed from m.isBotMention
          replyingToBot: m.referenced_message_author_id && botNames[m.referenced_message_author_id]  // Changed from m.replyingToBot
        },
        sender_id: m.sender_id,
        referenced_message_author_id: m.referenced_message_author_id
      }))
    })
  }, [messages, botNames])

  useEffect(() => {
    console.log('💙 Messages updated:', {
      count: messages.length,
      firstMessage: messages[0]?.content.substring(0, 50),
      lastMessage: messages[messages.length - 1]?.content.substring(0, 50)
    })
  }, [messages])

  // Add to fetchMessages
  const fetchMessages = async () => {
    try {
      console.log('💚 Fetching messages for channel:', channelId)
      // ... existing fetch code ...
      console.log('💜 Fetch complete:', { 
        messageCount: messages.length 
      })
    } catch (error) {
      console.error('💔 Error fetching messages:', error)
    }
  }

  return (
    <div ref={messageListRef} className="message-list h-full overflow-y-auto relative">
      {loading ? (
        <div className="absolute inset-0 flex justify-center items-center bg-black/50">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {messages.map((message) => (
            <div key={message.id} className={getMessageClasses(message, botNames)}>
              {message.referenced_message_content && (
                <div className="ml-2 pl-2 mb-1 border-l-2 border-gray-600 text-gray-400 text-sm">
                  <span className="text-gray-300">
                    Replying to{' '}
                    <span className="font-bold">
                      {botNames[message.referenced_message_author_id || ''] || 
                        messages.find(m => m.sender_id === message.referenced_message_author_id)?.author_display_name || 
                        message.referenced_message_author_id}
                    </span>
                  </span>
                  {' '}{formatDiscordMessage(message.referenced_message_content, botNames)}
                </div>
              )}
              
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-purple-300">
                  {message.author_display_name || message.author_username}
                </span>
                {botNames[message.sender_id] && (
                  <span className="ml-2 text-xs bg-[#5865F2] text-white px-1 rounded">
                    APP
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {new Date(message.sent_at).toLocaleTimeString()}
                </span>
                
                <button
                  onClick={() => onReplyTo(message)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-purple-300 rounded transition-opacity"
                  title="Reply"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <MessageContent 
                message={message} 
                onReplyTo={onReplyTo} 
                botNames={botNames}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 