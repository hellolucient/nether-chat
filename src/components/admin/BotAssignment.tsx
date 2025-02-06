'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { supabase } from '@/lib/supabase'

interface BotAssignment {
  wallet_address: string
  bot_token?: string
  bot_name?: string
  channel_access: string[]
  is_admin: boolean  // This comes from bot_assignments table
}

export function BotAssignment() {
  const { publicKey } = useWallet()
  const [assignments, setAssignments] = useState<BotAssignment[]>([])
  const [newBotToken, setNewBotToken] = useState('')
  const [targetWallet, setTargetWallet] = useState('')
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState<string | null>(null)
  const [editToken, setEditToken] = useState('')

  // Fetch existing assignments
  useEffect(() => {
    const fetchAssignments = async () => {
      console.log('🔄 Fetching bot assignments...')
      
      // Get all assignments first
      const { data: assignments, error: assignError } = await supabase
        .from('bot_assignments')
        .select('wallet_address, channel_access, is_admin')

      if (assignError) {
        console.error('❌ Error fetching assignments:', assignError)
        return
      }

      // Get bot tokens
      const { data: botTokens, error: botError } = await supabase
        .from('bot_tokens')
        .select('*')
      
      if (botError) {
        console.error('❌ Error fetching bot tokens:', botError)
        return
      }

      console.log('📊 Raw data:', { botTokens, assignments })

      // Start with assignments and add bot data if it exists
      const combinedData = assignments.map(assignment => ({
        wallet_address: assignment.wallet_address,
        channel_access: assignment.channel_access || [],
        is_admin: assignment.is_admin,
        bot_token: '', // We don't show the actual token
        bot_name: botTokens.find(b => b.wallet_address === assignment.wallet_address)?.bot_name || 'No Bot Assigned',
        ...botTokens.find(b => b.wallet_address === assignment.wallet_address)
      }))

      console.log('✅ Combined assignments:', combinedData)
      setAssignments(combinedData)
    }

    fetchAssignments()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicKey || !newBotToken.trim() || !targetWallet.trim()) return

    // Check if wallet already has a bot assigned
    const existing = assignments.find(a => a.wallet_address === targetWallet.trim())
    if (existing) {
      const proceed = confirm('This wallet already has a bot assigned. Do you want to update it?')
      if (!proceed) return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/assign-bot', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-wallet': publicKey.toString()
        },
        body: JSON.stringify({
          botToken: newBotToken.trim(),
          walletAddress: targetWallet.trim(),
          isAdmin: false
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(`Bot "${data.botName}" assigned successfully!`)
        setNewBotToken('')
        setTargetWallet('')
        // Refresh assignments
        const { data: newAssignments } = await supabase
          .from('bot_tokens')
          .select('*')
          .order('created_at', { ascending: false })
        if (newAssignments) setAssignments(newAssignments)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      alert('Failed to assign bot: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (walletAddress: string) => {
    if (!publicKey || !editToken.trim()) return

    try {
      console.log('📝 Sending edit request:', {
        walletAddress,
        isAdmin: assignments.find(a => a.wallet_address === walletAddress)?.is_admin
      })

      const response = await fetch('/api/admin/assign-bot', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-wallet': publicKey.toString()
        },
        body: JSON.stringify({
          botToken: editToken.trim(),
          walletAddress,
          isAdmin: assignments.find(a => a.wallet_address === walletAddress)?.is_admin || false
        })
      })

      const data = await response.json()
      console.log('📥 Edit response:', data)

      if (data.success) {
        alert(`Bot token updated successfully!`)
        setEditMode(null)
        setEditToken('')
        
        // Refresh assignments with the updated data fetching
        const fetchAssignments = async () => {
          const { data: assignments } = await supabase
            .from('bot_assignments')
            .select('wallet_address, channel_access, is_admin')

          const { data: botTokens } = await supabase
            .from('bot_tokens')
            .select('*')

          const combinedData = assignments?.map(assignment => ({
            wallet_address: assignment.wallet_address,
            channel_access: assignment.channel_access || [],
            is_admin: assignment.is_admin,
            bot_token: '',
            bot_name: botTokens?.find(b => b.wallet_address === assignment.wallet_address)?.bot_name || 'No Bot Assigned',
            ...botTokens?.find(b => b.wallet_address === assignment.wallet_address)
          })) || []

          setAssignments(combinedData)
        }

        fetchAssignments()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('❌ Edit error:', error)
      alert('Failed to update bot token: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleDelete = async (walletAddress: string) => {
    if (!confirm('Are you sure you want to delete this bot assignment?')) return

    try {
      const { error } = await supabase
        .from('bot_tokens')
        .delete()
        .eq('wallet_address', walletAddress)

      if (error) throw error

      setAssignments(prev => prev.filter(a => a.wallet_address !== walletAddress))
    } catch (error) {
      alert('Failed to delete bot assignment: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  if (!publicKey) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-gray-400">Please connect your wallet to manage bot assignments</p>
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* New Bot Assignment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold text-purple-300">Assign New Bot</h3>
        <div>
          <label className="block text-sm font-medium text-gray-300">Target Wallet</label>
          <input
            type="text"
            value={targetWallet}
            onChange={(e) => setTargetWallet(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-[#1E1E24] border border-[#262626] rounded-md text-gray-100"
            placeholder="Enter wallet address"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Bot Token</label>
          <input
            type="password"
            value={newBotToken}
            onChange={(e) => setNewBotToken(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-[#1E1E24] border border-[#262626] rounded-md text-gray-100"
            placeholder="Enter bot token"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !newBotToken.trim() || !targetWallet.trim()}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Assigning...' : 'Assign Bot'}
        </button>
      </form>

      {/* Existing Assignments */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-purple-300">Existing Bot Assignments</h3>
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div key={assignment.wallet_address} className="p-4 bg-[#1E1E24] rounded-lg">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-400">Wallet</p>
                    <p className="text-gray-100">{assignment.wallet_address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Bot Name</p>
                    <p className="text-gray-100">{assignment.bot_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Channel Access</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {assignment.channel_access?.map(channelId => (
                        <span 
                          key={channelId}
                          className="px-2 py-1 text-sm bg-[#262626] rounded"
                        >
                          {channelId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(assignment.wallet_address)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                    {editMode === assignment.wallet_address ? (
                      <div className="flex-1 ml-4">
                        <input
                          type="password"
                          value={editToken}
                          onChange={(e) => setEditToken(e.target.value)}
                          className="w-full px-3 py-2 bg-[#262626] border border-[#363640] rounded-md text-gray-100"
                          placeholder="Enter new bot token"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleEdit(assignment.wallet_address)}
                            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditMode(null)
                              setEditToken('')
                            }}
                            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditMode(assignment.wallet_address)
                          setEditToken('')
                        }}
                        className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Edit Token
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 