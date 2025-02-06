'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

export function BotRegistration() {
  const { publicKey } = useWallet()
  const [botToken, setBotToken] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicKey || !botToken.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          walletAddress: publicKey.toString()
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(`Bot "${data.botName}" registered successfully!`)
        setBotToken('')
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      alert('Failed to register bot: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300">
          Discord Bot Token
        </label>
        <input
          type="password"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-[#1E1E24] border border-[#262626] rounded-md text-gray-100"
          placeholder="Enter your bot token"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !botToken.trim()}
        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? 'Registering...' : 'Register Bot'}
      </button>
    </form>
  )
} 