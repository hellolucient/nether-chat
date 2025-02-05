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
    // Verify environment variables first
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.error('❌ Missing DISCORD_BOT_TOKEN')
      return NextResponse.json(
        { error: 'Discord bot token not configured' },
        { status: 500 }
      )
    }
    if (!process.env.DISCORD_SERVER_ID) {
      console.error('❌ Missing DISCORD_SERVER_ID')
      return NextResponse.json(
        { error: 'Discord server ID not configured' },
        { status: 500 }
      )
    }

    console.log('🔄 Starting channel sync...')
    const client = await getDiscordClient()
    console.log('🔄 Got Discord client')

    const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID!)
    console.log('🔄 Got guild:', guild.name)
    const channels = await guild.channels.fetch()
    
    // Get all valid Discord text channel IDs
    const validChannelIds = new Set(
      Array.from(channels.values())
        .filter(c => c?.type === 0)
        .map(c => c!.id)
    )
    console.log('🔄 Valid Discord channel IDs:', Array.from(validChannelIds))
    
    // Get admin users
    const { data: adminUsers } = await supabase
      .from('admin_users')
      .select('wallet_address')
    console.log('🔄 Admin users:', adminUsers)
    
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
    
    return NextResponse.json({ success: true })
  } catch (error) {
    // More detailed error logging
    console.error('Error in channel sync:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to sync channels', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 