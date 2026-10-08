import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { TvGameCarousel } from '../../src/components/GameCard/TvGameCarousel'
import { scheduledTvGame } from '../../src/lib/scheduledTvGame'
import type { TranslateFn } from '../../src/i18n'

// An isolated clock-controlled fixture. Never loads or writes competition data.
const games = [1, 2, 3]
const times = new Map([
  [1, { startsAt: 100, endsAt: 200 }],
  [2, { startsAt: 250, endsAt: 350 }],
  [3, { startsAt: 400, endsAt: 500 }],
])
const t = ((key: string) => key) as TranslateFn
function Fixture() {
  const [clock, setClock] = useState(199)
  const [generation, setGeneration] = useState(0)
  return <main>
    <p>Clock: {clock}</p>
    <button onClick={() => setClock(200)}>Finish game 1</button>
    <button onClick={() => setClock(value => value + 1)}>Tick clock</button>
    <button onClick={() => setClock(450)}>Wake during game 3</button>
    <button onClick={() => setClock(500)}>Finish final game</button>
    <button onClick={() => setGeneration(value => value + 1)}>Remount view</button>
    <TvGameCarousel key={generation} gameNumbers={games} activeGameNumber={1}
      autoGameNumber={scheduledTvGame(clock, games, times)}
      persistenceKey="navigation-regression:auto" t={t}
      renderGame={(game, nav) => <section>
        <h1>Viewing game {game}</h1>
        <button onClick={nav.onPrev} disabled={nav.atStart}>Previous game</button>
        <button onClick={nav.onNext} disabled={nav.atEnd}>Next game</button>
      </section>} />
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
