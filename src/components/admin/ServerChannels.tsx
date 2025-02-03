'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Channel = {
  id: string
  name: string
}

type BotAssignment = {
  id: string
  name: string
  wallet_address: string
}

interface ServerChannelsProps {
  onUpdate: () => void
}

export function ServerChannels({ onUpdate }: ServerChannelsProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [botAssignments, setBotAssignments] = useState<BotAssignment[]>([])
  const [selectedBot, setSelectedBot] = useState<string>('')
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch channels
        const channelsResponse = await fetch('/api/channels')
        const channelsData = await channelsResponse.json()
        setChannels(channelsData.channels || [])

        // Fetch bot assignments
        const { data: botsData } = await supabase
          .from('bot_assignments')
          .select('id, name, wallet_address')
        setBotAssignments(botsData || [])

      } catch (err) {
        setError('Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Fetch selected channels when bot changes
  useEffect(() => {
    async function fetchSelectedChannels() {
      if (!selectedBot) {
        setSelectedChannels([])
        return
      }
      
      const { data } = await supabase
        .from('channel_mappings')
        .select('channel_id')
        .eq('bot_assignment_id', selectedBot)

      setSelectedChannels(data?.map(row => row.channel_id) || [])
    }

    fetchSelectedChannels()
  }, [selectedBot])

  const handleSave = async () => {
    if (!selectedBot) return
    setSaving(true)
    setError(null)

    try {
      // Delete existing mappings
      const { error: deleteError } = await supabase
        .from('channel_mappings')
        .delete()
        .eq('bot_assignment_id', selectedBot)

      if (deleteError) {
        setError(deleteError.message)
        return
      }

      // Insert new mappings
      if (selectedChannels.length > 0) {
        const { error: insertError } = await supabase
          .from('channel_mappings')
          .insert(
            selectedChannels.map(channelId => ({
              bot_assignment_id: selectedBot,
              channel_id: channelId
            }))
          )

        if (insertError) {
          setError(insertError.message)
          return
        }
      }

      // Show success message
      setSuccessMessage('Channel access updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)

      // Refresh the assignments list
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update channel access')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAll = () => {
    if (selectedChannels.length === channels.length) {
      // If all are selected, deselect all
      setSelectedChannels([])
    } else {
      // Otherwise, select all
      setSelectedChannels(channels.map(c => c.id))
    }
  }

  if (loading) return <div>Loading channels...</div>
  if (error) return <div className="text-red-400">{error}</div>

  return (
    <div className="space-y-6">
      {/* Bot Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select User
        </label>
        <select
          value={selectedBot}
          onChange={(e) => setSelectedBot(e.target.value)}
          className="w-full px-3 py-2 bg-[#262626] border border-[#363636] rounded-md text-white"
        >
          <option value="">Select a user...</option>
          {botAssignments.map(bot => (
            <option key={bot.id} value={bot.id}>
              {bot.name} ({bot.wallet_address})
            </option>
          ))}
        </select>
      </div>

      {/* Channel Grid */}
      {selectedBot && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-400">Select channels to grant access</p>
            <button
              onClick={handleToggleAll}
              className="text-sm text-purple-300 hover:text-purple-400"
            >
              {selectedChannels.length === channels.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
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

          {error && (
            <div className="text-red-400 text-sm mt-4">{error}</div>
          )}

          {successMessage && (
            <div className="text-green-400 text-sm mt-4">{successMessage}</div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Channel Access'}
          </button>
        </>
      )}
    </div>
  )
} 