'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TrashIcon } from '@heroicons/react/24/outline'

// Define types for raw data from API/DB
interface RawAssignment {
  id: string
  name: string
  wallet_address: string
  mappings: {
    channel_id: string
  }[]
}

// Define channel type
interface Channel {
  id: string
  name: string
}

// Define final assignment type
type BotAssignment = {
  id: string
  name: string
  wallet_address: string
  channels: {
    channel_id: string
    name: string
  }[]
}

interface BotAssignmentListProps {
  onUpdate: () => void
}

export function BotAssignmentList({ onUpdate }: BotAssignmentListProps) {
  const [assignments, setAssignments] = useState<BotAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchAssignments()
  }, [])

  const fetchAssignments = async () => {
    try {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('bot_assignments')
        .select(`
          id,
          name,
          wallet_address,
          mappings:channel_mappings!channel_mappings_bot_assignment_id_fkey (
            channel_id
          )
        `)
        .order('created_at', { ascending: false })

      if (assignmentsError) {
        setError(assignmentsError.message)
        return
      }

      const response = await fetch('/api/channels')
      const { channels, error: channelsError } = await response.json()
      
      if (channelsError) {
        setError('Failed to fetch channel names')
        return
      }

      const channelMap = new Map(channels.map((c: Channel) => [c.id, c.name]))

      // Fixed typing and null checking
      const assignmentsWithChannels = (assignmentsData || []).map((assignment): BotAssignment => ({
        id: assignment.id,
        name: assignment.name,
        wallet_address: assignment.wallet_address,
        channels: assignment.mappings.map(c => ({
          channel_id: c.channel_id,
          name: String(channelMap.get(c.channel_id) || 'Unknown Channel') // Force string type
        }))
      }))

      setAssignments(assignmentsWithChannels)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assignments')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user profile?')) return

    setDeleting(id)
    try {
      // Delete channel access first (foreign key constraint)
      const { error: channelError } = await supabase
        .from('channel_mappings')
        .delete()
        .eq('bot_assignment_id', id)

      if (channelError) {
        setError(channelError.message)
        return
      }

      // Then delete the bot assignment
      const { error: botError } = await supabase
        .from('bot_assignments')
        .delete()
        .eq('id', id)

      if (botError) {
        setError(botError.message)
        return
      }

      // Refresh the list
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user profile')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <div>Loading assignments...</div>
  if (error) return <div className="text-red-400">{error}</div>

  return (
    <div className="space-y-4">
      {assignments.map(assignment => (
        <div 
          key={assignment.id}
          className="p-4 bg-[#262626] rounded-lg"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-lg font-medium text-purple-300">{assignment.name}</p>
              <p className="text-sm text-gray-400 mt-1">Wallet</p>
              <p className="font-mono text-sm">{assignment.wallet_address}</p>
              <div className="mt-3">
                <p className="text-sm text-gray-400">Channel Access</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {assignment.channels.map(channel => (
                    <span 
                      key={channel.channel_id}
                      className="px-2 py-1 bg-[#363636] rounded text-sm text-purple-300"
                    >
                      #{channel.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDelete(assignment.id)}
              disabled={deleting === assignment.id}
              className="p-2 text-gray-400 hover:text-red-400 disabled:opacity-50"
              title="Delete user profile"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
} 