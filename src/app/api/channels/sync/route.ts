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
    console.log('🔄 Starting channel sync...')
    const client = await getDiscordClient()
    const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID!)
    const channels = await guild.channels.fetch()
    
    // Get all valid Discord text channel IDs
    const validChannelIds = new Set(
      Array.from(channels.values())
        .filter(c => c?.type === 0)  // Text channels only
        .map(c => c!.id)
    )
    console.log('🔄 Valid Discord channel IDs:', Array.from(validChannelIds))
    
    // Get admin users
    const { data: adminUsers } = await supabase
      .from('admin_users')
      .select('wallet_address')
    
    // Get bot assignments for admin users
    const { data: adminAssignments } = await supabase
      .from('bot_assignments')
      .select('id')
      .in('wallet_address', adminUsers?.map(u => u.wallet_address) || [])
    
    // First, delete any mappings for channels that no longer exist
    const { error: deleteError } = await supabase
      .from('channel_mappings')
      .delete()
      .not('channel_id', 'in', `(${Array.from(validChannelIds).join(',')})`)
    
    if (deleteError) throw deleteError
    console.log('🔄 Deleted mappings for non-existent channels')
    
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
    
    if (newMappings.length > 0) {
      // Use upsert to avoid duplicates
      const { error: upsertError } = await supabase
        .from('channel_mappings')
        .upsert(newMappings, {
          onConflict: 'bot_assignment_id,channel_id',
          ignoreDuplicates: true
        })
      
      if (upsertError) throw upsertError
      console.log('🔄 Added/updated mappings for current channels')
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error syncing channels:', error)
    return NextResponse.json({ error: 'Failed to sync channels' }, { status: 500 })
  }
} 