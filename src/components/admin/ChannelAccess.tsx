'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Channel = {
  id: string
  name: string
}

export function ChannelAccess({ botAssignmentId }: { botAssignmentId: string }) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch channels and current access
  useEffect(() => {
    async function fetchData() {
      // Fetch Discord channels
      const response = await fetch('/api/channels')
      const { channels: discordChannels } = await response.json()
      setChannels(discordChannels)

      // Fetch current access
      const { data } = await supabase
        .from('channel_access')
        .select('channel_id')
        .eq('bot_assignment_id', botAssignmentId)

      setSelectedChannels(data?.map(row => row.channel_id) || [])
      setLoading(false)
    }

    fetchData()
  }, [botAssignmentId])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Delete existing access
      await supabase
        .from('channel_access')
        .delete()
        .eq('bot_assignment_id', botAssignmentId)

      // Insert new access
      await supabase
        .from('channel_access')
        .insert(
          selectedChannels.map(channelId => ({
            bot_assignment_id: botAssignmentId,
            channel_id: channelId
          }))
        )
    } catch (error) {
      console.error('Failed to save channel access:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Loading channels...</div>

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {channels.map(channel => (
          <label key={channel.id} className="flex items-center space-x-2">
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
              className="rounded border-gray-600 bg-[#262626] text-purple-600"
            />
            <span className="text-gray-300">#{channel.name}</span>
          </label>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Channel Access'}
      </button>
    </div>
  )
} 