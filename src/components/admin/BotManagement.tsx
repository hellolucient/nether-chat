'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

interface Bot {
  id: string
  bot_name: string
  bot_token?: string
  discord_id?: string
  created_at: string
}

export function BotManagement() {
  const { publicKey } = useWallet()
  const [bots, setBots] = useState<Bot[]>([])
  const [editingBot, setEditingBot] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    botName: '',
    botToken: ''
  })

  // Fetch bots
  const fetchBots = async () => {
    const { data, error } = await supabase
      .from('discord_bots')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching bots:', error)
      return
    }
    setBots(data || [])
  }

  useEffect(() => {
    fetchBots()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicKey) return

    try {
      // Validate token via API if one is provided
      if (formData.botToken.trim()) {
        const validateResponse = await fetch('/api/admin/validate-bot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botToken: formData.botToken })
        })

        if (!validateResponse.ok) {
          alert('Invalid bot token')
          return
        }

        const validation = await validateResponse.json()

        if (editingBot) {
          // Get current bot data first
          const { data: currentBot } = await supabase
            .from('discord_bots')
            .select('*')
            .eq('id', editingBot)
            .single()

          if (!currentBot) {
            throw new Error('Bot not found')
          }

          // Prepare update object with only changed fields
          const updates: any = {
            bot_name: formData.botName,
            discord_id: validation.botId // Use the ID from validation
          }

          // Only include token if it's provided
          if (formData.botToken.trim()) {
            updates.bot_token = formData.botToken
          }

          // Preserve discord_id
          updates.discord_id = currentBot.discord_id

          const { error } = await supabase
            .from('discord_bots')
            .update(updates)
            .eq('id', editingBot)

          if (error) throw error
        } else {
          // Insert new bot
          const { error } = await supabase
            .from('discord_bots')
            .insert({
              bot_name: formData.botName,
              bot_token: formData.botToken,
              discord_id: validation.botId
            })

          if (error) throw error
        }

        setEditingBot(null)
        setFormData({ botName: '', botToken: '' })
        fetchBots()
      }
    } catch (error) {
      console.error('Error updating bot:', error)
      alert('Failed to update bot')
    }
  }

  const handleDelete = async (botId: string) => {
    if (!confirm('Are you sure you want to delete this bot?')) return
    
    try {
      // First remove any bot assignments
      const { error: assignmentError } = await supabase
        .from('bot_assignments')
        .update({ bot_id: null })
        .eq('bot_id', botId)

      if (assignmentError) {
        console.error('Failed to clear bot assignments:', assignmentError)
        alert('Failed to delete bot: Could not clear assignments')
        return
      }

      // Then delete the bot
      const { error: deleteError } = await supabase
        .from('discord_bots')
        .delete()
        .eq('id', botId)

      if (deleteError) {
        console.error('Failed to delete bot:', deleteError)
        alert('Failed to delete bot')
        return
      }

      fetchBots() // Refresh the list
    } catch (error) {
      console.error('Error deleting bot:', error)
      alert('Failed to delete bot')
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-purple-300">Bot Management</h2>
      
      {/* Bot Form */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-[#1E1E24] p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-purple-300">
          {editingBot ? 'Edit Bot' : 'Add New Bot'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Bot Name</label>
            <input
              type="text"
              value={formData.botName}
              onChange={(e) => setFormData(prev => ({...prev, botName: e.target.value}))}
              className="mt-1 block w-full px-3 py-2 bg-[#262626] rounded-md"
              required
              placeholder="Discord Bot Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Bot Token</label>
            <input
              type="password"
              value={formData.botToken}
              onChange={(e) => setFormData(prev => ({...prev, botToken: e.target.value}))}
              className="mt-1 block w-full px-3 py-2 bg-[#262626] rounded-md"
              required={!editingBot}
              placeholder={editingBot ? '(Leave blank to keep current token)' : 'Discord Bot Token'}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            {editingBot ? 'Save Changes' : 'Add Bot'}
          </button>
          
          {editingBot && (
            <button
              type="button"
              onClick={() => {
                setEditingBot(null)
                setFormData({ botName: '', botToken: '' })
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Bot List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-purple-300">Available Bots</h3>
        {bots.map(bot => (
          <div key={bot.id} className="p-4 bg-[#1E1E24] rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-purple-300">{bot.bot_name}</h4>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingBot(bot.id)
                    setFormData({
                      botName: bot.bot_name,
                      botToken: ''
                    })
                  }}
                  className="p-2 text-gray-400 hover:text-purple-300"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(bot.id)}
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