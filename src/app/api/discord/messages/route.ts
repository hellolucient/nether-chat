import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    console.log('🚨 WEBHOOK RECEIVED 🚨')
    console.log('🕒 Time:', new Date().toISOString())
    
    const rawBody = await request.text()
    const data = JSON.parse(rawBody)
    
    // Add debug logging for bot messages
    console.log('📨 Message author details:', {
      id: data.author.id,
      username: data.author.username,
      isBot: data.author.bot,  // Check if message is from a bot
      content: data.content
    })
    
    // Extract all relevant fields including reply data
    const messageData = {
      id: data.id,
      channel_id: data.channel_id,
      sender_id: data.author.id.replace(/[<@>]/g, ''),
      author_username: data.author.username,  // Make sure we're capturing the username
      content: data.content,
      sent_at: new Date(data.timestamp).toISOString(),
      // Add reply data if this is a reply
      referenced_message_id: data.referenced_message?.id || null,
      referenced_message_author_id: data.referenced_message?.author?.id?.replace(/[<@>]/g, '') || null,
      referenced_message_content: data.referenced_message?.content || null
    }

    console.log('💾 Storing message:', {
      ...messageData,
      content: messageData.content.substring(0, 50) // Truncate for logging
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