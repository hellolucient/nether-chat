import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    console.log('📨 Received Discord webhook:', rawBody)
    
    const data = JSON.parse(rawBody)
    
    // Extract all relevant fields including reply data
    const messageData = {
      id: data.id,
      channel_id: data.channel_id,
      sender_id: data.author.id,
      content: data.content,
      sent_at: new Date(data.timestamp).toISOString(),
      // Add reply data if this is a reply
      referenced_message_id: data.referenced_message?.id || null,
      referenced_message_author_id: data.referenced_message?.author?.id || null
    }

    console.log('💾 Storing message:', {
      ...messageData,
      content: messageData.content.substring(0, 50) // Truncate for logging
    })

    console.log('📨 Webhook details:', {
      messageType: data.type,
      isReply: !!data.referenced_message,
      replyTo: data.referenced_message?.author?.id,
      mentions: data.mentions?.map(m => m.id)
    })

    // Store in Supabase
    const { error } = await supabase
      .from('messages')
      .upsert(messageData, {
        onConflict: 'id'
      })

    if (error) {
      console.error('❌ Error storing message:', error)
      return NextResponse.json({ error: 'Failed to store message' }, { status: 500 })
    }

    console.log('✅ Message stored successfully')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Error handling Discord message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 