import type { ReactNode } from 'react'

/** Browser-first login — no LIFF gate. */
export function LineEntryGate({ children }: { children: ReactNode }) {
  return <>{children}</>
}
