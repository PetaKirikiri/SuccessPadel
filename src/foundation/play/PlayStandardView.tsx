import type { ReactNode } from 'react'

type Props = {
  loadOrError: ReactNode
  session: unknown
  gamesBody: ReactNode
}

/** Play page body — full width; bottom nav from Layout. */
export function PlayStandardView({ loadOrError, session, gamesBody }: Props) {
  return (
    <>
      {loadOrError}
      {session ? gamesBody : null}
    </>
  )
}
