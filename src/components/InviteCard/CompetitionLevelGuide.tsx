import { useEffect, useRef, useState } from 'react'
import { Repeat2, MoveUpRight, PanelsTopLeft, UsersRound, CircleHelp } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { competitionLevelLabel } from '../../lib/competitionLevel'
import type { CompetitionRow } from '../../hooks/useCompetitions'

type Guide = {
  level_code: string
  summary: string
  self_checks: { area: string; text: string }[]
  next_level_focus: string
  image_url: string
  image_alt: string
  padel_skill_levels: { name: string; rank: number; storage_value: string }
}

// Versioned presentation artwork replaces the original abstract court diagrams.
const levelArtwork: Record<string, { src: string; alt: string; caption: string }> = {
  beginner: {
    src: '/level-guides/beginner-return-v2.png',
    alt: 'A beginner preparing a basic return after the ball bounces.',
    caption: 'Learning a basic return',
  },
  low_inter: {
    src: '/level-guides/low-inter-glass-v2.png',
    alt: 'A player preparing to return a ball rebounding from the back glass.',
    caption: 'Starting to use the back glass',
  },
}

const skillIcons = {
  Rallies: Repeat2,
  'Serve & return': MoveUpRight,
  Glass: PanelsTopLeft,
  Positioning: UsersRound,
}

export function CompetitionLevelGuide({ row, onClose }: { row: CompetitionRow; onClose: () => void }) {
  const [guides, setGuides] = useState<Guide[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const level = competitionLevelLabel(row)
  const min = row.skill_level_min_rank
  const max = row.skill_level_max_rank
  const legacy = row.skill_level
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    void (async () => {
      const { data, error: queryError } = await supabase.from('padel_skill_level_guides')
        .select('level_code, summary, self_checks, next_level_focus, image_url, image_alt, padel_skill_levels!inner(name, rank, storage_value)')
        .eq('locale', 'en').eq('status', 'published')
      if (!active) return
      if (queryError) { setError(true); setLoading(false); return }
      const available = ((data ?? []) as unknown as Guide[]).filter(guide => {
        const level = guide.padel_skill_levels
        return min != null && max != null
          ? level.rank >= min && level.rank <= max
          : !legacy || legacy === 'Open' || level.storage_value === legacy || level.name === legacy
      }).sort((a, b) => a.padel_skill_levels.rank - b.padel_skill_levels.rank)
      setGuides(available)
      setSelected(available[0]?.level_code ?? '')
      setLoading(false)
    })().catch(() => { if (active) { setError(true); setLoading(false) } })
    return () => { active = false }
  }, [min, max, legacy, retry])

  return <section className="competition-level-guide" id={`level-guide-${row.id}`} aria-labelledby={`level-guide-title-${row.id}`}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header className="competition-level-guide__header">
      <div>
        <h2 id={`level-guide-title-${row.id}`} ref={heading} tabIndex={-1}>Is this your level?</h2>
      </div>
      <button type="button" className="competition-level-guide__back" aria-label="Back to players" onClick={onClose}>← Back</button>
    </header>
    {loading ? <p role="status">Loading level guide…</p> : error ? <div role="alert">Couldn’t load the guide. <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : guides.length === 0 ? <p>The {level} guide is being prepared.</p> : <>
      <div className="competition-level-guide__tabs" role="group" aria-label="Choose a level">
        {guides.map(guide => <button type="button" key={guide.level_code} aria-pressed={selected === guide.level_code}
          aria-controls={`level-${row.id}-${guide.level_code}`} onClick={() => setSelected(guide.level_code)}>{guide.padel_skill_levels.name}</button>)}
      </div>
      <div className="competition-level-guide__cards">
        {guides.map(guide => <article key={guide.level_code} id={`level-${row.id}-${guide.level_code}`}
          className="competition-level-guide__card" data-active={selected === guide.level_code}>
          <div className="competition-level-guide__intro">
            <h3>{guide.padel_skill_levels.name}</h3>
          </div>
          <figure className="competition-level-guide__illustration">
            <img src={levelArtwork[guide.level_code]?.src ?? guide.image_url}
              alt={levelArtwork[guide.level_code]?.alt ?? guide.image_alt} decoding="async" />
            {levelArtwork[guide.level_code] && <figcaption>{levelArtwork[guide.level_code].caption}</figcaption>}
          </figure>
          <dl>{guide.self_checks.map(check => {
            const Icon = skillIcons[check.area as keyof typeof skillIcons] ?? CircleHelp
            return <div key={check.area} data-skill={check.area}>
              <dt><Icon className="competition-level-guide__skill-icon" aria-hidden="true" /><span>{check.area}</span></dt>
              <dd>{check.text}</dd>
            </div>
          })}</dl>
        </article>)}
      </div>
    </>}
  </section>
}
