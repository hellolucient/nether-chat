// Add Channel type export
interface Channel {
  id: string
  name: string
  unread?: boolean
}

// Message content type that Chat.tsx is looking for
interface MessageContent {
  type: 'text' | 'gif' | 'image' | 'sticker'
  content?: string
  url?: string
  stickerId?: string
}

export interface Message {
  id: string
  content: string
  channel_id: string
  sender_id: string
  author_username: string
  sent_at: string
  referenced_message_id: string | null
  referenced_message_author_id: string | null
  referenced_message_content: string | null
  isFromBot: boolean
  isBotMention: boolean
  replyingToBot: boolean
  stickers: Array<{
    url: string
    name: string
  }>
  attachments: Array<{
    url: string
    content_type?: string
    filename: string
  }>
  embeds: Array<{
    type: string
    url?: string
    image?: { url: string }
  }>
  sticker_items: Array<{
    id: string
    name: string
  }>
}

export type { Message, MessageContent, Channel } 