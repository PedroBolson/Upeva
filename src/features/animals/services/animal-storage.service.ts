import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'

export async function uploadAnimalPhoto(animalId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `animals/${animalId}/${Date.now()}_${safeName}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function deleteAnimalPhoto(url: string): Promise<void> {
  try {
    const path = decodeURIComponent(url.split('/o/')[1].split('?')[0])
    await deleteObject(ref(storage, path))
  } catch {
    // Photo already deleted or URL is not a Storage URL — ignore
  }
}
