'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export function AdminLink() {
  const { publicKey } = useWallet()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function checkAdmin() {
      if (!publicKey) return

      const { data, error } = await supabase
        .from('admin_users')
        .select('wallet_address')
        .eq('wallet_address', publicKey.toString())
        .single()

      if (data && !error) {
        setIsAdmin(true)
      }
    }

    checkAdmin()
  }, [publicKey])

  if (!isAdmin) return null

  return (
    <Link 
      href="/admin" 
      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
    >
      Admin Panel
    </Link>
  )
} 