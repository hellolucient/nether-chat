/* eslint-disable */
'use client'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Chat } from '@/components/chat/Chat'
import { useState } from 'react'
import { UnreadProvider } from '@/contexts/UnreadContext'
import { Providers } from './providers'

export default function Home() {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)

  return (
    <Providers>
      <UnreadProvider>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100vh',
          backgroundColor: '#17171B',
          color: 'white'
        }}>
          {/* Header */}
          <div style={{ 
            height: '73px',
            borderBottom: '1px solid #262626'
          }}>
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
              backgroundColor: '#1E1E24',
              width: '256px',
              minWidth: '256px',
              borderRight: '1px solid #262626'
            }}>
              <Sidebar onSelectChannel={setSelectedChannel} />
            </div>

            {/* Messages */}
            <div style={{ flex: 1 }}>
              {selectedChannel ? (
                <Chat channelId={selectedChannel} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-gray-400">Select a channel to start chatting</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </UnreadProvider>
    </Providers>
  )
}
