import { createContext, useContext, type ReactNode } from 'react'
import type { Gender } from '../lib/competitionPresets'

type GamesGenderFilterContextValue = {
  gender: Gender
  setGender: (gender: Gender) => void
}

const GamesGenderFilterContext = createContext<GamesGenderFilterContextValue | null>(null)

export function GamesGenderFilterProvider({
  gender,
  setGender,
  children,
}: {
  gender: Gender
  setGender: (gender: Gender) => void
  children: ReactNode
}) {
  return (
    <GamesGenderFilterContext.Provider value={{ gender, setGender }}>
      {children}
    </GamesGenderFilterContext.Provider>
  )
}

export function useGamesGenderFilter(): Gender | null {
  return useContext(GamesGenderFilterContext)?.gender ?? null
}

export function useGamesGenderFilterControls(): GamesGenderFilterContextValue | null {
  return useContext(GamesGenderFilterContext)
}
