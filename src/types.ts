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
} 