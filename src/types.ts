export interface Message {
  id: string
  content: string
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
} 