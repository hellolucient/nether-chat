'use client'

import { ClientOnly } from '@/components/web3/ClientOnly'
import { WalletConnect } from '@/components/web3/WalletConnect'
import { AdminLink } from '@/components/web3/AdminLink'
import { ProfileInfo } from '@/components/web3/ProfileInfo'

export function Header() {
  return (
    <div style={{ 
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      padding: '0 16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 className="text-xl font-bold">Nether Chat</h1>
        <AdminLink />
      </div>
      <div className="flex items-center gap-4"> {/* Added gap between profile and wallet */}
        <ClientOnly>
          <ProfileInfo />
          <WalletConnect />
        </ClientOnly>
      </div>
    </div>
  )
}
