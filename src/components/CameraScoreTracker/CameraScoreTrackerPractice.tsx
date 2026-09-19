import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GestureCameraEngine, gestureScoreBeep, type FingerScoreAction } from '../../lib/gestureFingerDetect'
import { useGesturePadChrome } from '../../lib/gesturePadChrome'

import { ThumbScorePadView } from './ThumbScorePadView'

type PadAction = 'win' | 'lose' | 'undo' | 'reset'
type Status = 'idle' | 'loading' | 'running' | 'unsupported' | 'error'
type Team = 'us' | 'them'
type ScoreSnapshot = {
  ourPoints: number
  theirPoints: number
  ourGames: number
  theirGames: number
}
type GestureScoreLocationState = {
  cameraError?: string
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function padActionFromEngine(action: FingerScoreAction): PadAction | null {
  if (action === 'team1') return 'win'
  if (action === 'team2') return 'lose'
  if (action === 'undo') return 'undo'
  if (action === 'reset') return 'reset'
  return null
}

export function GestureScorePadPage() {
  useGesturePadChrome()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as GestureScoreLocationState | null
  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<GestureCameraEngine | null>(null)
  const applyPadActionRef = useRef<(action: PadAction) => void>(() => {})
  const scoreRef = useRef<ScoreSnapshot>({ ourPoints: 0, theirPoints: 0, ourGames: 0, theirGames: 0 })
  const historyRef = useRef<ScoreSnapshot[]>([])

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [ourPoints, setOurPoints] = useState(0)
  const [theirPoints, setTheirPoints] = useState(0)
  const [ourGames, setOurGames] = useState(0)
  const [theirGames, setTheirGames] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const applyScoreSnapshot = (snapshot: ScoreSnapshot) => {
    scoreRef.current = snapshot
    setOurPoints(snapshot.ourPoints)
    setTheirPoints(snapshot.theirPoints)
    setOurGames(snapshot.ourGames)
    setTheirGames(snapshot.theirGames)
  }

  const pushScoreSnapshot = () => {
    historyRef.current = [...historyRef.current.slice(-19), { ...scoreRef.current }]
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
    if (action === 'reset') {
      pushScoreSnapshot()
      applyScoreSnapshot({ ourPoints: 0, theirPoints: 0, ourGames: 0, theirGames: 0 })
    } else if (action === 'undo') {
      undoLastAction()
    } else {
      applyPadelPoint(action === 'win' ? 'us' : 'them')
    }
    engineRef.current?.markScoreCommitted(performance.now(), action === 'win' ? 'team1' : action === 'lose' ? 'team2' : action)
    gestureScoreBeep()
  }

  applyPadActionRef.current = applyPadAction

  useEffect(() => {
    if (routeState?.cameraError) {
      setStatus('error')
      setError(routeState.cameraError)
      return
    }

    const video = videoRef.current
    if (!video) return

    const engine = new GestureCameraEngine({
      video,
      gestureMode: 'thumbs',
      onFire: (action) => {
        const pad = padActionFromEngine(action)
        if (pad) applyPadActionRef.current(pad)
      },
      onStatus: setStatus,
      onError: setError,
    })
    engineRef.current = engine

    return () => {
      engine.stop()
      engineRef.current = null
    }
  }, [routeState?.cameraError])

  useEffect(() => {
    const startedAt = Date.now()
    const tick = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(tick)
  }, [])

  const goBack = () => {
    engineRef.current?.stop()
    if (window.history.length > 1) navigate(-1)
    else navigate('/friendly')
  }

  const restartCamera = () => {
    setError(null)
    void engineRef.current?.restart()
  }

  return <ThumbScorePadView
    videoRef={videoRef} status={status} error={error}
    ourPoints={ourPoints} theirPoints={theirPoints} ourGames={ourGames} theirGames={theirGames}
    timerValue={formatTimer(elapsedSeconds)} restartCamera={restartCamera} goBack={goBack}
    onWin={() => applyPadAction('win')} onLose={() => applyPadAction('lose')}
    onUndo={() => applyPadAction('undo')} onReset={() => applyPadAction('reset')}
  />
}
