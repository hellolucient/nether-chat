import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useUnread } from '@/contexts/UnreadContext'
import { Channel } from '@/types'

interface ChannelsProps {
  channels: Channel[]
  activeChannel: string | null
  onSelectChannel: (channelId: string) => void
}

export function Channels({ channels, activeChannel, onSelectChannel }: ChannelsProps) {
  const { checkUnreadChannels } = useUnread()

  const handleRefresh = async () => {
    try {
      await checkUnreadChannels()
    } catch (error) {
      console.error('Failed to refresh channels:', error)
    }
  }

  return (
    <div className="w-60 bg-[#1E1E24] border-r border-[#262626]">
      <div className="p-4 border-b border-[#262626] flex justify-between items-center">
        <h2 className="font-semibold text-purple-300">Channels</h2>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-full hover:bg-[#262626] text-purple-400"
          title="Refresh channels"
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>
      </div>
      
      <div className="p-2">
        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel.id)}
            className={`w-full px-2 py-1.5 rounded text-left hover:bg-[#262626] ${
              activeChannel === channel.id ? 'bg-[#262626] text-purple-300' : 'text-gray-300'
            }`}
          >
            # {channel.name}
            {channel.unread && (
              <span className="ml-2 w-2 h-2 rounded-full bg-purple-500 inline-block" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
} 