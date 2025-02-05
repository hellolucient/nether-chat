/* eslint-disable */
'use client'

import { AdminPanel } from '@/components/admin/AdminPanel'
import Link from 'next/link'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#17171B] text-white">
      <div className="flex items-center justify-between p-4 border-b border-[#262626]">
        <h1 className="text-xl font-bold">Admin Panel</h1>
        <Link 
          href="/"
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Return to Chat
        </Link>
      </div>
      <div className="p-4">
        <AdminPanel />
      </div>
    </div>
  )
} 