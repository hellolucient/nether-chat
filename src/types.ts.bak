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
  isFromBot?: boolean          // Message from bot
  isBotMention?: boolean       // @mentions bot
  replyingToBot?: boolean      // Replying to bot message
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