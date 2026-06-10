import type { CSSProperties } from 'react'
import { pct } from '../lib/padelCourtLayout'
import type { TeamHalf } from '../lib/courtHalfCapture'
import { PadelCourtMarkings } from './PadelCourtMarkings'
import { PadelCourtEnclosure } from './PadelCourtEnclosure'
import { SHOT_KIND_COLOR, type DepthZoneStat, type HeatMapDot } from '../lib/heatMapStats'

const COURT_INSET = 'inset-[7%] sm:inset-[8%]'
const COURT_ASPECT_BOX = 'relative h-full max-w-full aspect-[10/20]'

const BAND_HEIGHT = 0.5 / 3

const ZONE_FILL = ['rgba(251,146,60,0.22)', 'rgba(52,211,153,0.22)', 'rgba(96,165,250,0.22)']

function bandTop(half: TeamHalf, index: number): number {
  return half === 'top' ? 0.5 - (index + 1) * BAND_HEIGHT : 0.5 + index * BAND_HEIGHT
}

function dotStyle(dot: HeatMapDot): CSSProperties {
  const color = dot.kind ? SHOT_KIND_COLOR[dot.kind] : '#cbd5e1'
  const filled = dot.outcome !== 'foul'
  return {
    left: pct(dot.x),
    top: pct(dot.y),
    backgroundColor: filled ? color : 'transparent',
    borderColor: color,
  }
}

type Props = {
  dots: HeatMapDot[]
  zones: DepthZoneStat[]
  half: TeamHalf
}

export function HeatMapCourt({ dots, zones, half }: Props) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#1e6bb5] via-[#1a5fa8] to-[#165a9c]">
      <div className={`absolute ${COURT_INSET} flex items-center justify-center`}>
        <div className={COURT_ASPECT_BOX}>
          <PadelCourtEnclosure />
          <div className="absolute inset-0">
            <PadelCourtMarkings />

            {zones.map((zone, index) => {
              const top = bandTop(half, index)
              return (
                <div
                  key={zone.id}
                  className="absolute inset-x-0 flex items-center justify-center"
                  style={{
                    top: pct(top),
                    height: pct(BAND_HEIGHT),
                    backgroundColor: ZONE_FILL[index],
                  }}
                >
                  <span className="rounded-full bg-black/45 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                    {zone.pct}%
                  </span>
                </div>
              )
            })}

            {dots.map((dot, index) => (
              <span
                key={index}
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow"
                style={dotStyle(dot)}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
