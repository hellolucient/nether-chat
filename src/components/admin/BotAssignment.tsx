'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

interface User {
  id: string
  wallet_address: string
  username: string
  channel_access: string[]
  is_admin: boolean
  bot_id: string
  created_at: string
}

interface Bot {
  id: string
  bot_name: string
  bot_token?: string
}

interface Channel {
  id: string
  name: string
}

export function BotAssignment() {
  const { publicKey } = useWallet()
  const [users, setUsers] = useState<User[]>([])
  const [bots, setBots] = useState<Bot[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [editingUser, setEditingUser] = useState<string | null>(null)
  
  // Update form state
  const [formData, setFormData] = useState({
    username: '',
    walletAddress: '',
    selectedBot: '',  // Changed from botToken to selectedBot
    selectedChannels: [] as string[],
    isAdmin: false
  })

  // Add bot fetching
  useEffect(() => {
    fetchBots()
    fetchUsers()
    fetchChannels()
  }, [])

  const fetchBots = async () => {
    const { data } = await supabase
      .from('discord_bots')
      .select('id, bot_name')
    setBots(data || [])
  }

  // Fetch users with their bot tokens and channel access
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_assignments')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching users:', error)
        return
      }

      console.log('Fetched users:', data) // For debugging
      setUsers(data || [])
    } catch (error) {
      console.error('Error in fetchUsers:', error)
    }
  }

  // Fetch available channels
  const fetchChannels = async () => {
    try {
      console.log('Fetching channels...')
      const response = await fetch('/api/channels')
      const data = await response.json()
      console.log('Channel data received:', data)
      
      if (!data.channels) {
        console.error('No channels returned from API')
        return
      }

      console.log('Setting channels:', data.channels)
      setChannels(data.channels)
    } catch (error) {
      console.error('Error fetching channels:', error)
    }
  }

  // Update handleSubmit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicKey || !formData.selectedBot) return

    try {
      if (editingUser) {
        const { error } = await supabase
          .from('bot_assignments')
          .update({
            username: formData.username,
            bot_id: formData.selectedBot,
            channel_access: formData.selectedChannels,
            is_admin: formData.isAdmin
          })
          .eq('wallet_address', editingUser)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('bot_assignments')
          .insert({
            wallet_address: formData.walletAddress,
            username: formData.username,
            bot_id: formData.selectedBot,
            channel_access: formData.selectedChannels,
            is_admin: formData.isAdmin
          })

        if (error) throw error
      }

      setFormData({
        username: '',
        walletAddress: '',
        selectedBot: '',
        selectedChannels: [],
        isAdmin: false
      })
      setEditingUser(null)
      fetchUsers()
    } catch (error) {
      console.error('Error saving user:', error)
      alert('Failed to save user: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  // Handle user deletion
  const handleDelete = async (walletAddress: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const { error } = await supabase
        .from('bot_assignments')
        .delete()
        .eq('wallet_address', walletAddress)

      if (error) throw error

      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  return (
    <div className="space-y-8">
      {/* Form Section */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-[#1E1E24] p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-purple-300">
          {editingUser ? 'Edit User' : 'Create New User'}
        </h3>

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({...prev, username: e.target.value}))}
              className="mt-1 block w-full px-3 py-2 bg-[#262626] rounded-md"
              required
            />
          </div>

          {!editingUser && (
            <div>
              <label className="block text-sm font-medium text-gray-300">Wallet Address</label>
              <input
                type="text"
                value={formData.walletAddress}
                onChange={(e) => setFormData(prev => ({...prev, walletAddress: e.target.value}))}
                className="mt-1 block w-full px-3 py-2 bg-[#262626] rounded-md"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300">Bot</label>
            <select
              value={formData.selectedBot}
              onChange={(e) => setFormData(prev => ({...prev, selectedBot: e.target.value}))}
              className="mt-1 block w-full px-3 py-2 bg-[#262626] rounded-md"
              required
            >
              <option value="">Select a bot</option>
              {bots.map(bot => (
                <option key={bot.id} value={bot.id}>{bot.bot_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Channel Access
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-[#262626] rounded-md">
              {channels.map(channel => (
                <label key={channel.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.selectedChannels.includes(channel.id)}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        selectedChannels: e.target.checked 
                          ? [...prev.selectedChannels, channel.id]
                          : prev.selectedChannels.filter(id => id !== channel.id)
                      }))
                    }}
                    className="rounded border-gray-600 text-purple-600"
                  />
                  <span className="text-gray-300">#{channel.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            {editingUser ? 'Save Changes' : 'Create User'}
          </button>
          
          {editingUser && (
            <button
              type="button"
              onClick={() => {
                setEditingUser(null)
                setFormData({
                  username: '',
                  walletAddress: '',
                  selectedBot: '',
                  selectedChannels: [],
                  isAdmin: false
                })
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* User List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-purple-300">Existing Users</h3>
        {users.map(user => (
          <div key={user.id} className="p-4 bg-[#1E1E24] rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-purple-300">
                  {user.username}
                </h4>
                <p className="text-sm text-gray-400 mt-1">
                  {user.wallet_address}
                </p>
                <p className="text-sm text-gray-400">
                  Bot: {bots.find(b => b.id === user.bot_id)?.bot_name || 'Unassigned'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(user.channel_access || []).map(channelId => {
                    const channel = channels.find(c => c.id === channelId)
                    return channel ? (
                      <span key={channelId} className="px-2 py-1 bg-[#262626] rounded text-sm">
                        #{channel.name}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingUser(user.wallet_address)
                    setFormData({
                      username: user.username,
                      walletAddress: user.wallet_address,
                      selectedBot: user.bot_id || '',
                      selectedChannels: user.channel_access || [],
                      isAdmin: user.is_admin || false
                    })
                  }}
                  className="p-2 text-gray-400 hover:text-purple-300"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(user.wallet_address)}
                  className="p-2 text-gray-400 hover:text-red-400"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 