'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useWallet } from '@solana/wallet-adapter-react'

interface StickerPickerProps {
  onSelect: (sticker: { id: string; url: string }) => void
  onClose: () => void
}

interface Sticker {
  id: string
  name: string
  format_type: number
  url: string
}

export function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const { publicKey } = useWallet()
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStickers = async () => {
      if (!publicKey) return
      
      try {
        console.log('🔍 Fetching stickers for wallet:', publicKey.toString())
        const response = await fetch('/api/stickers', {
          headers: {
            'x-wallet-address': publicKey.toString()
          }
        })
        
        if (!response.ok) {
          const error = await response.json()
          console.error('❌ Sticker fetch error:', error)
          return
        }
        
        const data = await response.json()
        console.log('📥 Received sticker data:', data)
        
        if (data.stickers) {
          setStickers(data.stickers)
        }
      } catch (error) {
        console.error('Error fetching stickers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStickers()
  }, [publicKey])

  return (
    <div className="absolute bottom-full right-0 mb-2 p-2 bg-[#1E1E24] rounded-lg border border-[#262626] w-96">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-gray-300">Stickers</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-300"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : stickers.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => onSelect({ id: sticker.id, url: sticker.url })}
              className="p-2 hover:bg-[#262626] rounded transition-colors"
            >
              <img
                src={sticker.url}
                alt={sticker.name}
                className="w-full h-auto"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-4">
          No stickers available
        </div>
      )}
    </div>
  )
} 