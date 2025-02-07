export interface Channel {
  id: string
  name: string
  unread?: boolean
}

export interface Message {
  id: string
  content: string
  channelId: string
  author: {
    username: string
    id: string
  }
  timestamp: string
  embeds?: Array<{
    type: string
    url?: string
    image?: {
      url: string
    }
  }>
  sticker_items?: Array<{
    id: string
    name: string
  }>
  stickers?: Array<{
    url: string
    name: string
  }>
  attachments?: Array<{
    url: string
    content_type?: string
    filename: string
  }>
  created_at: string
}

export interface MessageListProps {
  messages: Message[]
  loading: boolean
  onReplyTo: (message: Message) => void
  channelId: string
  onRefresh: () => Promise<void>
}
