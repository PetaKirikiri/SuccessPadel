import type { PlayerStatsSnapshot } from '../lib/matchSessionLog'
import type { ShotTypeGroup } from '../lib/playerGameStats'
import type { DepthZoneStat, DepthZoneId, ServeStat } from '../lib/heatMapStats'
import { useTranslation } from '../hooks/useTranslation'

const SHOT_TYPE_ORDER: ShotTypeGroup[] = ['smash', 'forehand', 'backhand', 'volley']

const SHOT_GROUP_KEY: Record<ShotTypeGroup, string> = {
  smash: 'stats.kindSmash',
  forehand: 'stats.kindForehand',
  backhand: 'stats.kindBackhand',
  volley: 'stats.kindVolley',
}

const ZONE_KEY: Record<DepthZoneId, string> = {
  net: 'stats.zoneNet',
  mid: 'stats.zoneMid',
  back: 'stats.zoneBack',
}

function Donut({
  percent,
  color,
  center,
  caption,
}: {
  percent: number
  color: string
  center: string
  caption: string
}) {
  const deg = Math.max(0, Math.min(100, percent)) * 3.6
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative h-24 w-24 rounded-full"
        style={{ background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.12) 0deg)` }}
      >
        <div className="absolute inset-[16%] flex flex-col items-center justify-center rounded-full bg-[#0e2c4d]">
          <span className="text-xl font-bold text-white tabular-nums">{center}</span>
        </div>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
        {caption}
      </span>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">{title}</h3>
      {children}
    </div>
  )
}

type Props = {
  stats: PlayerStatsSnapshot | null
  serve: ServeStat
  zones: DepthZoneStat[]
}

export function HeatMapStatPanels({ stats, serve, zones }: Props) {
  const { t } = useTranslation()

  if (!stats || stats.totalShots === 0) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-center text-sm text-white/70">
        {t('stats.noPlayerShots')}
      </div>
    )
  }

  const judged = stats.scored + stats.fouls
  const servePct = serve.total > 0 ? Math.round((serve.won / serve.total) * 100) : 0
  const maxType = Math.max(
    1,
    ...SHOT_TYPE_ORDER.map((type) => stats.byType[type].scored + stats.byType[type].foul),
  )

  return (
    <div className="flex flex-col gap-4">
      <Card title={t('stats.accuracy')}>
        <div className="flex items-center justify-around gap-4">
          <Donut
            percent={stats.successRate}
            color="#34d399"
            center={`${stats.successRate}%`}
            caption={t('stats.success')}
          />
          <div className="flex flex-col gap-1 text-sm text-white">
            <span><span className="font-bold tabular-nums">{stats.scored}</span> {t('stats.scored')}</span>
            <span><span className="font-bold tabular-nums">{stats.fouls}</span> {t('stats.fouls')}</span>
            <span className="text-white/60"><span className="font-bold tabular-nums">{stats.totalShots}</span> {t('stats.totalShots')}</span>
            <span className="text-white/60"><span className="font-bold tabular-nums">{judged}</span> {t('stats.judged')}</span>
          </div>
        </div>
      </Card>

      <Card title={t('stats.shotDistribution')}>
        <div className="flex flex-col gap-2">
          {SHOT_TYPE_ORDER.map((type) => {
            const cell = stats.byType[type]
            const total = cell.scored + cell.foul
            return (
              <div key={type} className="flex items-center gap-2 text-sm text-white">
                <span className="w-20 shrink-0 text-white/80">{t(SHOT_GROUP_KEY[type])}</span>
                <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/80"
                    style={{ width: `${(cell.scored / maxType) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 rounded-full bg-rose-400/70"
                    style={{
                      left: `${(cell.scored / maxType) * 100}%`,
                      width: `${(cell.foul / maxType) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{total}</span>
              </div>
            )
          })}
          <div className="mt-1 flex gap-4 text-[11px] text-white/60">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400/80" />{t('stats.legendScored')}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400/70" />{t('stats.legendFoul')}</span>
          </div>
        </div>
      </Card>

      <Card title={t('stats.servePoints')}>
        <div className="flex items-center justify-around gap-4">
          <Donut
            percent={servePct}
            color="#60a5fa"
            center={`${servePct}%`}
            caption={t('stats.won')}
          />
          <div className="flex flex-col gap-1 text-sm text-white">
            <span><span className="font-bold tabular-nums">{serve.won}</span> {t('stats.won')}</span>
            <span><span className="font-bold tabular-nums">{serve.lost}</span> {t('stats.lost')}</span>
            <span className="text-white/60"><span className="font-bold tabular-nums">{serve.total}</span> {t('stats.servePointsLower')}</span>
          </div>
        </div>
      </Card>

      <Card title={t('stats.courtCoverage')}>
        <div className="flex flex-col gap-2">
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center gap-2 text-sm text-white">
              <span className="w-24 shrink-0 text-white/80">{t(ZONE_KEY[zone.id])}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-sky-400/80"
                  style={{ width: `${zone.pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{zone.pct}%</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
