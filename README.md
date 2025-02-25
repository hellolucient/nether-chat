# Nether Chat

A web application that enables users to send messages to Discord channels through assigned bots, powered by Solana wallet authentication.

## Features

Current:
- 🤖 Bot-to-Discord Channel Messaging
- 👛 Solana Wallet Authentication & Bot Assignment (Mainnet)
- 📱 Discord-like Channel Interface
- 🔒 Secure Bot-User Mapping
- 📨 Real-time Discord Message Reception
- 💬 Channel History & Context
- 📝 @mention Support
- 🖼️ Image & GIF Support
- 🎨 Sticker Support
- 💫 Rich Message Formatting
- 🔔 Unread Message Notifications
- 👥 User Display Names
- 🔄 Message History Sync
- 🎭 Admin Panel for Bot Management

## Technical Stack

- **Frontend**: Next.js 14, TailwindCSS
- **Authentication**: Solana Wallet (Phantom, Backpack, Solflare)
- **Blockchain**: Solana (Mainnet)
- **Database**: Supabase
- **Storage**: Supabase Storage
- **Integration**: Discord Bot API
- **Media**: Tenor GIF API

## Database Schema

### Discord Bots
```sql
create table discord_bots (
  id uuid default gen_random_uuid() primary key,
  discord_id text unique not null,     -- Discord's internal bot ID
  bot_name text not null,              -- Display name of the bot
  bot_token text not null,             -- Discord bot token
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Bot Assignments
```sql
create table bot_assignments (
  id uuid default gen_random_uuid() primary key,
  wallet_address text unique not null,     -- Solana wallet public key
  bot_id uuid references discord_bots(id),
  channel_access text[],                   -- Array of allowed channel IDs
  is_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Messages
```sql
create table messages (
  id text primary key,
  channel_id text not null,
  sender_id text not null,
  content text not null,
  sent_at timestamp with time zone default timezone('utc'::text, now()) not null,
  author_username text,
  author_display_name text,
  referenced_message_id text,
  referenced_message_author_id text,
  referenced_message_content text,
  attachments jsonb[],
  embeds jsonb[],
  stickers jsonb[]
);
```

### Last Viewed
```sql
create table last_viewed (
  id uuid default gen_random_uuid() primary key,
  channel_id text not null,
  wallet_address text not null,
  last_viewed timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(channel_id, wallet_address)
);
```

## Message Flow

### Real-time Messages
```
Discord → Listener Bot → Supabase → UI
```
- Messages from our bots
- Mentions of our bots
- Replies to our bot messages
- Stored immediately for unread notifications

### Channel History
```
Discord API → UI → Supabase
```
- Fetched when channel is opened
- Last 100 messages per channel
- Includes all message types
- Stored for quick access

## Environment Variables
```env
# Discord Configuration
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_SERVER_ID=
DISCORD_LISTENER_BOT_TOKEN=

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Admin Configuration
NEXT_PUBLIC_ADMIN_WALLET_ADDRESS=

# Solana Configuration
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_HELIUS_RPC_URL=

# Tenor Configuration
NEXT_PUBLIC_TENOR_API_KEY=

# Site Configuration
NEXT_PUBLIC_SITE_URL=
```

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── messages/
│   │   ├── channels/
│   │   ├── discord/
│   │   ├── admin/
│   │   └── stickers/
│   ├── chat/
│   └── admin/
├── components/
│   ├── chat/
│   ├── admin/
│   ├── layout/
│   └── web3/
├── contexts/
│   └── UnreadContext.tsx
├── lib/
│   ├── discord.ts
│   ├── supabase.ts
│   ├── storage.ts
│   └── logger.ts
└── types/
    └── index.ts
```

## Setup Requirements

1. Solana Wallet (e.g., Phantom)
2. Discord Bot Token
3. Supabase Account
4. Node.js & npm

## Getting Started

1. Clone the repository
2. Install dependencies
3. Configure environment variables
4. Run the development server

```bash
npm install
npm install @solana/wallet-adapter-backpack
npm run dev
```

## Security Considerations

- Each Solana wallet address can only be linked to one bot
- Bot tokens are securely stored and never exposed to the frontend
- Messages are validated before being sent to Discord

## Bot Setup in Discord

1. Go to Discord Developer Portal
2. Create New Application
3. Go to "Bot" section and click "Add Bot"
4. Enable these Privileged Gateway Intents:
   - Message Content Intent
   - Server Members Intent
   - Presence Intent

5. Under OAuth2 -> URL Generator, select:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions:
     - Read Messages/View Channels
     - Send Messages
     - Send Messages in Threads
     - Embed Links
     - Attach Files
     - Read Message History
     - Use External Emojis
     - Use External Stickers
     - Add Reactions

6. Use the generated URL to add bot to your server
