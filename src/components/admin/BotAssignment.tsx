'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

interface User {
  id: string
  name: string
  wallet_address: string
  bot_token: string
  channel_access: string[]
  is_admin: boolean
}

interface Channel {
  id: string
  name: string
}

export function BotAssignment() {
  const { publicKey } = useWallet()
  const [users, setUsers] = useState<User[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [editingUser, setEditingUser] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    walletAddress: '',
    botToken: '',
    selectedChannels: [] as string[],
    isAdmin: false
  })

  // Fetch initial data
  useEffect(() => {
    fetchUsers()
    fetchChannels()
  }, [])

  // Fetch users with their bot tokens and channel access
  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('bot_assignments')
      .select(`
        *,
        bot_tokens (
          bot_token,
          bot_name
        )
      `)
    
    if (error) {
      console.error('Error fetching users:', error)
      return
    }

    setUsers(data || [])
  }

  // Fetch available channels
  const fetchChannels = async () => {
    const response = await fetch('/api/channels')
    const data = await response.json()
    setChannels(data.channels || [])
  }

  // Handle form submission (create/edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicKey) return

    try {
      if (editingUser) {
        // Update existing user
        const [assignmentResult, tokenResult] = await Promise.all([
          supabase
            .from('bot_assignments')
            .update({
              name: formData.name,
              channel_access: formData.selectedChannels,
              is_admin: formData.isAdmin
            })
            .eq('wallet_address', editingUser),
          
          supabase
            .from('bot_tokens')
            .update({
              bot_token: formData.botToken
            })
            .eq('wallet_address', editingUser)
        ])

        if (assignmentResult.error) throw assignmentResult.error
        if (tokenResult.error) throw tokenResult.error

      } else {
        // Create new user
        const [assignmentResult, tokenResult] = await Promise.all([
          supabase
            .from('bot_assignments')
            .insert({
              wallet_address: formData.walletAddress,
              name: formData.name,
              channel_access: formData.selectedChannels,
              is_admin: formData.isAdmin
            }),
          
          supabase
            .from('bot_tokens')
            .insert({
              wallet_address: formData.walletAddress,
              bot_token: formData.botToken
            })
        ])

        if (assignmentResult.error) throw assignmentResult.error
        if (tokenResult.error) throw tokenResult.error
      }

      // Reset form and refresh data
      setFormData({
        name: '',
        walletAddress: '',
        botToken: '',
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
      const [assignmentResult, tokenResult] = await Promise.all([
        supabase
          .from('bot_assignments')
          .delete()
          .eq('wallet_address', walletAddress),
        
        supabase
          .from('bot_tokens')
          .delete()
          .eq('wallet_address', walletAddress)
      ])

      if (assignmentResult.error) throw assignmentResult.error
      if (tokenResult.error) throw tokenResult.error

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
            <label className="block text-sm font-medium text-gray-300">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
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
            <label className="block text-sm font-medium text-gray-300">Bot Token</label>
            <input
              type="password"
              value={formData.botToken}
              onChange={(e) => setFormData(prev => ({...prev, botToken: e.target.value}))}
              className="mt-1 block w-full px-3 py-2 bg-[#262626] rounded-md"
              required={!editingUser}
              placeholder={editingUser ? '(Leave blank to keep current token)' : ''}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Channel Access</label>
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
                  name: '',
                  walletAddress: '',
                  botToken: '',
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
          <div key={user.wallet_address} className="p-4 bg-[#1E1E24] rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-purple-300">{user.name}</h4>
                <p className="text-sm text-gray-400 mt-1">{user.wallet_address}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.channel_access.map(channelId => {
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
                      name: user.name,
                      walletAddress: user.wallet_address,
                      botToken: '',
                      selectedChannels: user.channel_access,
                      isAdmin: user.is_admin
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