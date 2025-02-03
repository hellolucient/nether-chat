'use client'

import { useState, useRef, useEffect } from 'react'
import { MentionAutocomplete } from './MentionAutocomplete'
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react'
import { 
  FaceSmileIcon, 
  XMarkIcon, 
  GifIcon, 
  ArrowPathIcon, 
  PhotoIcon 
} from '@heroicons/react/24/outline'
import { uploadImage } from '@/lib/storage'

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

  const handleGifSelect = async (gifUrl: string) => {
    try {
      setUploading(true)
      
      // Debug the request payload
      const payload = {
        channelId,
        content: {
          type: 'gif',
          url: gifUrl,
          reply: replyTo ? {
            messageReference: {
              messageId: replyTo.id
            },
            quotedContent: `> ${replyTo.author.username}: ${replyTo.content}\n`
          } : undefined
        }
      }
      console.log('GIF request payload:', payload)

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('GIF send error response:', errorText)
        throw new Error('Failed to send GIF')
      }

      // Clear reply after successful send
      if (replyTo && onCancelReply) {
        onCancelReply()
      }
    } catch (error) {
      console.error('Failed to send GIF:', error)
    } finally {
      setUploading(false)
      setShowGifPicker(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() && !selectedImage) return

    try {
      setUploading(true)

      let imageUrl = ''
      if (selectedImage) {
        try {
          setUploading(true)
          imageUrl = await uploadImage(selectedImage)
          console.log('✅ ChatInput: Image uploaded:', imageUrl)
        } catch (error) {
          console.error('❌ ChatInput: Image upload failed:', error)
          alert('Failed to upload image. Please try again.')
          return
        }
      }

      if (replyTo) {
        await onSendMessage({
          content: message,
          type: imageUrl ? 'image' : 'text',
          url: imageUrl,
          reply: {
            messageReference: { messageId: replyTo.id },
            quotedContent: `> ${replyTo.author.username}: ${replyTo.content}\n`
          }
        })
      } else {
        await onSendMessage(imageUrl ? {
          type: 'image',
          content: message,
          url: imageUrl
        } : message)
      }

      setMessage('')
      setSelectedImage(null)
      await onRefreshMessages()
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setUploading(false)
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
    const trimmed = content.trim()
    return (
      trimmed.startsWith('http') && 
      (
        trimmed.endsWith('.gif') ||
        trimmed.includes('tenor.com') ||
        trimmed.includes('giphy.com')
      )
    )
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-[#262626] relative">
      {/* Reply Preview */}
      {replyTo && (
        <div className="mb-2 p-2 rounded bg-[#262626] flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-400">
              Replying to <span className="text-purple-300">{replyTo.author.username}</span>
            </p>
            <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 hover:bg-[#363636] rounded text-gray-400 hover:text-purple-300"
          >
            <XMarkIcon className="h-4 w-4" />
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
        <button
          type="submit"
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={(!message.trim() && !selectedImage) || uploading}
        >
          Send
        </button>
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
