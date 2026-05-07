import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { checkRejectionFlag } from '../services/adoption.service'
import type { RejectionFlagResult } from '../services/adoption.service'

async function hydrateFlagArchiveFileId(
  result: RejectionFlagResult,
): Promise<RejectionFlagResult> {
  if (!result.flagged || result.archiveFileId) return result

  const flagSnap = await getDoc(doc(db, 'rejectionFlags', result.flagId))
  const archiveFileId = flagSnap.exists() ? flagSnap.data().archiveFileId : null

  return {
    ...result,
    archiveFileId: typeof archiveFileId === 'string' && archiveFileId.trim()
      ? archiveFileId.trim()
      : null,
  }
}

export function useRejectionFlag(applicationId: string | undefined) {
  return useQuery({
    queryKey: ['rejection-flags', 'check', applicationId],
    queryFn: async () => hydrateFlagArchiveFileId(await checkRejectionFlag(applicationId!)),
    enabled: !!applicationId,
    staleTime: 1000 * 60 * 5,
  })
}
