export interface Channel {
  id: string
  name: string
  unread?: boolean
}

export interface Message {
  id: string
  content: string
  channel_id: string
  sender_id: string
  author_username: string
  author_display_name?: string
  sent_at: string
  referenced_message_id: string | null
  referenced_message_author_id: string | null
  referenced_message_content: string | null
  referenced_message_author_display_name?: string
  referenced_message_author_username?: string
  isFromBot: boolean
  replyingToBot: boolean
  stickers: Array<{
    url: string
    name: string
  }>
  attachments?: Array<{
    url: string
    content_type?: string
    filename?: string
    size?: number
  }>
  embeds: Array<{
    type: string
    url?: string
    image?: { url: string }
  }>
}

export interface MessageListProps {
  messages: Message[]
  loading: boolean
  onReplyTo: (message: Message) => void
  channelId: string
  onRefresh: () => Promise<void>
}

// Add MessageReply interface
export interface MessageReply {
  messageReference: { messageId: string }
  quotedContent: string
  author: { username: string }
}

export interface BaseMessageContent {
  type: 'image' | 'text' | 'sticker'
  content: string
  reply?: MessageReply
}

export interface ImageMessageContent {
  type: 'image'
  content: string
  url: string
}

export interface TextMessageContent {
  type: 'text'
  content: string
}

export type StickerMessageContent = {
  type: 'sticker'
  stickerId: string
  url: string
} & BaseMessageContent

export type MessageContent = ImageMessageContent | TextMessageContent | StickerMessageContent

export interface AppMessage {
  id: string
  content: MessageContent
  channel_id: string
  // ... rest of the message fields ...
}
