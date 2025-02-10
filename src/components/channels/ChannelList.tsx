import React, { useState } from 'react'
import { useUnread } from '../../contexts/UnreadContext'

// Add interface directly
interface Channel {
  id: string
  name: string
  unread?: boolean
}

function ChannelItem({ channel, selected }: { channel: Channel; selected: boolean }) {
  const { unreadChannels } = useUnread()
  const isUnread = unreadChannels.includes(channel.id)

  return (
    <div className={`flex items-center justify-between px-2 py-1 rounded ${
      selected ? 'bg-[#262626]' : 'hover:bg-[#262626]'
    }`}>
      <span className="text-gray-300">
        # {channel.name}
      </span>
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-purple-500" />
      )}
    </div>
  )
}

export default ChannelItem 