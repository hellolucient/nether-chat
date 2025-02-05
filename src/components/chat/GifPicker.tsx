'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface GifPickerProps {
  onSelect: (url: string) => void
  onClose: () => void
}

interface TenorGifResult {
  id: string
  media_formats: {
    gif: { url: string }
    tinygif: { url: string }
  }
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<TenorGifResult[]>([])
  const [loading, setLoading] = useState(false)

  const searchGifs = async (query: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setResults(data.results || [])
    } catch (error) {
      console.error('Failed to search GIFs:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="absolute bottom-full mb-2 bg-[#262626] rounded-lg shadow-lg p-4 w-[300px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Search GIFs</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          if (e.target.value) {
            searchGifs(e.target.value)
          } else {
            setResults([])
          }
        }}
        placeholder="Search for GIFs..."
        className="w-full p-2 bg-[#1E1E24] rounded mb-4"
      />

      <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="col-span-2 text-center py-4">Loading...</div>
        ) : results.map((gif) => (
          <button
            key={gif.id}
            onClick={() => onSelect(gif.media_formats.gif.url)}
            className="aspect-square overflow-hidden rounded hover:opacity-80"
          >
            <img
              src={gif.media_formats.tinygif.url}
              alt="GIF"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
} 