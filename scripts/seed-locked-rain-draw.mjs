// Run with a privileged database connection; never regenerate this operational draw.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
export function lockedRainSeedSql() {
  const draw = JSON.parse(readFileSync(new URL('../src/surfaces/rain-test/rain-draw-2026-10-07.json', import.meta.url), 'utf8'))
  const contentHash = createHash('sha256').update(JSON.stringify({ players: draw.players.map(p => [p.name, p.rosterId]), courtLabels: draw.courtLabels, courtIds: draw.courtIds, rounds: draw.rounds })).digest('hex')
  if (contentHash !== '3430ceae195231c2663071c76d73fecea8e8f21d381c0e2cbdfeb54262e36e90') throw new Error('Refusing to seed a changed draw')
  // Preserve the original score-ledger identity after the approved timing amendment.
  const fingerprint = 'acdca2fd5eeca552f1da8558689f990f91bca9ae22e60ea85215ab1cef5dcdc0'
  const literal = JSON.stringify(draw).replaceAll("'", "''")
  return `
    insert into public.rain_mode_draws(session_id,fingerprint,draw)
      values ('${draw.competitionId}','${fingerprint}','${literal}'::jsonb)
      on conflict (session_id) do nothing;
    do $$ begin
      if not exists (select 1 from public.rain_mode_draws where session_id='${draw.competitionId}' and fingerprint='${fingerprint}' and draw='${literal}'::jsonb) then
        raise exception 'Existing rain draw differs. Nothing will be replaced.';
      end if;
    end $$;
    insert into public.rain_mode_scores(session_id,game_number,court_slot)
      select '${draw.competitionId}', g, c from generate_series(1,9) g cross join generate_series(1,2) c
      on conflict (session_id,game_number,court_slot) do nothing;
  `
}
