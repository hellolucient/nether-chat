'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function WalletConnect() {
  return (
    <WalletMultiButton 
      className="wallet-adapter-button-trigger"
      style={{
        backgroundColor: 'rgb(130, 71, 229)',
        border: 'none'
      }}
    />
  )
}
