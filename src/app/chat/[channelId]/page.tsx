'use client'

import { Chat } from '@/components/chat/Chat'

export default function ChatPage({ params }: { params: { channelId: string } }) {
  return <Chat channelId={params.channelId} />
} 