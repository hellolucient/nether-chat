'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export function MessageInput({ onSendMessage, onRefresh }: MessageInputProps) {
  const [content, setContent] = useState('')
  const { publicKey } = useWallet()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !publicKey) return

    try {
      await onSendMessage(content)
      await onRefresh()  // Refresh messages after sending
      setContent('')  // Clear input after successful send
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="...">
      {/* Your existing form JSX */}
    </form>
  )
} 