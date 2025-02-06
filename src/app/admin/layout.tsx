'use client'

import { WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { useMemo } from 'react'
import '@solana/wallet-adapter-react-ui/styles.css'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  )

  return (
    <WalletProvider wallets={wallets}>
      {children}
    </WalletProvider>
  )
} 