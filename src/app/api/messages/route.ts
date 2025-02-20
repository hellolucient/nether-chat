/* eslint-disable */
import { NextResponse } from 'next/server'
import { sendMessage } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { PostgrestSingleResponse } from '@supabase/supabase-js'

// Add interface at the top
interface BotAssignment {
  bot_id: string
  discord_bots: {
    bot_token: string
    bot_name: string
  }
}

export async function POST(request: Request) {
  try {
    const { channelId, content, reply } = await request.json()
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json({ error: 'No wallet address provided' }, { status: 400 })
    }

    console.log('📨 Sending message:', { channelId, content, reply })

    const success = await sendMessage(
      channelId,
      {
        content,
        ...(reply && {
          reply: {
            messageId: reply.messageId,
            authorId: reply.authorId,
            content: reply.content
          }
        })
      },
      walletAddress
    )

    if (!success) {
      throw new Error('Failed to send message')
    }

    // Wait briefly for Discord to process
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to send message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
} 