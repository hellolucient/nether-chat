export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      discord_bots: {
        Row: {
          id: string
          discord_id: string
          bot_name: string
          bot_token: string
          created_at: string
        }
        Insert: {
          id?: string
          discord_id: string
          bot_name: string
          bot_token: string
          created_at?: string
        }
        Update: {
          id?: string
          discord_id?: string
          bot_name?: string
          bot_token?: string
          created_at?: string
        }
      }
      bot_assignments: {
        Row: {
          id: string
          wallet_address: string
          bot_id: string
          channel_access: string[]
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id?: string
          wallet_address: string
          bot_id: string
          channel_access?: string[]
          is_admin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          wallet_address?: string
          bot_id?: string
          channel_access?: string[]
          is_admin?: boolean
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          channel_id: string
          sender_id: string
          content: string
          sent_at: string
          author_username: string
          author_display_name: string
          referenced_message_id: string | null
          referenced_message_author_id: string | null
          referenced_message_content: string | null
          attachments: Json[]
          embeds: Json[]
          stickers: Json[]
        }
        Insert: {
          id: string
          channel_id: string
          sender_id: string
          content: string
          sent_at?: string
          author_username: string
          author_display_name: string
          referenced_message_id?: string | null
          referenced_message_author_id?: string | null
          referenced_message_content?: string | null
          attachments?: Json[]
          embeds?: Json[]
          stickers?: Json[]
        }
        Update: {
          id?: string
          channel_id?: string
          sender_id?: string
          content?: string
          sent_at?: string
          author_username?: string
          author_display_name?: string
          referenced_message_id?: string | null
          referenced_message_author_id?: string | null
          referenced_message_content?: string | null
          attachments?: Json[]
          embeds?: Json[]
          stickers?: Json[]
        }
      }
      last_viewed: {
        Row: {
          id: string
          channel_id: string
          wallet_address: string
          last_viewed: string
        }
        Insert: {
          id?: string
          channel_id: string
          wallet_address: string
          last_viewed?: string
        }
        Update: {
          id?: string
          channel_id?: string
          wallet_address?: string
          last_viewed?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
