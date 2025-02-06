import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Client } from 'discord.js'

export async function POST(request: NextRequest) {
  try {
    const { botToken, walletAddress } = await request.json()

    // Validate the bot token by trying to connect
    const testClient = new Client({ intents: [] })
    try {
      await testClient.login(botToken)
      const botUser = testClient.user
      await testClient.destroy() // Clean up the test connection

      // Store the bot token
      const { error } = await supabase
        .from('bot_tokens')
        .upsert({
          wallet_address: walletAddress,
          bot_token: botToken,
          bot_name: botUser?.username || 'Unknown Bot'
        })

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        botName: botUser?.username 
      })
    } catch (error) {
      return NextResponse.json({ 
        error: 'Invalid bot token' 
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Failed to register bot:', error)
    return NextResponse.json({ 
      error: 'Failed to register bot' 
    }, { status: 500 })
  }
} 