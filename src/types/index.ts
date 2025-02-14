export interface Channel {
  id: string
  name: string
  unread?: boolean
}

export interface Message {
  id: string
  content: string
  channel_id: string
  author_username: string
  sender_id: string
  sent_at: string
  referenced_message_id: string | null
  referenced_message_author_id: string | null
  referenced_message_content: string | null
  isFromBot?: boolean
  isBotMention?: boolean
  replyingToBot?: boolean
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

export interface MessageListProps {
  messages: Message[]
  loading: boolean
  onReplyTo: (message: Message) => void
  channelId: string
  onRefresh: () => Promise<void>
}

export interface ImageMessage {
  type: 'image'
  content: string
  url: string
  stickerId?: string
  reply?: {
    messageReference: { messageId: string }
    quotedContent: string
    author: { username: string }
  }
}

export interface TextMessage {
  type: 'text'
  content: string
  reply?: {
    messageReference: { messageId: string }
    quotedContent: string
    author: { username: string }
  }
}

export interface StickerMessage {
  type: 'sticker'
  stickerId: string
  url: string
  reply?: {
    messageReference: { messageId: string }
    quotedContent: string
    author: { username: string }
  }
}

export type MessageContent = string | ImageMessage | TextMessage | StickerMessage
