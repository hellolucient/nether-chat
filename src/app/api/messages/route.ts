/* eslint-disable */
import { NextResponse } from 'next/server'
import { sendMessage, checkDiscordConnection } from '@/lib/discord'
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
    console.log('❤️ [1] Message request received')
    
    const walletAddress = request.headers.get('x-wallet-address')
    console.log('💙 [2] Wallet check:', { walletAddress })

    if (!walletAddress) {
      console.error('❌ No wallet address in request')
      return NextResponse.json({ error: 'No wallet address provided' }, { status: 400 })
    }

    // Add type annotation to the query result
    const { data: botAssignment, error: botError } = await supabase
      .from('bot_assignments')
      .select(`
        bot_id,
        discord_bots!inner (
          bot_token,
          bot_name
        )
      `)
      .eq('wallet_address', walletAddress)
      .single() as { data: BotAssignment | null, error: any }

    console.log('💚 [3] Bot assignment lookup:', { 
      hasData: !!botAssignment,
      botId: botAssignment?.bot_id,
      botName: botAssignment?.discord_bots?.bot_name,
      error: botError?.message
    })

    if (botError || !botAssignment?.discord_bots?.bot_token) {
      console.error('❌ Bot lookup failed:', botError)
      return NextResponse.json({ error: 'No bot found for this wallet' }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    console.log('💜 [4] Message content:', {
      channelId: body.channelId,
      contentLength: body.content?.length,
      type: typeof body.content === 'string' ? 'text' : body.content?.type
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

    console.log('🧡 [5] Send result:', { success })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('💔 Message send error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
} 