import { createContext, useContext, useState, useCallback } from 'react'

interface UnreadContextType {
  unreadChannels: Set<string>
  markChannelAsUnread: (channelId: string) => void
  markChannelAsRead: (channelId: string) => void
}

const UnreadContext = createContext<UnreadContextType | null>(null)

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set())

  const markChannelAsUnread = useCallback((channelId: string) => {
    console.log('Marking channel as unread:', channelId)
    setUnreadChannels(prev => {
      const next = new Set(prev)
      next.add(channelId)
      return next
    })
  }, [])

  const markChannelAsRead = useCallback((channelId: string) => {
    console.log('Marking channel as read:', channelId)
    setUnreadChannels(prev => {
      const next = new Set(prev)
      next.delete(channelId)
      return next
    })
  }, [])

  return (
    <UnreadContext.Provider value={{ unreadChannels, markChannelAsUnread, markChannelAsRead }}>
      {children}
    </UnreadContext.Provider>
  )
}

export function useUnread() {
  const context = useContext(UnreadContext)
  if (!context) throw new Error('useUnread must be used within UnreadProvider')
  return context
} 