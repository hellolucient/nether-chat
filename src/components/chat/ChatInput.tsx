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
import { Message, MessageContent } from '@/types'
import { GifPicker } from './GifPicker'
import { StickerIcon } from './icons/StickerIcon'
import { StickerPicker } from './StickerPicker'
import imageCompression from 'browser-image-compression'

// First, let's properly define our types at the top
type SendStatus = 'idle' | 'sending' | 'sent'

interface ChatInputProps {
  channelId: string
  onSendMessage: (content: string, type?: string, url?: string) => Promise<void>
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

const DEBUG = process.env.NODE_ENV === 'development'
const log = (msg: string, data?: any) => {
  if (DEBUG) {
    console.log(`🔷 ${msg}`, data ? data : '')
  }
}

async function compressImage(file: File) {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true
  }
  
  try {
    return await imageCompression(file, options)
  } catch (error) {
    console.error('Error compressing image:', error)
    throw error
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
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [selectedSticker, setSelectedSticker] = useState<{id: string, url: string} | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

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
    
    // Allow empty content if we have an image
    if (!message.trim() && !selectedImage && !selectedSticker) {
      console.log('❤️ No content to send')
      return
    }

    try {
      if (!publicKey) {
        console.error('💔 No wallet connected')
        return
      }

      setSendStatus('sending')

      if (selectedImage) {
        console.log('💜 Processing image upload')
        setUploading(true)
        const imageUrl = await uploadImage(selectedImage)
        setUploading(false)
        console.log('💜 Image uploaded:', { imageUrl })
        
        // Send image with optional message
        await onSendMessage(message, 'image', imageUrl)
        
        // Clear image after successful send
        setSelectedImage(null)
        setImagePreview(null)
      } else {
        // Normal text message
        await onSendMessage(message)
      }

      // Clear message after successful send
      setMessage('')
      setSendStatus('sent')
    } catch (error) {
      console.error('💔 Submit error:', error)
      setSendStatus('idle')
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      setImagePreview(previewUrl)
    }
  }

  useEffect(() => {
    if (replyTo) {
      inputRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [replyTo])

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

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

  const buttonClassName = `px-4 py-2 rounded font-medium bg-purple-600 hover:bg-purple-700 transition-all duration-200
    ${sendStatus === 'sending' 
      ? 'opacity-50 cursor-not-allowed' 
      : sendStatus === 'sent'
      ? 'text-[#00FF00]'
      : 'text-white'
    }`

  const renderSendButton = () => (
    <button
      type="submit"
      disabled={(!message.trim() && !selectedImage && !selectedSticker)}
      className={buttonClassName}
    >
      {sendStatus === 'sending' ? (
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : sendStatus === 'sent' ? (
        'Sent!'
      ) : (
        'Send'
      )}
    </button>
  )

  const handleStickerSelect = (sticker: { id: string, url: string }) => {
    setSelectedSticker(sticker)
    setShowStickerPicker(false)
    inputRef.current?.focus()
  }

  const handleImageUpload = async (file: File) => {
    log('Starting image upload', { 
      name: file.name, 
      size: file.size, 
      type: file.type 
    })

    try {
      // Compress image
      log('Compressing image...')
      const compressedFile = await compressImage(file)
      log('Image compressed', { 
        originalSize: file.size,
        compressedSize: compressedFile.size 
      })

      // Upload to Supabase
      log('Uploading to Supabase...')
      const imageUrl = await uploadImage(compressedFile)
      log('Upload successful', { imageUrl })

      // Send message
      log('Sending message with image...')
      await onSendMessage('', 'image', imageUrl)
      log('Message sent with image')

    } catch (error) {
      console.error('❌ Image upload failed:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-[#262626] relative">
      {/* Reply Preview */}
      {replyTo && (
        <div className="mb-2 p-2 bg-[#262626] rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Replying to</span>
            <span className="text-purple-300">
              {replyTo?.author_username || 'Unknown User'}
            </span>
            <span className="text-gray-400 text-sm truncate">{replyTo?.content}</span>
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

      {imagePreview && (
        <div className="relative inline-block">
          <img 
            src={imagePreview} 
            alt="Upload preview" 
            className="max-h-32 rounded-md"
          />
          <button
            onClick={() => {
              setSelectedImage(null)
              setImagePreview(null)
            }}
            className="absolute -top-2 -right-2 bg-purple-600 hover:bg-purple-700 rounded-full p-1"
          >
            <XMarkIcon className="h-4 w-4 text-white" />
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
        <button
          type="button"
          onClick={async () => {
            try {
              await onRefreshMessages()
            } catch (error) {
              console.error('Failed to refresh messages:', error)
            }
          }}
          className="p-2 text-gray-400 hover:text-purple-300 rounded-lg hover:bg-[#262626]"
          title="Refresh messages"
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>
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
