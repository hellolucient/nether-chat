export interface Message {
  id: string
  content: string
  channelId: string
  author: {
    id: string
    username: string
    displayName?: string
  }
  timestamp: string
  referenced_message_id?: string
  referenced_message_content?: string
  referenced_message_author_id?: string
  attachments?: Array<{
    url: string
    filename: string
  }>
  embeds?: Array<{
    type: string
    url?: string
    image?: {
      url: string
    }
  }>
  stickers?: Array<{
    id: string
    name: string
    url: string
  }>
  sticker_items?: Array<{
    id: string
    name: string
  }>
}

export interface Channel {
  id: string
  name: string
  unread?: boolean
} 