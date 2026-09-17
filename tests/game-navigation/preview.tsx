import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { TvGameCarousel } from '../../src/components/GameCard/TvGameCarousel'
import type { TranslateFn } from '../../src/i18n'

// Local component fixture: no Supabase client, network writes, or real competition IDs.
const t = ((key: string) => key) as TranslateFn
const initialGames = [1, 2, 3, 4, 5, 6]
function Fixture() {
  const [liveGame, setLiveGame] = useState(2)
  const [games, setGames] = useState(initialGames)
  const [generation, setGeneration] = useState(0)
  const [event, setEvent] = useState('first')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick(value => value + 1), 100)
    return () => clearInterval(timer)
  }, [])
  const key = `navigation-regression:${event}`
  return <main>
    <p>Refresh tick: {tick}; live game: {liveGame}</p>
    <button onClick={() => setLiveGame(5)}>Another player finishes / clock advances to game 5</button>
    <button onClick={() => setGames([6, 5, 4, 3, 2, 1])}>Refresh reordered rounds</button>
    <button onClick={() => setGames([])}>Temporary empty refresh</button>
    <button onClick={() => setGames(initialGames)}>Restore rounds</button>
    <button onClick={() => setGeneration(value => value + 1)}>Remount view</button>
    <button onClick={() => setEvent(value => value === 'first' ? 'second' : 'first')}>Switch competition</button>
    <button onClick={() => {
      localStorage.setItem(key, '6')
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: '6' }))
    }}>Other tab selects game 6</button>
    <button onClick={() => {
      const surface = document.querySelector('.tv-game-carousel')!
      for (const [name, x] of [['touchstart', 200], ['touchend', 20]] as const) {
        const event = new Event(name, { bubbles: true })
        Object.defineProperty(event, 'changedTouches', { value: [{ clientX: x, clientY: 100 }] })
        Object.defineProperty(event, 'touches', { value: [{ clientX: x, clientY: 100 }] })
        surface.dispatchEvent(event)
      }
    }}>Swipe across card</button>
    <TvGameCarousel key={generation} gameNumbers={[...games]} activeGameNumber={liveGame}
      persistenceKey={key} t={t} renderGame={(game, nav) => <section>
        <h1>Viewing game {game}</h1>
        <button onClick={nav.onPrev} disabled={nav.atStart}>Previous game</button>
        <button onClick={nav.onNext} disabled={nav.atEnd}>Next game</button>
        <label>Score draft <input aria-label="Score draft" /></label>
      </section>} />
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
