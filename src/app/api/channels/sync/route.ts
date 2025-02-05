import { NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

interface ChannelMapping {
  id: string
  bot_assignment_id: string
  channel_id: string
  created_at: string
}

export async function POST() {
  const requestId = Math.random().toString(36).substring(7)
  console.log(`🔄 [${requestId}] Starting channel sync...`)

  try {
    const client = await getDiscordClient().catch(error => {
      console.error(`❌ [${requestId}] Discord client error:`, error)
      throw error
    })

    const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID!).catch(error => {
      console.error(`❌ [${requestId}] Guild fetch error:`, error)
      throw error
    })

    // Get all valid Discord text channel IDs
    const channels = await guild.channels.fetch()
    const validChannelIds = new Set(
      Array.from(channels.values())
        .filter(c => c?.type === 0)
        .map(c => c!.id)
    )
    console.log('🔄 Valid Discord channel IDs:', Array.from(validChannelIds))

    // Get all bot assignments
    const { data: assignments, error: assignmentError } = await supabase
      .from('bot_assignments')
      .select('id, wallet_address')

    if (assignmentError) throw assignmentError

    // Create mappings for each user
    const newMappings: ChannelMapping[] = []
    for (const assignment of assignments || []) {
      for (const channelId of validChannelIds) {
        newMappings.push({
          id: crypto.randomUUID(),
          bot_assignment_id: assignment.id,
          channel_id: channelId,
          created_at: new Date().toISOString()
        })
      }
    }

    console.log(`🔄 Creating ${newMappings.length} channel mappings...`)

    if (newMappings.length > 0) {
      const { error: insertError } = await supabase
        .from('channel_mappings')
        .insert(newMappings)

      if (insertError) {
        console.error('❌ Insert error:', insertError)
        throw insertError
      }
      console.log('✅ Restored channel mappings:', newMappings.length)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Restored ${newMappings.length} channel mappings` 
    })

  } catch (error) {
    console.error(`❌ [${requestId}] Sync failed:`, error)
    return NextResponse.json({
      error: 'Failed to sync channels',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 