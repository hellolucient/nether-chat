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
    console.log('🔄 Getting Discord client...')
    const client = await getDiscordClient().catch(error => {
      console.error(`❌ [${requestId}] Discord client error:`, {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    })

    console.log('🔄 Fetching guild...')
    const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID!).catch(error => {
      console.error(`❌ [${requestId}] Guild fetch error:`, {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    })

    console.log('🔄 Fetching channels...')
    const channels = await guild.channels.fetch()
    const validChannelIds = new Set(
      Array.from(channels.values())
        .filter(c => c?.type === 0)
        .map(c => c!.id)
    )
    console.log('🔄 Valid Discord channel IDs:', Array.from(validChannelIds))

    // First, delete all existing mappings
    console.log('🔄 Deleting existing mappings...')
    const { error: deleteError } = await supabase
      .from('channel_mappings')
      .delete()
      .gte('created_at', '2000-01-01')

    if (deleteError) {
      console.error('❌ Delete error:', {
        error: deleteError,
        message: deleteError.message,
        details: deleteError.details
      })
      throw deleteError
    }
    console.log('✅ Cleared existing mappings')

    // Get all bot assignments with their admin status
    console.log('🔄 Fetching bot assignments...')
    const { data: assignments, error: assignmentError } = await supabase
      .from('bot_assignments')
      .select('id, wallet_address, is_admin')

    if (assignmentError) {
      console.error('❌ Assignment fetch error:', {
        error: assignmentError,
        message: assignmentError.message,
        details: assignmentError.details
      })
      throw assignmentError
    }

    console.log('🔄 Found assignments:', assignments)

    // Create mappings based on user type
    const newMappings: ChannelMapping[] = []
    for (const assignment of assignments || []) {
      if (assignment.is_admin) {
        // Admin users get all channels
        for (const channelId of validChannelIds) {
          newMappings.push({
            id: crypto.randomUUID(),
            bot_assignment_id: assignment.id,
            channel_id: channelId,
            created_at: new Date().toISOString()
          })
        }
      }
      // Regular users get no channels by default - they need explicit assignment
    }

    console.log(`🔄 Creating ${newMappings.length} channel mappings...`)
    console.log('First mapping example:', newMappings[0])

    if (newMappings.length > 0) {
      const { error: insertError } = await supabase
        .from('channel_mappings')
        .insert(newMappings)

      if (insertError) {
        console.error('❌ Insert error:', {
          error: insertError,
          message: insertError.message,
          details: insertError.details,
          firstMapping: newMappings[0]
        })
        throw insertError
      }
      console.log('✅ Created channel mappings:', newMappings.length)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Created ${newMappings.length} channel mappings` 
    })

  } catch (error) {
    console.error(`❌ [${requestId}] Sync failed:`, {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json({
      error: 'Failed to sync channels',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 