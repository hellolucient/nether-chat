'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface BotAssignmentFormProps {
  onSuccess: () => void
}

type Channel = {
  id: string
  name: string
}

export function BotAssignmentForm({ onSuccess }: BotAssignmentFormProps) {
  const [name, setName] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [botToken, setBotToken] = useState('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch available channels
  useEffect(() => {
    async function fetchChannels() {
      try {
        const response = await fetch('/api/channels')
        const data = await response.json()
        setChannels(data.channels || [])
      } catch (err) {
        setError('Failed to fetch channels')
      } finally {
        setLoading(false)
      }
    }

    fetchChannels()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Create bot assignment
      const { data: botData, error: botError } = await supabase
        .from('bot_assignments')
        .insert([
          {
            name,
            wallet_address: walletAddress,
            bot_token: botToken,
            bot_id: botToken.split(':')[0]
          }
        ])
        .select()
        .single()

      if (botError) {
        setError(botError.message)
        return
      }

      // Create channel access entries
      if (selectedChannels.length > 0) {
        const { error: channelError } = await supabase
          .from('channel_mappings')
          .insert(
            selectedChannels.map(channelId => ({
              bot_assignment_id: botData.id,
              channel_id: channelId
            }))
          )

        if (channelError) {
          setError(channelError.message)
          return
        }
      }

      // Clear form
      setName('')
      setWalletAddress('')
      setBotToken('')
      setSelectedChannels([])
      
      setSuccessMessage(`Successfully created user profile for ${name}`)
      
      // Add a small delay before refreshing the list
      setTimeout(() => {
        onSuccess()
      }, 500)

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bot assignment')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Loading channels...</div>

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">
            User Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-[#262626] border border-[#363636] rounded-md text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">
            Wallet Address
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-[#262626] border border-[#363636] rounded-md text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">
            Bot Token
          </label>
          <input
            type="text"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-[#262626] border border-[#363636] rounded-md text-white"
            required
          />
        </div>
      </div>

      {/* Channel Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Channel Access
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map(channel => (
            <label 
              key={channel.id}
              className="p-4 bg-[#262626] rounded-lg flex items-center space-x-3 cursor-pointer hover:bg-[#2d2d2d]"
            >
              <input
                type="checkbox"
                checked={selectedChannels.includes(channel.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedChannels([...selectedChannels, channel.id])
                  } else {
                    setSelectedChannels(selectedChannels.filter(id => id !== channel.id))
                  }
                }}
                className="rounded border-gray-600 bg-[#363636] text-purple-600"
              />
              <div>
                <p className="text-purple-300">#{channel.name}</p>
                <p className="text-xs text-gray-400">ID: {channel.id}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}

      {successMessage && (
        <div className="text-green-400 text-sm">{successMessage}</div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
      >
        {saving ? 'Creating...' : 'Create Bot Assignment'}
      </button>
    </form>
  )
} 