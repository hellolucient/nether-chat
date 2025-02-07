/* eslint-disable */
'use client'

import { BotAssignment } from './BotAssignment'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function AdminPanel() {
  const { publicKey } = useWallet()

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
      <div className="space-y-8">
        <BotAssignment />
      </div>
    </div>
  )
} 