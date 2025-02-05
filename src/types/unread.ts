export interface UnreadContextType {
  markChannelAsRead: (channelId: string) => void
  markChannelAsUnread: (channelId: string) => void
} 