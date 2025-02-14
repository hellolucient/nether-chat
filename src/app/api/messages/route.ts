/* eslint-disable */
import { NextResponse } from 'next/server'
import { sendMessage, checkDiscordConnection } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import { PostgrestSingleResponse } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    console.log('📨 API: Message send request received')
    
    // Get wallet address from header
    const walletAddress = request.headers.get('x-wallet-address')
    console.log('👛 Wallet address:', walletAddress)

    if (!walletAddress) {
      console.error('❌ API: No wallet address provided')
      return NextResponse.json({ error: 'No wallet address provided' }, { status: 400 })
    }

    // Get bot token for this wallet - fix the query and type
    const { data: botAssignment, error: botError }: PostgrestSingleResponse<{
      discord_bots: { bot_token: string }
    }> = await supabase
      .from('bot_assignments')
      .select(`
        discord_bots!inner (
          bot_token
        )
      `)
      .eq('wallet_address', walletAddress)
      .single()

    console.log('🤖 Bot assignment result:', { 
      hasData: !!botAssignment,
      hasToken: !!botAssignment?.discord_bots?.bot_token,
      error: botError
    })

    if (botError || !botAssignment?.discord_bots?.bot_token) {
      console.error('❌ API: No bot found for wallet:', walletAddress)
      return NextResponse.json({ error: 'No bot found for this wallet' }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    console.log('📦 API: Message request body:', {
      channelId: body.channelId,
      contentType: typeof body.content,
      content: typeof body.content === 'string' ? body.content : body.content.content,
      hasReply: !!body.content?.reply
    })

    if (!body.channelId || !body.content) {
      console.error('❌ API: Missing required fields')
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Send message using the wallet's bot token
    const success = await sendMessage(
      body.channelId, 
      body.content.content,
      walletAddress,
      body.content?.reply ? {
        messageReference: body.content.reply.messageReference,
        quotedContent: body.content.reply.quotedContent
      } : undefined
    )

    if (!success) {
      console.error('❌ API: Failed to send message to Discord')
      return NextResponse.json({ error: 'Failed to send message to Discord' }, { status: 500 })
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