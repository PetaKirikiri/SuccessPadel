import { useEffect } from 'react'

/** Load the independent court document, including its own renderer and controls. */
export default function Tactics3DRedirect() {
  useEffect(() => {
    window.location.replace('/tactics/index.html' + window.location.search + window.location.hash)
  }, [])
  return <a href="/tactics/index.html">Open 3D tactics court</a>
}
