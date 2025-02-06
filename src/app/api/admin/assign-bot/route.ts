import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Client } from 'discord.js'

const ADMIN_WALLETS = [
  process.env.ADMIN_WALLET_ADDRESS,
]

export async function POST(request: NextRequest) {
  try {
    // Get admin wallet from header
    const adminWallet = request.headers.get('x-admin-wallet')
    console.log('🔍 Checking admin wallet:', { 
      adminWallet,
      allowedWallets: ADMIN_WALLETS,
      isAllowed: ADMIN_WALLETS.includes(adminWallet || '')
    })

    if (!ADMIN_WALLETS.includes(adminWallet || '')) {
      console.log('❌ Unauthorized wallet:', adminWallet)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('📝 Request body:', body)

    const { botToken, walletAddress, isAdmin = false } = body

    if (!botToken || !walletAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: { botToken: !!botToken, walletAddress: !!walletAddress }
      }, { status: 400 })
    }

    // Validate the bot token by trying to connect
    const testClient = new Client({ 
      intents: [] 
    })

    try {
      console.log('🔄 Testing bot token connection...')
      await testClient.login(botToken)
      const botUser = testClient.user
      console.log('✅ Bot token valid, bot name:', botUser?.username)
      await testClient.destroy()

      // Check if wallet already has a bot token
      const { data: existingToken } = await supabase
        .from('bot_tokens')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single()

      console.log('📝 Existing token:', existingToken)

      // Update or insert bot token
      if (existingToken) {
        // Update existing token
        const { error: botError } = await supabase
          .from('bot_tokens')
          .update({
            bot_token: botToken,
            bot_name: botUser?.username || 'Unknown Bot'
          })
          .eq('wallet_address', walletAddress)

        if (botError) {
          console.error('❌ Database error updating bot token:', botError)
          throw botError
        }
      } else {
        // Insert new token
        const { error: botError } = await supabase
          .from('bot_tokens')
          .insert({
            wallet_address: walletAddress,
            bot_token: botToken,
            bot_name: botUser?.username || 'Unknown Bot'
          })

        if (botError) {
          console.error('❌ Database error inserting bot token:', botError)
          throw botError
        }
      }

      // Check if wallet already has an assignment
      const { data: existingAssignment } = await supabase
        .from('bot_assignments')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single()

      // Update or insert assignment
      if (existingAssignment) {
        // Update existing assignment
        const { error: assignmentError } = await supabase
          .from('bot_assignments')
          .update({
            is_admin: isAdmin
          })
          .eq('wallet_address', walletAddress)

        if (assignmentError) {
          console.error('❌ Database error updating assignment:', assignmentError)
          throw assignmentError
        }
      } else {
        // Insert new assignment
        const { error: assignmentError } = await supabase
          .from('bot_assignments')
          .insert({
            wallet_address: walletAddress,
            channel_access: [],
            is_admin: isAdmin
          })

        if (assignmentError) {
          console.error('❌ Database error inserting assignment:', assignmentError)
          throw assignmentError
        }
      }

      console.log('✅ Bot successfully assigned!')
      return NextResponse.json({ 
        success: true, 
        botName: botUser?.username 
      })
    } catch (error) {
      console.error('❌ Bot validation error:', error)
      return NextResponse.json({ 
        error: 'Invalid bot token or database error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ Failed to assign bot:', error)
    return NextResponse.json({ 
      error: 'Failed to assign bot',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 