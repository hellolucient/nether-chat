'use client'

import { ChannelList } from '@/components/chat/ChannelList'

interface SidebarProps {
  onSelectChannel: (channelId: string) => void
}

export function Sidebar({ onSelectChannel }: SidebarProps) {
  console.log('🔵 Sidebar component rendering')
  return (
    <aside className="h-[calc(100vh-73px)] border-r border-[#262626] bg-[#1E1E24]">
      <div className="p-4 border-b border-[#262626]">
        <h2 className="font-semibold">Channels</h2>
      </div>
      <div className="overflow-y-auto h-[calc(100%-57px)]">
        <div className="p-4">
          <ChannelList onSelectChannel={onSelectChannel} />
        </div>
      </div>
    </aside>
  )
}
