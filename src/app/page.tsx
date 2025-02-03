'use client'

import { ClientOnly } from '@/components/web3/ClientOnly'
import { WalletConnect } from '@/components/web3/WalletConnect'
import { ChannelList } from '@/components/chat/ChannelList'
import { Chat } from '@/components/chat/Chat'
import { AdminPanel } from '@/components/admin/AdminPanel'
import { useState, useEffect } from 'react'
import { AdminLink } from '@/components/web3/AdminLink'
import { UnreadProvider } from '@/contexts/UnreadContext'

export default function Home() {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)

  // Add logging to track channel selection
  const handleChannelSelect = (channelId: string) => {
    console.log('🎯 Page: Channel selected:', channelId)
    setSelectedChannel(channelId)
  }

  // Add effect to log when channel changes
  useEffect(() => {
    console.log('📢 Page: Selected channel changed to:', selectedChannel)
  }, [selectedChannel])

  return (
    <UnreadProvider>
      <main className="h-screen flex flex-col bg-[#17171B] text-white">
        {/* Fixed Header */}
        <header className="h-[73px] flex items-center justify-between p-4 border-b border-[#262626] bg-[#17171B] fixed top-0 left-0 right-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Nether Chat</h1>
            <AdminLink />
          </div>
          <ClientOnly>
            <WalletConnect />
          </ClientOnly>
        </header>

        {/* Content Area */}
        <div className="flex flex-1 pt-[73px]">
          {/* Channel Sidebar */}
          <aside className="w-64 fixed left-0 top-[73px] bottom-0 border-r border-[#262626] bg-[#1E1E24]">
            <div className="p-4 border-b border-[#262626] bg-[#1E1E24]">
              <h2 className="font-semibold">Channels</h2>
            </div>
            <div className="overflow-y-auto h-[calc(100vh-73px-57px)]">
              <div className="p-4">
                <ChannelList onSelectChannel={handleChannelSelect} />
              </div>
            </div>
          </aside>

          {/* Chat Area - Remove right margin since admin panel is gone */}
          <div className="flex-1 ml-64">
            {selectedChannel ? (
              <Chat channelId={selectedChannel} />
            ) : (
              <div className="flex-1 p-4">
                <div className="text-center text-gray-400">
                  Select a channel to start chatting
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </UnreadProvider>
  )
}
