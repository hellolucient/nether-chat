'use client'

import { useState, useRef, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { MentionAutocomplete } from './MentionAutocomplete'
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react'
import { 
  FaceSmileIcon, 
  XMarkIcon, 
  GifIcon, 
  ArrowPathIcon, 
  PhotoIcon,
} from '@heroicons/react/24/outline'
import { uploadImage } from '@/lib/storage'
import type { Message } from '@/types'
import { GifPicker } from './GifPicker'
import { StickerIcon } from './icons/StickerIcon'
import { StickerPicker } from './StickerPicker'

// Update MessageContent interface to include content
interface MessageContent {
  type: string
  url: string
  content?: string
  stickerId?: string
  reply?: {
    messageReference: { messageId: string }
    quotedContent: string
  }
}

interface ChatInputProps {
  channelId: string
  onSendMessage: (content: string | MessageContent) => Promise<void>
  replyTo: Message | null
  onCancelReply: () => void
  onRefreshMessages: () => Promise<void>
}

interface TenorGifResult {
  id: string
  media_formats: {
    gif: { url: string }
    tinygif: { url: string }
  }
}

export function ChatInput({ channelId, onSendMessage, replyTo, onCancelReply, onRefreshMessages }: ChatInputProps) {
  const { publicKey } = useWallet()
  const [message, setMessage] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [mention, setMention] = useState<{ query: string; position: { top: number; left: number } } | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifs, setGifs] = useState<Array<{ id: string; url: string; preview: string }>>([])
  const [searchGif, setSearchGif] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [selectedSticker, setSelectedSticker] = useState<{id: string, url: string} | null>(null)

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessage(value)

    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const query = value.slice(lastAtIndex + 1).split(' ')[0]
      if (query) {
        const input = inputRef.current
        if (input) {
          const pos = input.getBoundingClientRect()
          setMention({
            query,
            position: {
              top: pos.top - 200,
              left: pos.left
            }
          })
        }
      }
    } else {
      setMention(null)
    }
  }

  const handleSelectMention = (user: { displayName: string }) => {
    const lastAtIndex = message.lastIndexOf('@')
    const newMessage = 
      message.slice(0, lastAtIndex) + 
      `@${user.displayName} ` + 
      message.slice(lastAtIndex + mention!.query.length + 1)
    
    setMessage(newMessage)
    setMention(null)
    inputRef.current?.focus()
  }

  const onEmojiClick = (emojiData: EmojiClickData) => {
    const cursor = inputRef.current?.selectionStart || message.length
    const newMessage = 
      message.slice(0, cursor) + 
      emojiData.emoji + 
      message.slice(cursor)
    
    setMessage(newMessage)
    setShowEmojiPicker(false)
    inputRef.current?.focus()
  }

  const searchGifs = async (query: string) => {
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${query}&key=${process.env.NEXT_PUBLIC_TENOR_API_KEY}&limit=20`
      )
      const data = await response.json()
      setGifs(data.results.map((gif: TenorGifResult) => ({
        id: gif.id,
        url: gif.media_formats.gif.url,
        preview: gif.media_formats.tinygif.url,
      })))
    } catch (error) {
      console.error('Error fetching GIFs:', error)
    }
  }

  const handleGifSelect = (gifUrl: string) => {
    setMessage(gifUrl)
    setShowGifPicker(false)
    inputRef.current?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() && !selectedImage && !selectedSticker) return
    
    setSendStatus('sending')
    try {
      // Prepare message content based on type
      let messageContent: MessageContent = {
        type: 'text',
        content: message,
        url: ''
      }

      // Handle different message types
      if (selectedSticker) {
        messageContent = {
          type: 'sticker',
          content: '',
          url: selectedSticker.url,
          stickerId: selectedSticker.id
        }
      } else if (isGifUrl(message)) {
        messageContent = {
          type: 'gif',
          content: '',
          url: message.trim()
        }
      }

      // Add reply if exists
      if (replyTo) {
        messageContent.reply = {
          messageReference: { messageId: replyTo.id },
          quotedContent: `> ${replyTo.author.username}: ${replyTo.content}\n`
        }
      }

      const response = await fetch(`/api/messages/${channelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': publicKey?.toString() || ''
        },
        body: JSON.stringify(messageContent)
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Failed to send message:', error)
        throw new Error(error.error || 'Failed to send message')
      }

      console.log('✅ Message sent successfully')
      setSendStatus('sent')
      setMessage('')
      setSelectedImage(null)
      setSelectedSticker(null)

      // Clear reply if there was one
      if (replyTo && onCancelReply) {
        onCancelReply()
      }

      // Add delay and refresh
      console.log('Waiting for Discord to process...')
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      console.log('Refreshing messages...')
      await onRefreshMessages()
      console.log('Messages refreshed')

      // Wait before resetting send status
      setTimeout(() => setSendStatus('idle'), 2000)
    } catch (error) {
      console.error('❌ Error sending message:', error)
      setSendStatus('idle')
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 8 * 1024 * 1024) { // 8MB limit
        alert('Image must be less than 8MB')
        return
      }
      setSelectedImage(file)
    }
  }

  useEffect(() => {
    if (replyTo) {
      inputRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [replyTo])

  function isGifUrl(content: string): boolean {
    const trimmed = content.trim().toLowerCase()
    const isGif = trimmed.startsWith('http') && (
      trimmed.endsWith('.gif') ||
      trimmed.includes('tenor.com') ||
      trimmed.includes('giphy.com')
    )
    console.log('🔍 Checking if content is GIF:', { content: trimmed, isGif })
    return isGif
  }

  // Helper function to render the send button based on status
  const renderSendButton = () => {
    console.log('🎨 Rendering send button. Current status:', sendStatus)
    
    switch (sendStatus) {
      case 'sending':
        console.log('📤 Rendering sending state')
        return (
          <button
            type="submit"
            disabled
            className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center justify-center w-20"
          >
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          </button>
        )
      case 'sent':
        console.log('✨ Rendering sent state')
        return (
          <button
            type="submit"
            disabled
            className="px-4 py-2 bg-pink-400 text-white rounded-lg w-20 transition-colors duration-200 hover:bg-pink-400"
          >
            Sent!
          </button>
        )
      default:
        console.log('⚪️ Rendering idle state')
        return (
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed w-20"
            disabled={(!message.trim() && !selectedImage && !selectedSticker) || sendStatus !== 'idle'}
          >
            Send
          </button>
        )
    }
  }

  // Add handler for sticker selection
  const handleStickerSelect = (sticker: { id: string, url: string }) => {
    setSelectedSticker(sticker)
    setShowStickerPicker(false)
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-[#262626] relative">
      {/* Reply Preview */}
      {replyTo && (
        <div className="mb-2 p-2 bg-[#262626] rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Replying to</span>
            <span className="text-purple-300">{replyTo.author.username}</span>
            <span className="text-gray-400 text-sm truncate">{replyTo.content}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-gray-400 hover:text-purple-300"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* GIF Preview */}
      {isGifUrl(message) && (
        <div className="mb-2 p-2 rounded bg-[#262626]">
          <div className="relative">
            <img 
              src={message} 
              alt="GIF Preview" 
              className="max-w-[300px] rounded-lg"
            />
            <button
              type="button"
              onClick={() => setMessage('')}
              className="absolute top-2 right-2 p-1 bg-[#363636] rounded-full hover:bg-[#464646] text-gray-400 hover:text-purple-300"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
          <span>{selectedImage.name}</span>
          <button 
            type="button"
            onClick={() => setSelectedImage(null)}
            className="hover:text-gray-300"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add sticker preview */}
      {selectedSticker && (
        <div className="mb-2 p-2 rounded bg-[#262626]">
          <div className="relative">
            <img 
              src={selectedSticker.url} 
              alt="Sticker Preview" 
              className="max-w-[200px] rounded-lg"
            />
            <button
              type="button"
              onClick={() => setSelectedSticker(null)}
              className="absolute top-2 right-2 p-1 bg-[#363636] rounded-full hover:bg-[#464646] text-gray-400 hover:text-purple-300"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1 flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleInput}
            placeholder="Type a message..."
            className="w-full px-4 py-2 rounded-lg border border-[#262626] bg-[#1E1E24] text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
            disabled={uploading}
          />
          <div className="absolute right-2 flex gap-2">
            <button
              type="button"
              onClick={() => setShowStickerPicker(!showStickerPicker)}
              className="p-2 text-gray-400 hover:text-purple-300"
            >
              <StickerIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowGifPicker(!showGifPicker)}
              className="p-2 text-gray-400 hover:text-purple-300"
            >
              <GifIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-gray-400 hover:text-purple-300"
            >
              <FaceSmileIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Add StickerPicker */}
          {showStickerPicker && (
            <StickerPicker
              onSelect={handleStickerSelect}
              onClose={() => setShowStickerPicker(false)}
            />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 hover:bg-[#262626] rounded"
          disabled={uploading}
        >
          <PhotoIcon className="w-5 h-5" />
        </button>
        {renderSendButton()}
        {onRefreshMessages && (
          <button
            type="button"
            onClick={onRefreshMessages}
            className="p-2 text-gray-400 hover:text-purple-300 rounded-lg hover:bg-[#262626]"
            title="Refresh messages"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* GIF Picker */}
      {showGifPicker && (
        <div className="absolute bottom-full right-0 mb-2 p-2 bg-[#1E1E24] rounded-lg border border-[#262626] w-96">
          <input
            type="text"
            value={searchGif}
            onChange={(e) => {
              setSearchGif(e.target.value)
              searchGifs(e.target.value)
            }}
            placeholder="Search GIFs..."
            className="w-full px-3 py-2 mb-2 rounded bg-[#262626] text-gray-100 border-none focus:ring-1 focus:ring-purple-500"
          />
          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => handleGifSelect(gif.url)}
                className="relative aspect-video hover:opacity-80 transition-opacity"
              >
                <img
                  src={gif.preview}
                  alt="GIF"
                  className="w-full h-full object-cover rounded"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-full right-0 mb-2">
          <EmojiPicker onEmojiClick={onEmojiClick} />
        </div>
      )}

      {/* Mention Autocomplete */}
      {mention && (
        <MentionAutocomplete
          query={mention.query}
          position={mention.position}
          onSelect={handleSelectMention}
          onClose={() => setMention(null)}
        />
      )}
    </form>
  )
}
