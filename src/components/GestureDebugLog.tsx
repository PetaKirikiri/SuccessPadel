import { useMemo, useState } from 'react'
import {
  distinctPatternKeys,
  exportGestureDebugLogJson,
  groupByCode,
  type GestureDebugEntry,
} from '../lib/gestureDebugLog'

type Props = {
  entries: GestureDebugEntry[]
  onClear: () => void
  onClose?: () => void
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

export function GestureDebugLog({ entries, onClear, onClose }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const codeGroups = useMemo(() => groupByCode(entries), [entries])
  const ambiguousCodes = useMemo(() => {
    return [...codeGroups.entries()]
      .filter(([, list]) => distinctPatternKeys(list).length > 1)
      .map(([code]) => code)
  }, [codeGroups])

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(exportGestureDebugLogJson(entries))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy debug log:', exportGestureDebugLogJson(entries))
    }
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Debug log</p>
        <p className="mt-1 text-xs text-brand-muted">Gestures will be logged here for pattern study.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-brand-bg-alt/40">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
            Debug log ({entries.length})
          </p>
          {ambiguousCodes.length > 0 ? (
            <p className="text-[10px] text-amber-700">
              {ambiguousCodes.length} code{ambiguousCodes.length === 1 ? '' : 's'} with multiple patterns:{' '}
              {ambiguousCodes.join(', ')}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void copyAll()}
            className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-[10px] font-semibold text-brand-primary"
          >
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-[10px] font-semibold text-brand-muted"
          >
            Clear
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1 text-[10px] font-semibold text-brand-primary"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ul className="space-y-2">
          {entries.map((entry) => {
            const expanded = openId === entry.id
            const sameCodeVariants = entries.filter((e) => e.code === entry.code).length
            const sameCodePatterns = distinctPatternKeys(entries.filter((e) => e.code === entry.code))

            return (
              <li key={entry.id} className="rounded-xl border border-brand-border bg-brand-surface">
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : entry.id)}
                  className="w-full px-3 py-2 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-brand-primary">{entry.report}</p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-brand-muted">
                        {entry.patternKey}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-brand-muted">
                      {formatTime(entry.at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-brand-muted">
                    Δx {entry.xSpread} · Δy {entry.ySpread} · straight {entry.straightness} ·{' '}
                    {entry.durationMs}ms · {entry.direction} {entry.angleDeg}°
                  </p>
                  {sameCodeVariants > 1 && sameCodePatterns.length > 1 ? (
                    <p className="mt-1 text-[10px] font-medium text-amber-700">
                      Same code, {sameCodePatterns.length} different patterns
                    </p>
                  ) : null}
                </button>
                {expanded ? (
                  <pre className="max-h-48 overflow-auto border-t border-brand-border/60 px-3 py-2 text-[10px] leading-relaxed text-brand-text">
                    {JSON.stringify(entry, null, 2)}
                  </pre>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
