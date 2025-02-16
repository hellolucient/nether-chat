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
    const { channelId, content } = await request.json()
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json({ error: 'No wallet address provided' }, { status: 400 })
    }

    console.log('📨 API: Received message request:', { channelId, content, walletAddress })

    // Handle image messages
    if (content.type === 'image') {
      console.log('📸 API: Processing image message:', content)
      const success = await sendMessage(
        channelId,
        {
          type: 'image',
          content: content.content || '',
          url: content.url
        },
        walletAddress
      )

      if (!success) {
        throw new Error('Failed to send image message')
      }
    } else {
      // Handle text messages
      const success = await sendMessage(
        channelId,
        content.content || content,
        walletAddress
      )

      if (!success) {
        throw new Error('Failed to send message')
      }
    }

    console.log('✅ API: Message sent successfully')
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ API: Error sending message:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    )
  }
} 