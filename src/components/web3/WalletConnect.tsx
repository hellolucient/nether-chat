'use client'

import dynamic from 'next/dynamic'

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

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
