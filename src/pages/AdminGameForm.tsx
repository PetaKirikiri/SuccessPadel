import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PairBuilder, type PairDraft } from '../components/PairBuilder'
import { PlayerRosterPicker } from '../components/PlayerRosterPicker'
import { ScoringPresetPicker } from '../components/ScoringPresetPicker'
import { supabase } from '../lib/supabaseClient'
import type { GameSession, PartnershipMode, Profile, ScoringPreset, Season, WhoCanLog } from '../lib/types'

type Props = { donePath?: string }

export function AdminGameForm({ donePath = '/admin/games' }: Props) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [title, setTitle] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [partnershipMode, setPartnershipMode] = useState<PartnershipMode>('rotating')
  const [scoringPreset, setScoringPreset] = useState<ScoringPreset>('standard')
  const [marginBonus, setMarginBonus] = useState(true)
  const [customWin, setCustomWin] = useState(3)
  const [customLoss, setCustomLoss] = useState(1)
  const [whoCanLog, setWhoCanLog] = useState<WhoCanLog>('roster_members')
  const [rosterIds, setRosterIds] = useState<string[]>([])
  const [pairs, setPairs] = useState<PairDraft[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.all([
      supabase.from('seasons').select('*').order('starts_on', { ascending: false }),
      supabase.from('profiles').select('*').order('display_name'),
    ]).then(([s, p]) => {
      const seasonRows = (s.data as Season[]) ?? []
      setSeasons(seasonRows)
      setProfiles((p.data as Profile[]) ?? [])
      const active = seasonRows.find((x) => x.is_active)
      if (active) setSeasonId(active.id)
    })
  }, [])

  useEffect(() => {
    if (!id) return
    void supabase
      .from('game_sessions')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        const g = data as GameSession
        if (!g) return
        setTitle(g.title)
        setSeasonId(g.season_id ?? '')
        setStartsOn(g.starts_on)
        setEndsOn(g.ends_on)
        setPartnershipMode(g.partnership_mode)
        setScoringPreset(g.scoring_preset)
        setMarginBonus(g.margin_bonus_enabled)
        setWhoCanLog(g.who_can_log_matches)
        const { data: sp } = await supabase
          .from('session_players')
          .select('profile_id')
          .eq('session_id', id)
        setRosterIds((sp ?? []).map((r: { profile_id: string }) => r.profile_id))
        const { data: pr } = await supabase.from('session_pairs').select('*').eq('session_id', id)
        setPairs(
          (pr ?? []).map((row: { pair_label: string | null; player_a_id: string; player_b_id: string }) => ({
            pair_label: row.pair_label ?? undefined,
            player_a_id: row.player_a_id,
            player_b_id: row.player_b_id,
          })),
        )
      })
  }, [id])

  const save = async (openAfter: boolean) => {
    setBusy(true)
    const scoring_config =
      scoringPreset === 'custom' ? { win_points: customWin, loss_points: customLoss } : {}
    const payload = {
      season_id: seasonId,
      title,
      starts_on: startsOn,
      ends_on: endsOn,
      status: openAfter ? 'open' : 'draft',
      partnership_mode: partnershipMode,
      scoring_preset: scoringPreset,
      scoring_config,
      who_can_log_matches: whoCanLog,
      margin_bonus_enabled: marginBonus,
      game_kind: 'competition' as const,
    }

    let sessionId = id
    if (id) {
      await supabase.from('game_sessions').update(payload).eq('id', id)
      await supabase.from('session_players').delete().eq('session_id', id)
      await supabase.from('session_pairs').delete().eq('session_id', id)
    } else {
      const { data, error } = await supabase.from('game_sessions').insert(payload).select('id').single()
      if (error || !data) {
        setBusy(false)
        return
      }
      sessionId = data.id
    }

    if (sessionId) {
      await supabase.from('session_players').insert(
        rosterIds.map((profile_id) => ({ session_id: sessionId, profile_id })),
      )
      if (partnershipMode === 'fixed_pairs' && pairs.length > 0) {
        await supabase.from('session_pairs').insert(
          pairs.map((p) => ({
            session_id: sessionId,
            pair_label: p.pair_label ?? null,
            player_a_id: p.player_a_id,
            player_b_id: p.player_b_id,
          })),
        )
      }
    }
    setBusy(false)
    navigate(donePath)
  }

  const rosterProfiles = profiles.filter((p) => rosterIds.includes(p.id))

  return (
    <div className="space-y-4 pb-8">
      <h2 className="text-xl font-semibold">{id ? 'Edit game' : 'New game'}</h2>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Week title"
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
        aria-label="Title"
      />
      <select
        value={seasonId}
        onChange={(e) => setSeasonId(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
        aria-label="Season"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          aria-label="Starts"
        />
        <input
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          aria-label="Ends"
        />
      </div>
      <select
        value={partnershipMode}
        onChange={(e) => setPartnershipMode(e.target.value as PartnershipMode)}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
        aria-label="Partnership mode"
      >
        <option value="rotating">Rotating partners</option>
        <option value="fixed_pairs">Fixed pairs</option>
        <option value="americano">Americano</option>
      </select>
      <ScoringPresetPicker
        value={scoringPreset}
        onChange={setScoringPreset}
        marginBonus={marginBonus}
        onMarginBonusChange={setMarginBonus}
        customWin={customWin}
        customLoss={customLoss}
        onCustomWin={setCustomWin}
        onCustomLoss={setCustomLoss}
      />
      <select
        value={whoCanLog}
        onChange={(e) => setWhoCanLog(e.target.value as WhoCanLog)}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
        aria-label="Who can log"
      >
        <option value="roster_members">Roster members</option>
        <option value="any_member">Any member</option>
        <option value="admin_only">Admin only</option>
      </select>
      <div>
        <p className="mb-2 text-sm text-zinc-600">Roster</p>
        <PlayerRosterPicker profiles={profiles} selected={rosterIds} onChange={setRosterIds} />
      </div>
      {partnershipMode === 'fixed_pairs' && rosterProfiles.length >= 2 && (
        <div>
          <p className="mb-2 text-sm text-zinc-600">Pairs</p>
          <PairBuilder roster={rosterProfiles} pairs={pairs} onChange={setPairs} />
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !title || rosterIds.length < 2}
          onClick={() => void save(false)}
          className="flex-1 rounded-lg border border-zinc-300 py-2.5 text-sm"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={busy || !title || rosterIds.length < 4}
          onClick={() => void save(true)}
          className="flex-1 rounded-lg brand-btn py-2.5 text-sm font-medium"
        >
          Open game
        </button>
      </div>
    </div>
  )
}
