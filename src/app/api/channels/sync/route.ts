import { NextResponse } from 'next/server'
import { getDiscordClient } from '@/lib/discord'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ChannelMapping {
  bot_assignment_id: string
  channel_id: string
}

export async function POST() {
  try {
    // Add request ID for tracing
    const requestId = Math.random().toString(36).substring(7)
    console.log(`🔄 [${requestId}] Starting channel sync...`)

    const client = await getDiscordClient().catch(error => {
      console.error(`❌ [${requestId}] Discord client error:`, error)
      throw new Error('Failed to initialize Discord client')
    })

    const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID!).catch(error => {
      console.error(`❌ [${requestId}] Guild fetch error:`, error)
      throw new Error('Failed to fetch Discord guild')
    })

    // Get admin users first
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('wallet_address')

    if (adminError) {
      console.error(`❌ [${requestId}] Admin users error:`, adminError)
      throw new Error('Failed to fetch admin users')
    }

    if (!adminUsers?.length) {
      console.error(`❌ [${requestId}] No admin users found`)
      throw new Error('No admin users configured')
    }

    // Get all valid Discord text channel IDs
    const channels = await guild.channels.fetch()
    const validChannelIds = new Set(
      Array.from(channels.values())
        .filter(c => c?.type === 0)
        .map(c => c!.id)
    )
    console.log('🔄 Valid Discord channel IDs:', Array.from(validChannelIds))
    
    // Get bot assignments for admin users
    const { data: adminAssignments } = await supabase
      .from('bot_assignments')
      .select('id')
      .in('wallet_address', adminUsers?.map(u => u.wallet_address) || [])
    console.log('🔄 Admin assignments:', adminAssignments)
    
    // First, delete any mappings for channels that no longer exist
    const { error: deleteError, count: deleteCount } = await supabase
      .from('channel_mappings')
      .delete()
      .not('channel_id', 'in', `(${Array.from(validChannelIds).join(',')})`)
      .select('count')
    
    if (deleteError) throw deleteError
    console.log('🔄 Deleted mappings:', deleteCount)
    
    // Then add any new channels for admin users
    const newMappings: ChannelMapping[] = []
    for (const channelId of validChannelIds) {
      for (const assignment of adminAssignments || []) {
        newMappings.push({
          bot_assignment_id: assignment.id,
          channel_id: channelId
        })
      }
    }
    console.log('🔄 New mappings to add:', newMappings)
    
    if (newMappings.length > 0) {
      const { error: upsertError, data: upsertData } = await supabase
        .from('channel_mappings')
        .upsert(newMappings, {
          onConflict: 'bot_assignment_id,channel_id',
          ignoreDuplicates: true
        })
        .select()
      
      if (upsertError) throw upsertError
      console.log('🔄 Added/updated mappings:', upsertData)
    }
    
    // Verify final mappings
    const { data: finalMappings } = await supabase
      .from('channel_mappings')
      .select('*')
    console.log('🔄 Final channel mappings:', finalMappings)
    
    console.log(`✅ [${requestId}] Sync completed successfully`)
    return NextResponse.json({ success: true, requestId })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Sync failed:', {
      error,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to sync channels', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
} 