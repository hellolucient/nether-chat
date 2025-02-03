/* eslint-disable */
import { NextResponse } from 'next/server'
import { sendMessage, checkDiscordConnection } from '@/lib/discord'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    console.log('📨 API: Message send request received')
    
    // Ensure Discord connection
    const isConnected = await checkDiscordConnection()
    if (!isConnected) {
      console.error('❌ API: Discord connection not available')
      return NextResponse.json(
        { error: 'Discord connection not available' },
        { status: 503 }
      )
    }

    // Parse request body
    const body = await request.json()
    console.log('📦 API: Message request body:', {
      channelId: body.channelId,
      contentType: typeof body.content,
      hasReply: !!body.content?.reply
    })

    if (!body.channelId || !body.content) {
      console.error('❌ API: Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let success;

    // Handle different message types
    if (typeof body.content === 'object' && body.content.type === 'gif') {
      console.log('📱 API: Processing GIF message')
      const messageText = body.content.reply?.quotedContent || ''
      success = await sendMessage(body.channelId, messageText, {
        embeds: [{
          image: {
            url: body.content.url
          }
        }],
        messageReference: body.content.reply?.messageReference
      })
    } else if (typeof body.content === 'object' && body.content.reply) {
      console.log('💬 API: Sending reply message')
      success = await sendMessage(
        body.channelId,
        body.content.content,
        body.content.reply
      )
    } else {
      console.log('📝 API: Sending regular message')
      success = await sendMessage(
        body.channelId,
        typeof body.content === 'string' ? body.content : body.content.content
      )
    }

    if (!success) {
      console.error('❌ API: Failed to send message to Discord')
      return NextResponse.json(
        { error: 'Failed to send message to Discord' },
        { status: 500 }
      )
    }

    console.log('✅ API: Message sent successfully')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ API: Error in message send route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
} 