import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Returns a callback that navigates back only when there is an in-app history
 * entry to return to (location.key !== 'default'). Otherwise navigates to the
 * given fallback route, preventing users from being sent to external referrers.
 */
export function useSafeBack(fallback: string) {
  const navigate = useNavigate()
  const { key } = useLocation()

  return () => {
    if (key === 'default') {
      navigate(fallback)
    } else {
      navigate(-1)
    }
  }
}
