export interface Message {
  id: string
  content: string
  author: {
    username: string
    bot?: boolean
  }
  timestamp: string
}

export interface MessageListProps {
  messages: Message[]
  loading: boolean
  onReplyTo: (message: Message) => void
  channelId: string
  onRefresh: () => Promise<void>
}
