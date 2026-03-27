import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'

export async function uploadAnimalPhoto(animalId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `animals/${animalId}/${Date.now()}_${safeName}`
  const storageRef = ref(storage, path)
  // Images are immutable (timestamp in filename) — cache for 1 year
  await uploadBytes(storageRef, file, {
    cacheControl: 'public, max-age=31536000, immutable',
    contentType: file.type,
  })
  return getDownloadURL(storageRef)
}

export async function deleteAnimalPhoto(url: string): Promise<void> {
  const encodedPath = url.split('/o/')[1]?.split('?')[0]

  if (!encodedPath) {
    throw new Error('invalid-storage-url')
  }

  const path = decodeURIComponent(encodedPath)
  await deleteObject(ref(storage, path))
}
