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

Planned:
- 🎭 Unique Bot Identity Per Wallet
  - Each wallet gets assigned its own Discord bot
  - Custom bot usernames and avatars
  - Messages appear from unique bot identities
  - Track message history per wallet/bot
- 👤 User Profiles
  - Customizable bot appearances
  - Wallet-to-bot relationship management
  - Message attribution and tracking

## Technical Stack

- **Frontend**: Next.js, TailwindCSS
- **Authentication**: Solana Wallet (Phantom)
- **Blockchain**: Solana (Devnet/Mainnet)
- **Database**: Supabase
- **Integration**: Discord Bot API

## Database Schema

### Bot Assignments
```sql
create table bot_assignments (
  id uuid default gen_random_uuid() primary key,
  wallet_address text unique not null,     -- Solana wallet public key
  bot_id text unique not null,
  bot_token text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Channel Mappings
```sql
create table channel_mappings (
  id uuid default gen_random_uuid() primary key,
  discord_channel_id text unique not null,
  channel_name text not null,
  server_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Messages
```sql
create table messages (
  id uuid default gen_random_uuid() primary key,
  channel_id text not null,
  sender_id text not null,
  content text not null,
  sent_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

## Setup Requirements

1. Solana Wallet (e.g., Phantom)
2. Discord Bot Token
3. Supabase Account
4. Node.js & npm

## Environment Variables

```env
# Discord Configuration
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Solana Configuration
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

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

## Architecture

### Current
- Supabase for data storage
- Single bot for message delivery
- Basic channel synchronization

### Planned Enhancement
- **Bot Assignment System**
  - One-to-one wallet to bot mapping
  - Custom bot profile management
  - Secure bot token storage
  - Message attribution to specific wallets

### Database Schema (Planned)

```sql
-- Enhanced bot_assignments table
create table bot_assignments (
  id uuid default gen_random_uuid() primary key,
  wallet_address text unique not null,     -- Solana wallet address
  bot_id text unique not null,             -- Discord bot ID
  bot_token text not null,                 -- Discord bot token
  bot_username text not null,              -- Custom username for the bot
  bot_avatar_url text,                     -- Custom profile picture URL
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Message Flow (Planned)
1. User connects Solana wallet
2. System assigns/creates unique bot
3. Messages sent through user's assigned bot
4. Full message history tracked with wallet attribution

## Security Considerations

- Each Solana wallet address can only be linked to one bot
- Bot tokens are securely stored and never exposed to the frontend
- Messages are validated before being sent to Discord

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

1. Go to Discord Developer Portal
2. Click "New Application"
3. Name it something like "Nether Chat Bot 2"
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the token (you'll need this for admin panel)
7. Under "Privileged Gateway Intents" enable:
   - Message Content Intent
   - Server Members Intent
   - Presence Intent

These intents are required because:
- Message Content: Needed to read message content
- Server Members: Required for @mentions and user search
- Presence: Helps with user status and activity

In OAuth2 -> URL Generator:
1. Select Scopes:
   - bot
   - applications.commands

2. Select Bot Permissions:
   - Read Messages/View Channels
   - Send Messages
   - Send Messages in Threads
   - Embed Links
   - Attach Files
   - Read Message History
   - Use External Emojis
   - Use External Stickers
   - Add Reactions

1. Copy the generated OAuth2 URL
2. Open in browser
3. Select your server
4. Authorize

1. Go to Nether Chat Admin Panel
2. Click "Bot Assignment"
3. Enter:
   - Target Wallet (the user's wallet address)
   - Bot Token (the one you copied in step 1)
4. Click "Assign Bot"

## Project Structure (as of March 2024)

src/
├── app/
│   ├── api/
│   │   ├── messages/
│   │   │   ├── [channelId]/route.ts  # Message fetching endpoint
│   │   │   └── route.ts
│   │   ├── channels/
│   │   │   ├── sync/route.ts
│   │   │   └── route.ts
│   │   └── discord/
│   │       └── messages/route.ts
│   └── chat/
│       └── [channelId]/page.tsx
├── components/
│   ├── chat/
│   │   ├── Chat.tsx  # Main chat component
│   │   ├── MessageList.tsx
│   │   └── ChatInput.tsx
│   └── messages/
├── lib/
│   ├── discord.ts  # Discord client functions
│   └── supabase.ts  # Supabase functions

## Message Flow

### Bot-Related Messages
```
Discord → Listener Bot → Supabase messages table → UI
```
- Messages from our bots
- Mentions of our bots
- Replies to our bot messages
- Stored indefinitely for complete bot interaction history
- Stored immediately for unread notifications

The listener bot (initialized in `src/lib/discord.ts`):
1. Watches for all messages
2. Identifies bot-related ones:
   - Messages FROM our bots
   - Messages MENTIONING our bots
   - Messages REPLYING to our bots
3. Stores them in Supabase immediately
4. Which enables unread notifications

Key parts of the listener:
```typescript
client.on('messageCreate', async (message) => {
  // Check if message is from/mentions/replies to our bot
  const isFromBot = bots.some(bot => bot.discord_id === message.author.id)
  const mentionsBot = message.mentions.users.some(user => 
    bots.some(bot => bot.discord_id === user.id)
  )
  const repliedToOurBot = message.reference && 
    bots.some(bot => bot.discord_id === message.reference?.messageId)

  // Only process if it's bot-related
  if (!isFromBot && !mentionsBot && !repliedToOurBot) {
    return
  }

  // Store in Supabase for unread notifications
  await supabase.from('messages').upsert(messageData)
})
```

2. Regular Messages:
```
Discord API → UI → Supabase messages table (when viewed)
```
- All other channel messages
- Fetched directly from Discord when channel is viewed
- Stored in Supabase (last 300 messages per channel)
- Displayed in UI
- No unread notifications for these

### Message Flow Details
1. User opens channel → Chat.tsx component loads
2. Chat.tsx calls /api/messages/[channelId] endpoint
3. Endpoint fetches fresh messages from Discord
4. Messages displayed in UI (newest at bottom)
5. Messages stored in Supabase for history
