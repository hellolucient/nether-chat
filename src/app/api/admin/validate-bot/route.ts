import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'discord.js'

export async function POST(request: NextRequest) {
  try {
    const { botToken } = await request.json()
    
    const testClient = new Client({ intents: [] })
    await testClient.login(botToken)
    const botUser = testClient.user
    await testClient.destroy()

    if (!botUser) {
      return NextResponse.json({ error: 'Could not get bot details' }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true,
      botId: botUser.id,
      botName: botUser.username
    })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid bot token' }, { status: 400 })
  }
} 