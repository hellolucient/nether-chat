export interface Message {
  id: string
  author: {
    username: string
  }
  content: string
  timestamp: string
  attachments?: {
    url: string
    content_type?: string
  }[]
  embeds?: {
    type: string
    url?: string
    thumbnail?: {
      url: string
    }
    image?: {
      url: string
    }
  }[]
  stickers?: {
    id: string
    name: string
    url: string
  }[]
  sticker_items?: {
    id: string
    name?: string
    format_type: number
  }[]
}

export interface MessageListProps {
  messages: Message[]
  loading: boolean
  onReplyTo: (message: Message) => void
  channelId: string
  onRefresh: () => Promise<void>
}
