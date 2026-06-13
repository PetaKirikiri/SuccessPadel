import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  openPlayerProfile,
  type OpenPlayerProfileInput,
} from '../lib/openPlayerProfile'

export function useOpenPlayerProfile() {
  const navigate = useNavigate()
  const location = useLocation()
  const [opening, setOpening] = useState(false)

  const openProfile = useCallback(
    async (input: OpenPlayerProfileInput = {}) => {
      setOpening(true)
      try {
        return await openPlayerProfile(navigate, {
          ...input,
          from: input.from ?? location.pathname + location.search,
        })
      } finally {
        setOpening(false)
      }
    },
    [location.pathname, location.search, navigate],
  )

  return { openProfile, opening }
}
