import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, getChannelMessages } from '@/lib/discord'
import { supabase } from '@/lib/supabase'

// GET handler for fetching messages
export async function GET(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get('wallet')
  
  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address required' },
      { status: 401 }
    )
  }

  // Check channel access
  const { data: botAssignment, error } = await supabase
    .from('bot_assignments')
    .select('channel_access')
    .eq('wallet_address', walletAddress)
    .single()

  if (error || !botAssignment?.channel_access?.includes(params.channelId)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    )
  }

  console.log('👋 API Route: Received request for messages')
  console.log('🔍 API Route: Request URL:', request.url)
  console.log('🔑 API Route: Channel ID from params:', params.channelId)

  try {
    console.log('🎯 API Route: Starting message fetch for channel:', params.channelId)
    
    if (!params.channelId) {
      console.error('❌ API Route: No channelId provided')
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      )
    }

    // Get last viewed time along with messages
    const { data: lastViewed } = await supabase
      .from('last_viewed')
      .select('last_viewed')
      .eq('channel_id', params.channelId)
      .eq('wallet_address', walletAddress)
      .single()

    const messages = await getChannelMessages(params.channelId)
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
    console.error('❌ API Route Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

// POST handler for sending messages
export async function POST(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    const { content } = await request.json()
    const channelId = params.channelId

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
    return new Response('Error sending message', { status: 500 })
  }
} 