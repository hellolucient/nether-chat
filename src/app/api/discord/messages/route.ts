import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    console.log('📨 Processing Discord message')
    console.log('🕒 Time:', new Date().toISOString())
    
    const rawBody = await request.text()
    const data = JSON.parse(rawBody)
    
    // Get bots list first
    const { data: bots } = await supabase
      .from('discord_bots')
      .select('discord_id, bot_name')

    console.log('🍉 Bot List Check:', {
      bots,
      messageAuthorId: data.author.id,
      messageContent: data.content.substring(0, 50),
      mentions: data.mentions?.users,
      referencedMessage: data.referenced_message
    })

    // Check bot-related flags
    const isFromBot = bots?.some(bot => bot.discord_id === data.author.id)
    const mentionsBot = data.mentions?.users?.some(user => 
      bots?.some(bot => bot.discord_id === user.id)
    )
    const replyingToBot = data.referenced_message ? 
      bots?.some(bot => bot.discord_id === data.referenced_message.author.id) :
      false

    // Add debug logging for bot messages
    console.log('📨 Message author details:', {
      id: data.author.id,
      username: data.author.username,
      isBot: data.author.bot,  // Check if message is from a bot
      content: data.content
    })
    
    // Add this after calculating the flags
    console.log('🍉 Bot Flag Check:', {
      messageId: data.id,
      content: data.content.substring(0, 50),
      flags: {
        isFromBot,
        mentionsBot,
        replyingToBot
      },
      botIds: bots?.map(b => b.discord_id),
      authorId: data.author.id,
      mentions: data.mentions?.users?.map(u => u.id),
      referencedMessageAuthorId: data.referenced_message?.author?.id
    })
    
    // Store ALL messages, not just bot-related ones
    const messageData = {
      id: data.id,
      channel_id: data.channel_id,
      sender_id: data.author.id,
      author_username: data.author.username,
      author_display_name: data.member?.displayName || data.author.displayName || data.author.username,
      content: data.content,
      sent_at: new Date(data.timestamp).toISOString(),
      // Remove isBotMention, isFromBot, replyingToBot
      referenced_message_id: data.referenced_message?.id || null,
      referenced_message_author_id: data.referenced_message?.author?.id || null,
      referenced_message_content: data.referenced_message?.content || null,
      attachments: data.attachments?.map(attachment => ({
        url: attachment.url,
        content_type: attachment.content_type,
        filename: attachment.name,
        size: attachment.size
      })) || [],
      embeds: data.embeds || [],
      stickers: data.stickers || []
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