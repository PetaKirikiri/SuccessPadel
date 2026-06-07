import { useEffect } from 'react'
import { LineSigningInScreen } from '../components/LineSigningInScreen'

/** Legacy route — redirect to /login so one callback URL works in LINE Developers. */
export function LineAuthCallback() {
  useEffect(() => {
    const next = `/login${window.location.search}${window.location.hash}`
    window.location.replace(next)
  }, [])

  return <LineSigningInScreen message="Returning from LINE…" />
}
