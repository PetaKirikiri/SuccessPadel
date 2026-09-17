# Singles / duos ownership contract

This is separate from the mobile/tablet/web/TV contract. A change has BOTH a
format scope and a viewport scope. Format means rotating individual standings
versus fixed-pair team standings, not the friendly/competition route kind.

## Enforced now

- `src/lib/competition-formats/singles/` owns individual standings validation.
- `src/lib/competition-formats/duos/` owns fixed-pair roster and team standings validation.
- `contract.ts` is protected shared infrastructure: discriminated formats, required
  duo identities/names, and duplicate/mixed-response rejection.
- Competition play chooses the format before choosing scores. Duos cannot fall
  through to individual/manual/gesture standings when pair data is missing.
- Both competition leaderboard presentations receive an explicit format. A duo
  result must have the expected number of complete teams, including zero scores.
- `src/layouts/competition-formats/duos/leaderboard.css` owns extracted duo rules.
  All selectors must be anchored to the duo root. Viewport selectors remain
  necessary for screen-specific changes.
- `src/components/competition-formats/singles/SinglesRoster.tsx` and
  `duos/DuosRoster.tsx` own their separate attendance presentations. The shared
  `CompetitionRoster.tsx` router requires a discriminated contract: singles gets
  players plus drag controls, duos gets two-person tuples, not an arbitrary list.
- Eight `src/layouts/competition-formats/{singles,duos}/roster.{mobile,tablet,web,tv}.css`
  files own roster appearance. Both format and viewport guards apply. Moving
  roster selectors back into any shared stylesheet fails the build.
- Format modules' imports and re-exports are parsed, including dynamic imports.
  Opposite-format imports, computed imports and unreviewed shared dependencies
  are rejected. Attendance saving/auth remain in the shared controller; neither
  roster presenter imports a database client or authorization hook.
- Builds run format boundary checks and regression tests. PRs require one
  `format:singles`, `format:duos`, or `format:shared` label in addition to the
  viewport label. Format-only edits cannot modify unknown/shared paths.

Commands: `npm run check:formats`, `npm run test:formats`, and before a
format-only commit `npm run check:formats -- --scope duos --staged` (or singles).
Do not relabel a failed format-only edit as shared without explicit user approval.

## Not yet isolated

Court renderer, setup, shared leaderboard shell/primitives, and invite shell CSS
remain shared. Such changes fail a format-only scope declaration and require
review of both formats. These are NOT two fully independent applications.
Legacy format defaults and competition-specific artwork remain for compatibility;
no historical competition configuration was rewritten during this migration.

The repository owner must require PRs and the layout-integrity job and disable
direct-push bypasses to make this a merge barrier. Local files cannot activate
GitHub protections. No claim of absolute immutability is made.

Next migration: format-owned court presentation modules, persistent theme
configuration, and approved screenshot baselines for both formats in all four
viewports. Preserve shared auth, persistence, scoring primitives and timing authority.

## Roster extraction verification (2026-09-12)

The local fixture at `/tests/competition-formats/index.html?format=duos` (or
`singles`) renders deterministic sample players. Attendance is in-memory only;
it does not load or save competition data. This is a Vite test entry, not a
production app route.

With Vite running, `node scripts/verify-format-rosters.mjs` runs all eight
format/viewport combinations and tests confirm → pending → cannot-play → pending,
stable player/team counts, anonymous drag restrictions and horizontal overflow.
Set `AGENT_BROWSER_BIN` if the browser CLI is not on PATH. The script closes its
own isolated browser session; it does not use the organiser's signed-in browser.

Compared before/after computed appearance at 390×844, 834×1112, 1280×900 and
1920×1080 for both formats: all 904 sampled elements retained their positions,
sizes and sampled visual properties. This proves the extraction preserved the
fixture layout, not that every surrounding header/shell is visually approved.
