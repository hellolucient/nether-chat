import fs from 'fs'
import path from 'path'

const LOG_FILE = path.join(process.cwd(), 'debug.log')

export const logger = {
  debug: (msg: string, data?: any) => {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${msg} ${data ? JSON.stringify(data, null, 2) : ''}\n`
    
    // Log to console and file
    console.log(msg, data)
    fs.appendFileSync(LOG_FILE, logEntry)
  },

  error: (msg: string, error: any) => {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ERROR: ${msg} ${JSON.stringify(error, null, 2)}\n`
    
    console.error(msg, error)
    fs.appendFileSync(LOG_FILE, logEntry)
  },

  clear: () => {
    fs.writeFileSync(LOG_FILE, '')
  }
} 