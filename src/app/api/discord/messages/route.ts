import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { channelId, content, messageId, authorId, timestamp } = await request.json()

    console.log('Storing message:', { channelId, messageId, authorId })

    // Store the message in Supabase
    const { error } = await supabase
      .from('messages')
      .upsert({
        id: messageId,
        channel_id: channelId,
        sender_id: authorId,
        content: content,
        sent_at: timestamp
      }, {
        onConflict: 'id'
      })

    if (error) {
      console.error('Error storing message:', error)
      return NextResponse.json({ error: 'Failed to store message' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling Discord message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 