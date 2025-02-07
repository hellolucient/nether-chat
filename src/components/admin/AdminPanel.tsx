/* eslint-disable */
'use client'

import { useState } from 'react'
import { BotAssignment } from './BotAssignment'
import { BotManagement } from './BotManagement'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function AdminPanel() {
  const { publicKey } = useWallet()
  const [activeTab, setActiveTab] = useState<'users' | 'bots'>('users')

  if (!publicKey) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-purple-300 mb-4">
          Connect Wallet to Access Admin Panel
        </h2>
        <WalletMultiButton />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Tab Navigation */}
      <div className="flex gap-4 mb-8 border-b border-[#262626]">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 ${
            activeTab === 'users' 
              ? 'text-purple-300 border-b-2 border-purple-300' 
              : 'text-gray-400'
          }`}
        >
          User Management
        </button>
        <button
          onClick={() => setActiveTab('bots')}
          className={`px-4 py-2 ${
            activeTab === 'bots' 
              ? 'text-purple-300 border-b-2 border-purple-300' 
              : 'text-gray-400'
          }`}
        >
          Bot Management
        </button>
      </div>

      {/* Content */}
      <div className="space-y-8">
        {activeTab === 'users' ? <BotAssignment /> : <BotManagement />}
      </div>
    </div>
  )
} 