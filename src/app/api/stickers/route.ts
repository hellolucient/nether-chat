import { NextResponse } from 'next/server'
import { Client, GatewayIntentBits } from 'discord.js'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const wallet = request.headers.get('x-wallet-address')
    console.log('🔍 Sticker request for wallet:', wallet)

    if (!wallet) {
      console.log('❌ No wallet provided')
      return NextResponse.json({ error: 'No wallet address provided' }, { status: 400 })
    }

    const { data: botData, error: botError } = await supabase
      .from('bot_tokens')
      .select('bot_token')
      .eq('wallet_address', wallet)
      .single()

    if (botError) {
      console.error('❌ Database error:', botError)
      throw botError
    }

    if (!botData?.bot_token) {
      console.log('❌ No bot token found for wallet:', wallet)
      return NextResponse.json({ error: 'No bot token found for this wallet' }, { status: 400 })
    }

    console.log('🤖 Found bot token, initializing client...')
    
    const client = new Client({ 
      intents: [GatewayIntentBits.Guilds]
    })

    try {
      await client.login(botData.bot_token)
      console.log('✅ Client logged in')
      
      await new Promise((resolve) => client.once('ready', resolve))
      console.log('✅ Client ready')

      const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID!)
      console.log('✅ Guild fetched')
      
      const serverStickers = await guild.stickers.fetch()
      console.log('✅ Server stickers fetched:', serverStickers.size)
      
      const stickerPacks = await client.fetchStickerPacks()
      console.log('✅ Sticker packs fetched:', stickerPacks.size)

      // Combine server stickers and sticker pack stickers
      const allStickers = [
        ...Array.from(serverStickers.values()),
        ...Array.from(stickerPacks.values()).flatMap(pack => 
          Array.from(pack.stickers.values())
        )
      ]

      const stickerData = allStickers.map(sticker => ({
        id: sticker.id,
        name: sticker.name,
        format_type: sticker.format,
        url: sticker.url,
        pack_name: 'pack_name' in sticker ? sticker.pack_name : 'Server Stickers'
      }))

      await client.destroy()

      return NextResponse.json({ stickers: stickerData })
    } catch (error) {
      console.error('❌ Error fetching stickers:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch stickers',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('❌ Error fetching stickers:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch stickers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 