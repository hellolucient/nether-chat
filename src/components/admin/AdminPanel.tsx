/* eslint-disable */
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  id: string
  wallet_address: string
  bot_token: string | null
  created_at?: string
}

export function AdminPanel() {
  console.log('AdminPanel mounting...')
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState('')

  useEffect(() => {
    console.log('AdminPanel useEffect running...')
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    try {
      console.log('Starting to fetch profiles...')
      
      // First check if we can connect to Supabase
      const { data: testData, error: testError } = await supabase
        .from('bot_assignments')
        .select('count')
      
      console.log('Test query result:', { testData, testError })

      const { data, error } = await supabase
        .from('bot_assignments')
        .select('*')
        .order('created_at', { ascending: false })

      console.log('Full query result:', { data, error })

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      setProfiles(data || [])
    } catch (error) {
      console.error('Error in fetchProfiles:', error)
    } finally {
      setLoading(false)
    }
  }

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
    <div className="space-y-8">
      {/* User Profiles Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">User Profiles</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">User Name</label>
            <input type="text" className="w-full p-2 bg-[#262626] rounded" />
          </div>
          <div>
            <label className="block text-sm mb-2">Wallet Address</label>
            <input type="text" className="w-full p-2 bg-[#262626] rounded" />
          </div>
          <div>
            <label className="block text-sm mb-2">Bot Token</label>
            <input type="text" className="w-full p-2 bg-[#262626] rounded" />
          </div>
        </div>
      </section>

      {/* Channel Access Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Channel Access</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-[#262626] rounded">
            <label className="flex items-center space-x-2">
              <input type="checkbox" />
              <span>#general</span>
            </label>
            <div className="text-xs text-gray-400 mt-1">ID: 1334725207360802881</div>
          </div>
          <div className="p-4 bg-[#262626] rounded">
            <label className="flex items-center space-x-2">
              <input type="checkbox" />
              <span>#gen-chat</span>
            </label>
            <div className="text-xs text-gray-400 mt-1">ID: 1334725297794187318</div>
          </div>
          <div className="p-4 bg-[#262626] rounded">
            <label className="flex items-center space-x-2">
              <input type="checkbox" />
              <span>#alpha</span>
            </label>
            <div className="text-xs text-gray-400 mt-1">ID: 1334725342652403783</div>
          </div>
        </div>
        <button className="w-full mt-4 p-3 bg-purple-600 text-white rounded hover:bg-purple-700">
          Create Bot Assignment
        </button>
      </section>

      {/* Existing Profiles Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Existing Profiles</h2>
          <button 
            onClick={fetchProfiles}
            className="p-2 text-purple-300 hover:text-purple-400"
          >
            Refresh
          </button>
        </div>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4 text-gray-400">Loading profiles...</div>
          ) : profiles.length > 0 ? (
            profiles.map(profile => (
              <div 
                key={profile.id}
                className="p-4 bg-[#262626] rounded-lg"
              >
                <div className="text-sm text-gray-400 break-all">
                  Wallet: {profile.wallet_address}
                </div>
                <div className="mt-2 text-sm">
                  {profile.bot_token ? (
                    <span className="text-purple-300">Bot Connected</span>
                  ) : (
                    <span className="text-gray-400">No Bot Token</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Created: {new Date(profile.created_at || '').toLocaleDateString()}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-400">No profiles found</div>
          )}
        </div>
      </section>

      {/* Server Channels Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Server Channels</h2>
        <div>
          <label className="block text-sm mb-2">Select User</label>
          <select 
            className="w-full p-2 bg-[#262626] rounded"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">Select a user...</option>
            {/* User options would go here */}
          </select>
        </div>
      </section>

      <div className="w-64 border-l border-[#262626] p-4">
        <h2 className="font-semibold text-purple-300 mb-4">Admin Panel</h2>
        <button
          onClick={handleDisconnect}
          className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Disconnect Bot
        </button>
      </div>
    </div>
  )
} 