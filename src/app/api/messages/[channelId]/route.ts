import { NextResponse } from 'next/server'
import { sendMessage, getChannelMessages } from '@/lib/discord'
import { supabase } from '@/lib/supabase'

// Add this specific type from Next.js
type Params = { params: { channelId: string } }

// GET handler for fetching messages
export async function GET(
  request: Request,
  params: Params  // Use it as a whole object, not destructured
) {
  try {
    const channelId = params.params.channelId  // Access through params.params
    const url = new URL(request.url)  // Use URL API instead of nextUrl
    const wallet = url.searchParams.get('wallet')

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
    console.log('🔍 API Route: Request URL:', request.url)
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
  request: Request,
  params: Params  // Same type here
) {
  try {
    const channelId = params.params.channelId
    const { content } = await request.json()

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

    return new Response('Message sent', { status: 200 })
  } catch (error) {
    console.error('❌ API: Error sending message:', error)
    return NextResponse.json(
      { error: 'Error sending message' },
      { status: 500 }
    )
  }
} 