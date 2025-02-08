import { initializeDiscordBot } from './discord'

export async function initializeServices() {
  console.log('🚀 Starting services initialization...')
  
  try {
    // Initialize Discord Bot
    await initializeDiscordBot()
    console.log('✅ All services initialized successfully')
  } catch (error) {
    console.error('❌ Service initialization failed:', error)
    throw error
  }
} 