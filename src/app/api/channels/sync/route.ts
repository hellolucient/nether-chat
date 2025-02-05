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
    
    console.log('🔄 Found Discord channels:', 
      Array.from(channels.values())
        .filter(c => c?.type === 0)
        .map(c => ({ id: c!.id, name: c!.name }))
    )
    
    // Get existing channel mappings
    const { data: existingMappings } = await supabase
      .from('channel_mappings')
      .select('channel_id')
    
    console.log('🔄 Existing mappings:', existingMappings)
    
    const existingChannelIds = new Set(existingMappings?.map(m => m.channel_id))
    
    // Get admin users
    const { data: adminUsers } = await supabase
      .from('admin_users')
      .select('wallet_address')
    
    // Get bot assignments for admin users
    const { data: adminAssignments } = await supabase
      .from('bot_assignments')
      .select('id')
      .in('wallet_address', adminUsers?.map(u => u.wallet_address) || [])
    
    // Prepare new mappings for admin users
    const newMappings: ChannelMapping[] = []
    
    for (const channel of channels.values()) {
      if (channel?.type === 0) { // Text channels only
        if (!existingChannelIds.has(channel.id)) {
          // Add this channel for all admin users
          for (const assignment of adminAssignments || []) {
            newMappings.push({
              bot_assignment_id: assignment.id,
              channel_id: channel.id
            })
          }
        }
      }
    }
    
    // Insert new mappings if any
    if (newMappings.length > 0) {
      const { error } = await supabase
        .from('channel_mappings')
        .insert(newMappings)
      
      if (error) throw error
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error syncing channels:', error)
    return NextResponse.json({ error: 'Failed to sync channels' }, { status: 500 })
  }
} 