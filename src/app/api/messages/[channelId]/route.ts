import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, getChannelMessages } from '@/lib/discord'
import { supabase } from '@/lib/supabase'

// Define the context type exactly as Next.js expects
type Context = {
  params: {
    channelId: string
  }
}

// GET handler for fetching messages
export async function GET(
  req: NextRequest,
  context: Context  // Use the full context object
) {
  try {
    const { channelId } = context.params  // Access through context.params
    const wallet = req.nextUrl.searchParams.get('wallet')

    if (!channelId || !wallet) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Check channel access
    const { data: botAssignment, error } = await supabase
      .from('bot_assignments')
      .select('channel_access')
      .eq('wallet_address', wallet)
      .single()

    if (error || !botAssignment?.channel_access?.includes(channelId)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    console.log('👋 API Route: Received request for messages')
    console.log('🔍 API Route: Request URL:', req.nextUrl)
    console.log('🔑 API Route: Channel ID from params:', channelId)

    console.log('🎯 API Route: Starting message fetch for channel:', channelId)
    
    // Get last viewed time along with messages
    const { data: lastViewed } = await supabase
      .from('last_viewed')
      .select('last_viewed')
      .eq('channel_id', channelId)
      .eq('wallet_address', wallet)
      .single()

    const messages = await getChannelMessages(channelId)
    console.log('📦 API Route: Got messages:', {
      count: messages?.length || 0,
      firstMessage: messages?.[0],
      lastMessage: messages?.[messages.length - 1]
    })

    return NextResponse.json({ 
      messages,
      lastViewed: lastViewed?.last_viewed 
    })
  } catch (error) {
    console.error('Error in GET messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST handler for sending messages
export async function POST(
  req: NextRequest,
  context: Context  // Same type here
) {
  try {
    const { channelId } = context.params  // Access through context.params
    const { content } = await req.json()

    console.log('📨 API: Received message request:', { 
      channelId,
      contentType: typeof content === 'object' ? content.type : 'text'
    })

    // Handle different message types
    if (typeof content === 'object') {
      if (content.type === 'image') {
        await sendMessage(channelId, content.content || '', {
          embeds: [{
            image: {
              url: content.url
            }
          }],
          messageReference: content.reply?.messageReference
        })
      } else {
        await sendMessage(channelId, content.content, {
          messageReference: content.reply?.messageReference,
          quotedContent: content.reply?.quotedContent
        })
      }
    } else {
      await sendMessage(channelId, content)
    }

    return NextResponse.json({ message: 'Message sent' }, { status: 200 })
  } catch (error) {
    console.error('❌ API: Error sending message:', error)
    return NextResponse.json(
      { error: 'Error sending message' },
      { status: 500 }
    )
  }
} 