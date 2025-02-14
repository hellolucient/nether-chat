// Message content type that Chat.tsx is looking for
interface MessageContent {
  type: 'text' | 'gif' | 'image' | 'sticker'
  content?: string
  url?: string
  stickerId?: string
}

interface Message {
  id: string
  channel_id: string
  sender_id: string
  author_username: string
  content: string
  sent_at: string
  referenced_message_id: string | null
  referenced_message_author_id: string | null
  referenced_message_content: string | null
  // Add bot-related flags
  isFromBot: boolean
  isBotMention: boolean
  replyingToBot: boolean
  // Add author field that ChatInput is looking for
  author: {
    id: string
    username: string
  }
  // Discord message fields
  attachments: any[] | null
  embeds: any[] | null
  stickers: any[] | null
  sticker_items: any[] | null
}

export type { Message, MessageContent } 