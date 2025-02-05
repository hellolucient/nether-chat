/* eslint-disable */
'use client'

import { useState } from 'react'

export function AdminPanel() {
  const [selectedUser, setSelectedUser] = useState('')

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
          <button className="p-2 text-purple-300 hover:text-purple-400">
            Refresh
          </button>
        </div>
        <div className="space-y-4">
          {/* Profile cards would go here */}
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