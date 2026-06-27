import { formatGameScore } from '../lib/tennisScore'
import type { GameLogPoint } from '../lib/gameLogSerialize'

type Props = {
  points?: GameLogPoint[]
  compact?: boolean
}

function pointLine(point: GameLogPoint): string {
  const score = point.scoreAfter
  const games = `${score.gamesA}-${score.gamesB}`
  const pts = formatGameScore(score)
  return `${games} · ${pts}`
}

export function LiveScoreFeed({ points, compact = false }: Props) {
  if (!points?.length) return null
  const recent = points.slice(-5).reverse()
  return (
    <div
      className={`space-y-0.5 ${compact ? 'px-1 py-0.5' : 'px-2 py-1'}`}
      aria-label="Live score history"
    >
      {recent.map((point, index) => (
        <p
          key={`${point.at}-${index}`}
          className={`truncate text-center font-medium tabular-nums text-brand-muted dark:text-white/55 ${
            compact ? 'text-[9px]' : 'text-[10px] md:text-xs'
          }`}
        >
          {pointLine(point)}
        </p>
      ))}
    </div>
  )
}
