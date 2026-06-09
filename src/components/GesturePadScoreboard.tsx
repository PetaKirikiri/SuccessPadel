import { formatGameScore, type TennisScore } from '../lib/tennisScore'

type Props = {
  score: TennisScore
}

export function GesturePadScoreboard({ score }: Props) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-0.5 rounded-xl border border-white/35 bg-black/45 px-3 py-2 text-center shadow-sm backdrop-blur-sm">
      <p className="font-display text-xl font-bold leading-none tracking-wide text-white">
        {formatGameScore(score)}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
        Games {score.gamesA}–{score.gamesB} · first to 4
      </p>
    </div>
  )
}
