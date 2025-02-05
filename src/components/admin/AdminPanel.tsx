/* eslint-disable */
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  id: string
  wallet_address: string
  bot_token: string | null
  created_at?: string
  channels?: { channel_id: string }[]  // Add this for channel mappings
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
    bot_token: ''
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
        .select(`
          *,
          channels:channel_mappings(channel_id)
        `)
        .order('created_at', { ascending: false })

      console.log('Fetched profiles with channels:', data)

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
      // First delete existing mappings
      await supabase
        .from('channel_mappings')
        .delete()
        .eq('bot_assignment_id', profileId)

      // Then insert new mappings
      const mappings = Array.from(selectedChannels).map(channelId => ({
        bot_assignment_id: profileId,
        channel_id: channelId
      }))

      const { error } = await supabase
        .from('channel_mappings')
        .insert(mappings)

      if (error) throw error
      
      setEditingProfile(null)
      fetchProfiles()  // Refresh to show updated channels
      alert('Channel access updated successfully')
    } catch (error) {
      console.error('Error updating channel access:', error)
      alert('Failed to update channel access')
    }
  }

  useEffect(() => {
    if (!editingProfile) return
    
    const profile = profiles.find(p => p.id === editingProfile)
    console.log('Setting channels for profile:', profile)
    if (profile?.channels) {
      const channelIds = profile.channels.map(c => c.channel_id)
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
      // First create bot assignment
      const { data: assignment, error: assignmentError } = await supabase
        .from('bot_assignments')
        .insert({
          username: newUserData.username,
          wallet_address: newUserData.wallet_address,
          bot_token: newUserData.bot_token || null
        })
        .select()
        .single()

      if (assignmentError) throw assignmentError

      // Then create channel mappings
      if (newUserChannels.size > 0) {
        const mappings = Array.from(newUserChannels).map(channelId => ({
          bot_assignment_id: assignment.id,
          channel_id: channelId
        }))

        const { error: mappingError } = await supabase
          .from('channel_mappings')
          .insert(mappings)

        if (mappingError) throw mappingError
      }

      // Reset form and refresh profiles
      setNewUserData({ username: '', wallet_address: '', bot_token: '' })
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
                  Channels: {profile.channels?.length ? (
                    <>
                      {profile.channels
                        .filter((c, i, arr) => 
                          // Remove duplicates
                          arr.findIndex(ch => ch.channel_id === c.channel_id) === i
                        )
                        .map(c => allChannels[c.channel_id])
                        .filter(Boolean) // Remove undefined channels
                        .join(', ')}
                      <span className="text-xs ml-1">
                        ({profile.channels
                          .filter((c, i, arr) => 
                            arr.findIndex(ch => ch.channel_id === c.channel_id) === i
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