'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export function MessageInput({ onSendMessage, onRefresh }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setSending] = useState(false)
  const { publicKey } = useWallet()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !publicKey) return

    try {
      setSending(true)
      await onSendMessage(content)
      setContent('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 bg-[#262626] rounded px-3 py-2 text-white"
          placeholder="Type a message..."
        />
        <button
          type="submit"
          disabled={!content.trim() || !publicKey || isSending}
          className={`px-4 py-2 rounded font-medium transition-all duration-200
            ${isSending 
              ? 'bg-purple-600 text-white hover:bg-purple-700' // Sent state
              : 'bg-purple-500 text-white hover:bg-purple-600'  // Normal state
            } 
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSending ? 'Sent!' : 'Send'}
        </button>
      </div>
    </form>
  )
} 