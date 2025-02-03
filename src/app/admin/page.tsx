'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface BotAssignment {
  id: string
  username: string
  wallet_address: string
  bot_token: string
  channel_access?: string[]
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const { publicKey } = useWallet()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<Array<{id: string, name: string}>>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [botAssignments, setBotAssignments] = useState<BotAssignment[]>([])
  const [editingUser, setEditingUser] = useState<BotAssignment | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    walletAddress: '',
    botToken: ''
  })

  // Check if user is admin and fetch data
  useEffect(() => {
    async function init() {
      if (!publicKey) {
        router.push('/')
        return
      }

      // Check admin status
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('wallet_address')
        .eq('wallet_address', publicKey.toString())
        .single()

      if (!adminData || adminError) {
        router.push('/')
        return
      }

      setIsAdmin(true)

      // Fetch channels
      const channelsResponse = await fetch('/api/channels')
      const channelsData = await channelsResponse.json()
      if (channelsData.channels) {
        setChannels(channelsData.channels)
      }

      // Fetch bot assignments
      const { data: assignments, error } = await supabase
        .from('bot_assignments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching bot assignments:', error)
      } else {
        setBotAssignments(assignments || [])
      }

      setLoading(false)
    }

    init()
  }, [publicKey, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const botData = {
        username: formData.username,
        wallet_address: formData.walletAddress,
        bot_token: formData.botToken,
        channel_access: selectedChannels || []
      }

      let error;
      if (editingUser) {
        const { error: updateError } = await supabase
          .from('bot_assignments')
          .update(botData)
          .eq('id', editingUser.id)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('bot_assignments')
          .insert([botData])
        error = insertError
      }

      if (error) {
        console.error('Error saving bot assignment:', error)
        throw error
      }

      // Reset form and refresh list
      setFormData({ username: '', walletAddress: '', botToken: '' })
      setSelectedChannels([])
      setEditingUser(null)
      
      // Refresh bot assignments list
      const { data: refreshedData } = await supabase
        .from('bot_assignments')
        .select('*')
        .order('created_at', { ascending: false })

      if (refreshedData) {
        setBotAssignments(refreshedData)
      }

    } catch (error) {
      console.error('Error saving bot assignment:', error)
      alert('Failed to save bot assignment')
    }
  }

  const handleSelectAllChannels = () => {
    setSelectedChannels(channels.map(c => c.id))
  }

  const handleDeselectAllChannels = () => {
    setSelectedChannels([])
  }

  const handleEditUser = (user: BotAssignment) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      walletAddress: user.wallet_address,
      botToken: user.bot_token
    })
    setSelectedChannels(user.channel_access || [])
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this bot assignment?')) return

    try {
      const { error } = await supabase
        .from('bot_assignments')
        .delete()
        .eq('id', userId)

      if (error) throw error

      // Refresh bot assignments list
      const { data } = await supabase
        .from('bot_assignments')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) setBotAssignments(data)
    } catch (error) {
      console.error('Error deleting bot assignment:', error)
      alert('Failed to delete bot assignment')
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="min-h-screen bg-[#17171B] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <Link 
            href="/"
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700"
          >
            Return to Chat
          </Link>
        </div>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Bot Assignments</h2>
          <div className="space-y-4">
            {botAssignments.map(bot => (
              <div key={bot.id} className="bg-[#1E1E24] p-4 rounded border border-[#262626]">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-lg">{bot.username}</h3>
                      <span className="text-sm text-gray-400">({bot.wallet_address})</span>
                    </div>
                    <div className="mt-2">
                      <h4 className="text-sm font-medium mb-2">Channel Access:</h4>
                      <div className="flex flex-wrap gap-2">
                        {channels
                          .filter(c => (bot.channel_access || []).includes(c.id))
                          .map(c => (
                            <span key={c.id} className="text-sm bg-purple-900 text-purple-200 px-2 py-1 rounded">
                              {c.name}
                            </span>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingUser(bot as BotAssignment)
                        setFormData({
                          username: bot.username,
                          walletAddress: bot.wallet_address,
                          botToken: bot.bot_token
                        })
                        setSelectedChannels(bot.channel_access || [])
                      }}
                      className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUser(bot.id)}
                      className="px-3 py-1 bg-red-600 rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">
            {editingUser ? `Edit ${editingUser.username}` : 'Create New Bot Assignment'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-2">User Name</label>
              <input
                type="text"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
                className="w-full p-2 bg-[#1E1E24] rounded border border-[#262626]"
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Wallet Address</label>
              <input
                type="text"
                value={formData.walletAddress}
                onChange={e => setFormData({...formData, walletAddress: e.target.value})}
                className="w-full p-2 bg-[#1E1E24] rounded border border-[#262626]"
              />
            </div>

            <div>
              <label className="block text-sm mb-2">Bot Token</label>
              <input
                type="text"
                value={formData.botToken}
                onChange={e => setFormData({...formData, botToken: e.target.value})}
                className="w-full p-2 bg-[#1E1E24] rounded border border-[#262626]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm">Channel Access</label>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAllChannels}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllChannels}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {channels.map(channel => (
                  <label key={channel.id} className="flex items-center space-x-3 p-2 bg-[#1E1E24] rounded hover:bg-[#262626]">
                    <input
                      type="checkbox"
                      checked={(selectedChannels || []).includes(channel.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChannels([...selectedChannels, channel.id])
                        } else {
                          setSelectedChannels(selectedChannels.filter(id => id !== channel.id))
                        }
                      }}
                      className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-600 bg-gray-700"
                    />
                    <span className="text-gray-200">{channel.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 py-2 bg-purple-600 rounded hover:bg-purple-700"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </button>
              {editingUser && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null)
                    setFormData({ username: '', walletAddress: '', botToken: '' })
                    setSelectedChannels([])
                  }}
                  className="flex-1 py-2 bg-gray-600 rounded hover:bg-gray-700"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  )
} 