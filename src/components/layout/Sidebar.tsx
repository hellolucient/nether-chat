'use client'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useUnread } from '@/contexts/UnreadContext'
import { useState, useEffect } from 'react'

interface SidebarProps {
  channels: { id: string; name: string; unread?: boolean }[]
  activeChannel: string
  onSelectChannel: (channelId: string) => void
}

export function Sidebar({ channels, activeChannel, onSelectChannel }: SidebarProps) {
  const { checkUnreadChannels, unreadChannels, clearAllUnread } = useUnread()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  // Add logging to see what's happening
  console.log('Sidebar render:', { 
    channels, 
    activeChannel, 
    unreadChannels: Array.from(unreadChannels),
    hasUnread: channels.some(ch => unreadChannels.has(ch.id))
  })

  // Add more detailed logging
  useEffect(() => {
    console.log('Unread channels updated:', {
      unreadSet: Array.from(unreadChannels),
      channelIds: channels.map(ch => ch.id),
      matches: channels.filter(ch => unreadChannels.has(ch.id)).map(ch => ch.name)
    })
  }, [unreadChannels, channels])

  useEffect(() => {
    const loadInitialState = async () => {
      setLoading(true)
      try {
        await checkUnreadChannels()
      } catch (error) {
        console.error('Failed to check unread channels:', error)
      } finally {
        setLoading(false)
      }
    }

    loadInitialState()
  }, [checkUnreadChannels])

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      await fetch('/api/channels', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      })
      await checkUnreadChannels()
      window.location.reload()
    } catch (error) {
      console.error('Failed to refresh channels:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Add debug logging
  console.log('🔘 Sidebar buttons:', {
    hasUnread: unreadChannels.size > 0,
    unreadChannels: Array.from(unreadChannels),
    clearAllFn: !!clearAllUnread
  })

  return (
    <div className="w-64 bg-[#1E1E24] border-r border-[#262626] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#262626] flex justify-between items-center">
        <h2 className="font-semibold text-purple-300">Channels</h2>
        <div className="flex gap-2">
          {unreadChannels.size > 0 && (
            <button
              onClick={() => {
                console.log('🧹 Clear All clicked')
                clearAllUnread()
              }}
              className="px-3 py-1 rounded bg-[#363640] hover:bg-[#464650] text-purple-400 text-sm"
              title="Clear all notifications"
            >
              Clear All
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-full hover:bg-[#363640] text-purple-400"
            title="Refresh channels"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
            ) : (
              <ArrowPathIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Channel List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel.id)}
              className={`w-full px-2 py-1.5 rounded text-left hover:bg-[#363640] ${
                activeChannel === channel.id ? 'bg-[#363640] text-purple-300' : 'text-gray-300'
              }`}
            >
              # {channel.name}
              {unreadChannels.has(channel.id) && (
                <span className="ml-2 w-2 h-2 rounded-full bg-purple-500 inline-block" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
