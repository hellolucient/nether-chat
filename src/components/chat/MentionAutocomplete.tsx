'use client'

import { useEffect, useState, useRef } from 'react'

type User = {
  id: string
  displayName: string
  username: string
}

interface MentionAutocompleteProps {
  query: string
  position: { top: number; left: number }
  onSelect: (user: User) => void
  onClose: () => void
}

export function MentionAutocomplete({ query, position, onSelect, onClose }: MentionAutocompleteProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch(`/api/users/search?q=${query}`)
        const data = await response.json()
        setUsers(data.users)
      } catch (error) {
        console.error('Error fetching users:', error)
      }
    }

    if (query) {
      fetchUsers()
    }
  }, [query])

  if (!query || users.length === 0) return null

  return (
    <div
      ref={ref}
      className="absolute z-10 bg-white rounded-lg shadow-lg border max-h-48 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      {users.map((user, index) => (
        <button
          key={user.id}
          className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
            index === selectedIndex ? 'bg-gray-100' : ''
          }`}
          onClick={() => onSelect(user)}
        >
          <span className="font-medium">@{user.displayName}</span>
          {user.username !== user.displayName && (
            <span className="text-gray-500 text-sm ml-2">({user.username})</span>
          )}
        </button>
      ))}
    </div>
  )
} 