/* eslint-disable */
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ChannelAccess } from './ChannelAccess'
import { BotAssignment } from './BotAssignment'

interface UserProfile {
  wallet_address: string
  channel_access: string[]
  is_admin: boolean
}

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'channels' | 'bots'>('channels')
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null)

  // Add state for bot assignments if needed
  const [botAssignments, setBotAssignments] = useState<Array<{
    id: string
    wallet_address: string
  }>>([])

  // Fetch bot assignments when component mounts
  useEffect(() => {
    const fetchBotAssignments = async () => {
      const { data } = await supabase
        .from('bot_assignments')
        .select('id, wallet_address')

      if (data) {
        setBotAssignments(data)
      }
    }

    fetchBotAssignments()
  }, [])

  return (
    <div className="p-6">
      <div className="flex gap-4 border-b border-[#262626] mb-6">
        <button
          onClick={() => setActiveTab('channels')}
          className={`px-4 py-2 ${
            activeTab === 'channels' ? 'text-purple-300 border-b-2 border-purple-300' : 'text-gray-400'
          }`}
        >
          Channel Access
        </button>
        <button
          onClick={() => setActiveTab('bots')}
          className={`px-4 py-2 ${
            activeTab === 'bots' ? 'text-purple-300 border-b-2 border-purple-300' : 'text-gray-400'
          }`}
        >
          Bot Assignment
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'channels' ? (
          <ChannelAccess 
            botAssignmentId={selectedAssignment || botAssignments[0]?.id || ''}
          />
        ) : (
          <BotAssignment />
        )}
      </div>
    </div>
  )
} 