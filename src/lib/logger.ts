const BRIGHT_MAGENTA = '\x1b[95m'
const RESET = '\x1b[0m'
const BRIGHT_RED = '\x1b[91m'

export const logger = {
  debug: (msg: string, data?: any) => {
    // Format: 🟣 [REQUEST_ID] MESSAGE: DATA
    const logMessage = `${BRIGHT_MAGENTA}🟣 ${msg}${RESET}`
    if (data) {
      console.log(logMessage, JSON.stringify(data, null, 2))
    } else {
      console.log(logMessage)
    }
  },

  error: (msg: string, error: any) => {
    // Format: ❌ [REQUEST_ID] ERROR: DETAILS
    const logMessage = `${BRIGHT_RED}❌ ${msg}${RESET}`
    console.error(logMessage, JSON.stringify(error, null, 2))
  },

  clear: () => {
    // Implementation for clearing the log file
  }
} 