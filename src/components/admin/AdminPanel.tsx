/* eslint-disable */
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  id: string
  wallet_address: string
  bot_token: string | null
  created_at?: string
  channel_access: string[]  // Array of channel IDs
  is_admin?: boolean
}

export function AdminPanel() {
  console.log('AdminPanel mounting...')
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProfile, setEditingProfile] = useState<string | null>(null)
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set())
  const [allChannels, setAllChannels] = useState<Record<string, string>>({})
  const [newUserChannels, setNewUserChannels] = useState<Set<string>>(new Set())
  const [newUserData, setNewUserData] = useState({
    username: '',
    wallet_address: '',
    bot_token: '',
    is_admin: false
  })

  useEffect(() => {
    console.log('AdminPanel useEffect running...')
    fetchProfiles()
  }, [])

  const fetchServerChannels = async () => {
    try {
      console.log('🔍 Fetching server channels...')
      const response = await fetch('/api/channels')
      const { channels } = await response.json()
      console.log('🔍 Got channels from Discord:', channels)
      
      const channelMap: Record<string, string> = {}
      channels.forEach((channel: { id: string; name: string }) => {
        channelMap[channel.id] = channel.name
      })
      
      console.log('🔍 Channel map:', channelMap)
      setAllChannels(channelMap)
    } catch (error) {
      console.error('Error fetching server channels:', error)
    }
  }

  useEffect(() => {
    fetchServerChannels()
  }, [])

  const fetchProfiles = async () => {
    try {
      console.log('Starting to fetch profiles...')
      
      const { data, error } = await supabase
        .from('bot_assignments')
        .select('*')
        .order('created_at', { ascending: false })

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

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return

    try {
      const { error } = await supabase
        .from('bot_assignments')
        .delete()
        .eq('id', profileId)

      if (error) throw error
      
      // Refresh profiles after delete
      fetchProfiles()
      setEditingProfile(null)
    } catch (error) {
      console.error('Error deleting profile:', error)
      alert('Failed to delete profile')
    }
  }

  const handleUpdateChannelAccess = async (profileId: string) => {
    try {
      console.log('🔄 Updating channels for profile:', profileId)
      console.log('🔄 Selected channels:', Array.from(selectedChannels))

      // Update the channel_access array in bot_assignments
      const { error: updateError } = await supabase
        .from('bot_assignments')
        .update({ 
          channel_access: Array.from(selectedChannels) 
        })
        .eq('id', profileId)

      if (updateError) {
        console.error('Error updating channel access:', updateError)
        throw updateError
      }

      setEditingProfile(null)
      fetchProfiles()
    } catch (error) {
      console.error('Error updating channel access:', error)
      alert(`Failed to update channel access: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  useEffect(() => {
    if (!editingProfile) return
    
    const profile = profiles.find(p => p.id === editingProfile)
    console.log('Setting channels for profile:', profile)
    if (profile?.channel_access) {
      const channelIds = profile.channel_access
      console.log('Channel IDs to set:', channelIds)
      setSelectedChannels(new Set(channelIds))
    }
  }, [editingProfile, profiles])

  // Add sync function
  const syncChannels = async () => {
    try {
      const response = await fetch('/api/channels/sync', { method: 'POST' })
      if (!response.ok) throw new Error('Failed to sync channels')
      
      // Refresh data after sync
      await fetchServerChannels()
      await fetchProfiles()
    } catch (error) {
      console.error('Error syncing channels:', error)
      alert('Failed to sync channel mappings')
    }
  }

  // Add handler for creating new user
  const handleCreateUser = async () => {
    try {
      const newId = crypto.randomUUID() // Generate one UUID to use for both records

      // First create bot assignment
      const { data: assignment, error: assignmentError } = await supabase
        .from('bot_assignments')
        .insert({
          id: newId, // Use the same UUID
          username: newUserData.username,
          wallet_address: newUserData.wallet_address,
          bot_token: newUserData.bot_token || null,
          is_admin: newUserData.is_admin
        })
        .select()
        .single()

      if (assignmentError) throw assignmentError

      // If admin, also create admin_user record with same UUID
      if (newUserData.is_admin) {
        const { error: adminError } = await supabase
          .from('admin_users')
          .insert({
            id: newId, // Use the same UUID
            wallet_address: newUserData.wallet_address
          })

        if (adminError) throw adminError
      }

      // Reset form and refresh
      setNewUserData({ username: '', wallet_address: '', bot_token: '', is_admin: false })
      setNewUserChannels(new Set())
      fetchProfiles()
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Failed to create user')
    }
  }

  return (
    <div className="space-y-8">
      {/* User Profiles Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Create New User</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">User Name</label>
            <input 
              type="text" 
              className="w-full p-2 bg-[#262626] rounded"
              value={newUserData.username}
              onChange={e => setNewUserData(prev => ({ ...prev, username: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm mb-2">Wallet Address</label>
            <input 
              type="text" 
              className="w-full p-2 bg-[#262626] rounded"
              value={newUserData.wallet_address}
              onChange={e => setNewUserData(prev => ({ ...prev, wallet_address: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm mb-2">Bot Token (Optional)</label>
            <input 
              type="text" 
              className="w-full p-2 bg-[#262626] rounded"
              value={newUserData.bot_token}
              onChange={e => setNewUserData(prev => ({ ...prev, bot_token: e.target.value }))}
            />
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input 
                type="checkbox"
                checked={newUserData.is_admin}
                onChange={e => setNewUserData(prev => ({ ...prev, is_admin: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Admin</span>
            </label>
          </div>
        </div>
      </section>

      {/* Channel Access Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Channel Access</h2>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(allChannels).map(([id, name]) => (
            <div key={id} className="p-4 bg-[#262626] rounded">
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox"
                  checked={newUserChannels.has(id)}
                  onChange={(e) => {
                    const newChannels = new Set(newUserChannels)
                    if (e.target.checked) {
                      newChannels.add(id)
                    } else {
                      newChannels.delete(id)
                    }
                    setNewUserChannels(newChannels)
                  }}
                />
                <span>#{name}</span>
              </label>
              <div className="text-xs text-gray-400 mt-1">ID: {id}</div>
            </div>
          ))}
        </div>
        <button 
          onClick={handleCreateUser}
          className="w-full mt-4 p-3 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Create Bot Assignment
        </button>
      </section>

      {/* Existing Profiles Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Existing Profiles</h2>
          <div className="flex space-x-2">
            <button 
              onClick={syncChannels}
              className="p-2 text-blue-300 hover:text-blue-400"
            >
              Sync Channels
            </button>
            <button 
              onClick={fetchProfiles}
              className="p-2 text-purple-300 hover:text-purple-400"
            >
              Refresh
            </button>
          </div>
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
                
                {/* Show current channel access */}
                <div className="mt-2 text-sm text-gray-400">
                  Channels: {profile.channel_access?.length ? (
                    <>
                      {profile.channel_access
                        .filter((c, i, arr) => 
                          // Remove duplicates
                          arr.findIndex(ch => ch === c) === i
                        )
                        .map(c => allChannels[c])
                        .filter(Boolean) // Remove undefined channels
                        .join(', ')}
                      <span className="text-xs ml-1">
                        ({profile.channel_access
                          .filter((c, i, arr) => 
                            arr.findIndex(ch => ch === c) === i
                          ).length} total)
                      </span>
                    </>
                  ) : (
                    'No channels assigned'
                  )}
                </div>

                {/* Edit mode */}
                {editingProfile === profile.id && (
                  <div className="mt-4 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(allChannels).map(([id, name]) => (
                        <label key={id} className="flex items-center space-x-2 p-2 bg-[#1E1E24] rounded">
                          <input 
                            type="checkbox"
                            checked={selectedChannels.has(id)}
                            onChange={(e) => {
                              const newChannels = new Set(selectedChannels)
                              if (e.target.checked) {
                                newChannels.add(id)
                              } else {
                                newChannels.delete(id)
                              }
                              setSelectedChannels(newChannels)
                            }}
                          />
                          <span className="text-sm">#{name}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateChannelAccess(profile.id)}
                        className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingProfile(null)}
                        className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex space-x-2">
                  {editingProfile !== profile.id && (
                    <button
                      onClick={() => setEditingProfile(profile.id)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit Channels
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteProfile(profile.id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  Created: {new Date(profile.created_at || '').toLocaleDateString()}
                </div>

                <div className="flex items-center mt-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={profile.is_admin}
                      onChange={async (e) => {
                        try {
                          const { error } = await supabase
                            .from('bot_assignments')
                            .update({ is_admin: e.target.checked })
                            .eq('id', profile.id)
                          
                          if (error) throw error
                          fetchProfiles()
                        } catch (error) {
                          console.error('Error updating admin status:', error)
                          alert('Failed to update admin status')
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Admin</span>
                  </label>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-400">No profiles found</div>
          )}
        </div>
      </section>

      {/* Admin controls at bottom */}
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