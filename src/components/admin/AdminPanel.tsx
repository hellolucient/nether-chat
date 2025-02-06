/* eslint-disable */
'use client'

import { useState } from 'react'
import { ChannelAccess } from './ChannelAccess'
import { BotAssignment } from './BotAssignment'

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'channels' | 'bots'>('channels')

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-purple-300">Admin Panel</h2>
      
      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-[#262626]">
        <button
          onClick={() => setActiveTab('channels')}
          className={`px-4 py-2 ${
            activeTab === 'channels' 
              ? 'text-purple-300 border-b-2 border-purple-300' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Channels
        </button>
        <button
          onClick={() => setActiveTab('bots')}
          className={`px-4 py-2 ${
            activeTab === 'bots' 
              ? 'text-purple-300 border-b-2 border-purple-300' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Bot Management
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'channels' ? (
          <ChannelAccess />
        ) : (
          <BotAssignment />
        )}
      </div>
    </div>
  )
} 