'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  username: string
  bot_id: string
  discord_bots: {
    bot_name: string
  } | null
}

export function ProfileInfo() {
  const { publicKey } = useWallet()
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (!publicKey) return

    const fetchProfile = async () => {
      console.log('Fetching profile for wallet:', publicKey.toString())
      const { data, error } = await supabase
        .from('bot_assignments')
        .select(`
          username,
          bot_id,
          discord_bots (
            bot_name
          )
        `)
        .eq('wallet_address', publicKey.toString())
        .single()

      console.log('Profile data:', data)
      console.log('Error if any:', error)

      if (data) {
        // Handle both array and single object cases
        const botData = Array.isArray(data.discord_bots) 
          ? data.discord_bots[0] 
          : data.discord_bots

        console.log('Bot data:', botData)
        
        setProfile({
          username: data.username,
          bot_id: data.bot_id,
          discord_bots: botData || null
        })
      }
    }

    fetchProfile()
  }, [publicKey])

  if (!publicKey || !profile) return null

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-purple-300">{profile.username}</span>
      {profile.discord_bots && (
        <span className="text-gray-400">
          via {profile.discord_bots.bot_name}
        </span>
      )}
    </div>
  )
} 