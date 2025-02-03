'use client'

import { useState } from 'react'

export function AdminPanel() {
  const [isOpen, setIsOpen] = useState(false)

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/discord/disconnect', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }

      alert('Discord client disconnected')
    } catch (error) {
      console.error('Failed to disconnect:', error)
      alert('Failed to disconnect')
    }
  }

  return (
    <div className="w-64 border-l border-[#262626] p-4">
      <h2 className="font-semibold text-purple-300 mb-4">Admin Panel</h2>
      <button
        onClick={handleDisconnect}
        className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Disconnect Bot
      </button>
    </div>
  )
} 