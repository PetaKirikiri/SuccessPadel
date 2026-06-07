import { useState } from 'react'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { isLineBookmarkDismissed, isLineBookmarkSaved } from '../lib/line/bookmark'
import { LineAppBookmark } from './LineAppBookmark'

export function LineBookmarkBanner() {
  const { inClient } = useLineClientProfile()
  const [hidden, setHidden] = useState(
    () => isLineBookmarkSaved() || isLineBookmarkDismissed(),
  )

  if (!inClient || hidden) return null

  return (
    <div className="mb-3">
      <LineAppBookmark variant="banner" onDone={() => setHidden(true)} />
    </div>
  )
}
