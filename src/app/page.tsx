/* eslint-disable */
'use client'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Chat } from '@/components/chat/Chat'
import { useState, useEffect } from 'react'
import { UnreadProvider } from '@/contexts/UnreadContext'
import { Providers } from './providers'
import { useWallet } from '@solana/wallet-adapter-react'
import { supabase } from '@/lib/supabase'

// Channel name mapping
const CHANNEL_NAMES: Record<string, string> = {
  '133472520736080288': 'General',
  '133472529779418731': 'Alpha',
  '133472534265240378': 'Gen Chat',
}

function AppContent() {
  const [activeChannel, setActiveChannel] = useState<string>('')
  const [channels, setChannels] = useState<Array<{ id: string; name: string; unread?: boolean }>>([])
  const { publicKey, connected } = useWallet()

  useEffect(() => {
    async function fetchChannels() {
      if (!publicKey || !connected) {
        console.log('Wallet status:', { publicKey: publicKey?.toString(), connected })
        return
      }

      try {
        // First get channel access from supabase
        const { data: assignment, error } = await supabase
          .from('bot_assignments')
          .select('channel_access')
          .eq('wallet_address', publicKey.toString())
          .single()

        if (error) {
          console.error('Error fetching channel access:', error)
          return
        }

        // Then fetch channel details from Discord
        const response = await fetch('/api/channels')
        const { channels: discordChannels } = await response.json()

        // Map Discord channel names to authorized channels
        if (assignment?.channel_access) {
          const channelList = assignment.channel_access
            .map(id => {
              const discordChannel = discordChannels.find(c => c.id === id)
              return discordChannel ? {
                id,
                name: discordChannel.name,
                unread: false
              } : null
            })
            .filter(Boolean)

          console.log('Setting channels:', channelList)
          setChannels(channelList)
          
          if (!activeChannel && channelList.length > 0) {
            setActiveChannel(channelList[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch channels:', err)
      }
    }

    fetchChannels()
  }, [publicKey, connected])

  console.log('Rendering with:', { channels, activeChannel, hasWallet: !!publicKey, connected })

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundColor: '#17171B',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{ height: '73px', borderBottom: '1px solid #262626' }}>
        <Header />
      </div>

      {/* Content area */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row',
        height: 'calc(100vh - 73px)',
        width: '100%'
      }}>
        {/* Channels */}
        <div style={{ 
          backgroundColor: '#232328',
          width: '256px',
          minWidth: '256px',
          borderRight: '1px solid #262626'
        }}>
          <Sidebar
            channels={channels}
            activeChannel={activeChannel}
            onSelectChannel={setActiveChannel}
          />
        </div>

        {/* Messages */}
        <div style={{ 
          flex: 1,
          backgroundColor: '#17171B'
        }}>
          {activeChannel ? (
            <Chat channelId={activeChannel} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-gray-400">
                {!connected 
                  ? 'Please connect your wallet'
                  : 'Select a channel to start chatting'
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Providers>
      <UnreadProvider>
        <AppContent />
      </UnreadProvider>
    </Providers>
  )
}
