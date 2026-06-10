import type { InsightCard } from '../lib/heatMapStats'

export function HeatMapInsightCards({ cards }: { cards: InsightCard[] }) {
  if (!cards.length) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {cards.map((card, index) => (
        <div
          key={`${card.label}-${index}`}
          className="min-w-[7rem] shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2"
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/55">
            {card.label}
          </p>
          <p className="text-base font-bold leading-tight">{card.value}</p>
          {card.hint ? (
            <p className="truncate text-[10px] text-white/45">{card.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
