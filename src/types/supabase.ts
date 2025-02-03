export type Database = {
  public: {
    Tables: {
      channel_mappings: {
        Row: {
          id: string
          created_at: string
          channel_id: string
          bot_assignment_id: string
        }
        Insert: {
          channel_id: string
          bot_assignment_id: string
        }
      }
      bot_assignments: {
        Row: {
          id: string
          wallet_address: string
          bot_id: string
          bot_token: string
          created_at: string
        }
        Insert: {
          wallet_address: string
          bot_id: string
          bot_token: string
        }
      }
      messages: {
        Row: {
          id: string
          channel_id: string
          sender_id: string
          content: string
          sent_at: string
        }
        Insert: {
          id: string
          channel_id: string
          sender_id: string
          content: string
          sent_at: string
        }
      }
      last_viewed: {
        Row: {
          id: number
          channel_id: string
          last_viewed: string
          unread: boolean
          last_updated: string
          created_at?: string
        }
        Insert: {
          channel_id: string
          last_viewed: string
          unread: boolean
          last_updated: string
          created_at?: string
        }
        Update: {
          channel_id?: string
          last_viewed?: string
          unread?: boolean
          last_updated?: string
          created_at?: string
        }
      }
    }
  }
} 