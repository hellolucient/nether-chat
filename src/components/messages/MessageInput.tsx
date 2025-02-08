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
      console.log('Sending message...')
      await onSendMessage(content)
      console.log('Message sent, clearing input...')
      setContent('')  // Clear input immediately
      
      // Add a small delay before refreshing to allow Discord to process
      console.log('Waiting for Discord...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log('Refreshing messages...')
      await onRefresh()  // Refresh after delay
      console.log('Refresh complete')
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