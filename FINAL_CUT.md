# Debug Log

## Initial Build Errors
```bash
npm run build

> nether-chat@0.1.0 build
> next build

   ▲ Next.js 14.1.0
   - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully

./src/app/api/messages/[channelId]/sync/route.ts
52:7  Warning: 'messages' is never reassigned. Use 'const' instead.  prefer-const

./src/components/chat/ChannelList.tsx
126:6  Warning: React Hook useEffect has a missing dependency: 'fetchChannels'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./src/components/chat/Chat.tsx
59:24  Warning: React Hook useCallback received a function whose dependencies are unknown. Pass an inline function instead.  react-hooks/exhaustive-deps
128:6  Warning: React Hook useEffect has missing dependencies: 'fetchMessages' and 'markChannelAsRead'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps

./src/components/chat/MessageList.tsx
289:6  Warning: React Hook useEffect has a missing dependency: 'referencedAuthors'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

Failed to compile.

./src/components/chat/Channels.tsx:3:10
Type error: Module '"@/types"' has no exported member 'Channel'.
```

## Fix Attempt 1: Add Channel Type
Added Channel type to src/types.ts:
```typescript
interface Channel {
  id: string
  name: string
  unread?: boolean
}
```
Status: ✅ Fixed Channel type error

## Error After Fix 1: Reply Error
```
TypeError: Cannot read properties of undefined (reading 'username')
Source: src/components/chat/ChatInput.tsx (260:62) @ username
```

## Fix Attempt 2: Update ChatInput.tsx
Added null checks for reply author:
```typescript
<span className="text-purple-300">
  {replyTo?.author?.username || replyTo?.author_username || 'Unknown User'}
</span>
```
Status: ✅ Fixed reply error

## Fix Attempt 3: Update Chat.tsx
Updated message sending logic and API endpoint path:
```typescript
const handleSendMessage = async (content: string | MessageContent) => {
  // ... updated code ...
}
```
Status: ✅ Fixed message sending

## Error After Fix 3: Infinite Re-render
Error: 
```
GET http://localhost:3001/api/messages/[channelId]?wallet=[wallet] failing repeatedly
Component flickering with continuous loading state changes
```

## Fix Attempt 4: Analyze Chat.tsx for Re-render Issues
Need to check:
1. useEffect dependencies
2. State update cycles
3. Loading state management

Status: In Progress - Examining Chat.tsx for the cause of infinite re-renders

Would you like me to help diagnose and fix the flickering issue? 

## Fix Attempt 5: Fix Chat.tsx Re-render Issues
Problem identified:
- fetchMessages was being recreated on every render
- This caused the useEffect to re-run continuously
- Loading state was toggling rapidly due to the recreation

Changes made:
```typescript
// Wrapped fetchMessages in useCallback with proper dependencies
const fetchMessages = useCallback(async () => {
  // ... function body ...
}, [channelId, publicKey, syncMessages])
```

Status: Pending confirmation - This should stop the infinite re-renders and flickering

## Error After Fix 5: Discord Connection Error
Error:
```
❌ API: Discord connection not available
```

## Fix Attempt 6: Update Discord Connection Management
Problem: Discord client connection not being maintained between requests

Changes made:
```typescript
// Added connection state tracking and proper initialization
let isConnected = false

export async function checkDiscordConnection() {
  try {
    if (!client || !isConnected) {
      // Initialize new client
      // Wait for ready event
      isConnected = true
    }
    return true
  } catch (error) {
    isConnected = false
    return false
  }
}
```

Status: Pending confirmation - This should maintain the Discord connection and allow message sending

## Error After Fix 6: Message Sending Failed
Error:
```
❌ API: Failed to send message to Discord
```

## Fix Attempt 7: Update Message Sending Logic
Problem: Messages not being sent with correct bot token for each user

Changes made:
1. Updated message sending route to fetch user's bot token
2. Modified sendMessage function to use per-request Discord clients
3. Added proper cleanup of Discord clients after message send

Status: Pending confirmation - This should allow messages to be sent using the correct bot for each user

## Error After Fix 7: Discord Session Limit
Error:
```
❌ Discord: Error sending message: Error: Not enough sessions remaining to spawn 1 shards
```

## Fix Attempt 8: Implement Bot Client Caching
Problem: Creating new Discord client for each message was hitting Discord's session limit

Changes made:
1. Added bot client caching system
2. Reuse existing clients for same bot token
3. Added cleanup for inactive clients
4. Modified sendMessage to use cached clients

Status: Pending confirmation - This should prevent session limit errors and allow message sending

## Error After Fix 8: Sync Route Session Limit
Error:
```
❌ Sync failed: Error: Not enough sessions remaining to spawn 1 shards
```

## Fix Attempt 9: Update Sync Route to Use Cached Clients
Problem: Sync route was still creating new Discord clients instead of using cached ones

Changes made:
1. Updated sync route to use getBotClient function
2. Made getBotClient available for import
3. Unified client management across all Discord operations

Status: Pending confirmation - This should prevent session limit errors in all routes

## Error After Fix 9: TypeScript Errors
Error:
```
Property 'bot_token' does not exist on type '{ bot_token: any; }[]'
```

## Fix Attempt 10: Fix TypeScript Types
Problem: Incorrect type inference for Supabase query result

Changes made:
1. Added BotAssignment interface
2. Added proper type assertion for Supabase query
3. Fixed bot token access with correct types

Status: Pending confirmation - This should resolve TypeScript errors while maintaining functionality

## Error After Fix 10: Discord Rate Limit
Error:
```
Discord: Error sending message: Error: Not enough sessions remaining to spawn 1 shards
```

## Fix Attempt 11: Improve Client Caching with Rate Limiting
Problem: Still hitting Discord's session limit despite caching

Changes made:
1. Added exponential backoff for client creation
2. Added retry logic with delays
3. Better handling of failed client creations
4. More aggressive client reuse

Status: Pending confirmation - This should handle Discord's rate limits more gracefully

# FIXES

1. Channel Access Error for Admin Wallet
```
Issue: Admin wallet can't access certain channels
Location: src/app/api/channels/route.ts
Current behavior:
- Admin wallet should have access to all channels
- Some channels not showing up in list
```
- Need to verify channel permissions
- Check bot token permissions
- Add admin override for channel access

2. Message Author Display Name Not Showing on Initial Load
```
Issue: Display names missing until refresh
Location: src/components/chat/MessageList.tsx
Current behavior:
- Username shows instead of display name
- Fixed after manual refresh
```
- Need to update message sync to include display names
- May need to update message sync for referenced messages

3. Bot Message Flags Inconsistency
```
Issue: Message styling lost due to flag name mismatch
Location: src/app/api/discord/messages/route.ts
```

4. Message Send Failed for Some Users
```
Error: 
- 500 (Internal Server Error) when POSTing to /api/messages
- "Message send failed: Failed to send message to Discord"
Current behavior:
- Works for some users (admin)
- Fails for other users
- Same URL/environment
```
- Need to investigate message sending flow
- Check bot token lookup and validation
- Verify bot assignments for non-admin users
- Add better error logging in /api/messages route
- Check Discord client initialization per user

5. Image Upload Issues
```
Error:
- Images upload to storage but don't appear in Discord
- "Missing required fields" error when no text
Current behavior:
- Text portion of message sends successfully
- Image URL not being included in Discord message
- Requires text input even for image-only messages
```
- Fix image URL inclusion in message content
- Remove text requirement for image uploads
- Match behavior with GIFs/emojis
- Add better error handling for image uploads