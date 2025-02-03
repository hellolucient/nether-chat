'use client'

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack'
import { clusterApiUrl } from '@solana/web3.js'
import { useMemo } from 'react'

// Import the styles
require('@solana/wallet-adapter-react-ui/styles.css')

export function Providers({ children }: { children: React.ReactNode }) {
  // We're using mainnet-beta
  const network = WalletAdapterNetwork.Mainnet

  // Use Helius RPC endpoint instead of default
  const endpoint = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || clusterApiUrl(network)

  // Add the wallets you want to support
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new BackpackWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
} 