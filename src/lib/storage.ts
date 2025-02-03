import { supabase } from './supabase'
import imageCompression from 'browser-image-compression' // We'll need to install this

// Define the expected response type
interface PublicUrlResponse {
  publicUrl: string;
}

export async function uploadImage(file: File) {
  try {
    console.log('📸 Storage: Starting image upload:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Compress image before upload
    const compressedFile = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true
    })

    console.log('✅ Storage: Image compressed:', {
      originalSize: file.size,
      compressedSize: compressedFile.size
    })

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `${timestamp}-${compressedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    console.log('📝 Storage: Uploading with filename:', filename)

    // Upload to Supabase Storage
    const { data, error } = await supabase
      .storage
      .from('messages-images')
      .upload(filename, compressedFile, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('❌ Storage: Upload error details:', {
        message: error.message,
        name: error.name,
      })
      throw error
    }

    console.log('✅ Storage: Upload successful:', data)

    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('messages-images')
      .getPublicUrl(filename)

    const publicUrl = urlData.publicUrl

    console.log('✅ Storage: Got public URL:', publicUrl)
    return publicUrl
  } catch (error) {
    console.error('❌ Storage: Error uploading image:', error)
    throw error
  }
}

// Cleanup function to run periodically
export async function cleanupOldImages() {
  try {
    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - 72)

    // List all files
    const { data: files, error } = await supabase
      .storage
      .from('message-images')
      .list()

    if (error) throw error

    // Filter files older than 72 hours
    const oldFiles = files.filter(file => {
      const timestamp = parseInt(file.name.split('-')[0])
      return new Date(timestamp) < cutoffDate
    })

    // Delete old files
    if (oldFiles.length > 0) {
      const { error: deleteError } = await supabase
        .storage
        .from('message-images')
        .remove(oldFiles.map(f => f.name))

      if (deleteError) throw deleteError

      console.log(`🧹 Storage: Cleaned up ${oldFiles.length} old images`)
    }
  } catch (error) {
    console.error('❌ Storage: Error cleaning up old images:', error)
  }
} 