import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gestureScoreBeep } from '../../lib/gestureFingerDetect'
import { useGesturePadChrome } from '../../lib/gesturePadChrome'

import { ThumbScorePadView } from './ThumbScorePadView'

type PadAction = 'win' | 'lose' | 'undo' | 'reset'
type Team = 'us' | 'them'
type ScoreSnapshot = {
  ourPoints: number
  theirPoints: number
  ourGames: number
  theirGames: number
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function ClickerScoreboardPage() {
  useGesturePadChrome()
  const navigate = useNavigate()
  const [initialScore] = useState<ScoreSnapshot>(() => {
    const preview = new URLSearchParams(window.location.search).get('preview') === '3-4'
    return { ourPoints: preview ? 3 : 0, theirPoints: preview ? 3 : 0, ourGames: preview ? 3 : 0, theirGames: preview ? 4 : 0 }
  })
  const firstServer = useRef<Team | null>(new URLSearchParams(window.location.search).get('preview') === '3-4' ? 'them' : null)
  const [openingServer, setOpeningServer] = useState(firstServer.current)
  const scoreRef = useRef(initialScore)
  const rallyHistory = useRef<(Team | 'reset')[]>([])
  const historyRef = useRef<ScoreSnapshot[]>([])

  const [ourPoints, setOurPoints] = useState(initialScore.ourPoints)
  const [theirPoints, setTheirPoints] = useState(initialScore.theirPoints)
  const [ourGames, setOurGames] = useState(initialScore.ourGames)
  const [theirGames, setTheirGames] = useState(initialScore.theirGames)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const applyScoreSnapshot = (snapshot: ScoreSnapshot) => {
    scoreRef.current = snapshot
    setOurPoints(snapshot.ourPoints)
    setTheirPoints(snapshot.theirPoints)
    setOurGames(snapshot.ourGames)
    setTheirGames(snapshot.theirGames)
  }

  const pushScoreSnapshot = () => {
    historyRef.current = [...historyRef.current, { ...scoreRef.current }]
  }

  const undoLastAction = () => {
    const previous = historyRef.current[historyRef.current.length - 1]
    if (!previous) return
    historyRef.current = historyRef.current.slice(0, -1)
    applyScoreSnapshot(previous)
  }

  const applyPadelPoint = (winner: Team): void => {
    const ourWon = winner === 'us'
    const current = scoreRef.current
    const winnerPoints = ourWon ? current.ourPoints : current.theirPoints
    const gameWon = winnerPoints >= 3
    pushScoreSnapshot()

    if (gameWon) {
      applyScoreSnapshot({
        ourPoints: 0,
        theirPoints: 0,
        ourGames: current.ourGames + (ourWon ? 1 : 0),
        theirGames: current.theirGames + (ourWon ? 0 : 1),
      })
      return
    }

    const nextWinnerPoints = winnerPoints + 1
    applyScoreSnapshot({
      ...current,
      ourPoints: ourWon ? nextWinnerPoints : current.ourPoints,
      theirPoints: ourWon ? current.theirPoints : nextWinnerPoints,
    })
  }

  const applyPadAction = (action: PadAction) => {
    if (!firstServer.current && (action === 'win' || action === 'lose')) {
      firstServer.current = action === 'win' ? 'us' : 'them'
      setOpeningServer(firstServer.current)
      return
    }
    if (action === 'undo') rallyHistory.current.pop()
    else rallyHistory.current.push(action === 'reset' ? 'reset' : action === 'win' ? 'us' : 'them')
    if (action === 'reset') {
      firstServer.current = null
      setOpeningServer(null)
      rallyHistory.current = []
      historyRef.current = []
      applyScoreSnapshot({ ourPoints: 0, theirPoints: 0, ourGames: 0, theirGames: 0 })
    } else if (action === 'undo') {
      undoLastAction()
    } else {
      applyPadelPoint(action === 'win' ? 'us' : 'them')
    }
    gestureScoreBeep()
  }

  useEffect(() => {
    const startedAt = Date.now()
    const tick = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(tick)
  }, [])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/friendly')
  }

  return <ThumbScorePadView
    serving={openingServer && ((ourGames + theirGames) % 2 === 0 ? openingServer : openingServer === 'us' ? 'them' : 'us')}
    clicker
    remoteScope="clicker"
    onRemote={(ours, subtract) => {
      // The large bottom button belongs to the right-hand team.
      if (!subtract) return applyPadAction(ours ? 'lose' : 'win')
      const rallies = rallyHistory.current
      const index = rallies.lastIndexOf(ours ? 'them' : 'us')
      if (index < 0 || index < rallies.lastIndexOf('reset')) return
      const later = rallies.slice(index + 1)
      applyScoreSnapshot(historyRef.current[index]!)
      historyRef.current.length = index
      rallies.length = index
      for (const team of later) {
        rallies.push(team)
        applyPadelPoint(team === 'us' ? 'us' : 'them')
      }
      gestureScoreBeep()
    }}
    ourPoints={ourPoints} theirPoints={theirPoints} ourGames={ourGames} theirGames={theirGames}
    timerValue={formatTimer(elapsedSeconds)} goBack={goBack}
    onWin={() => applyPadAction('win')} onLose={() => applyPadAction('lose')}
    onUndo={() => applyPadAction('undo')} onReset={() => applyPadAction('reset')}
  />
}
