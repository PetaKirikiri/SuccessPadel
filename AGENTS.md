# Agent notes — Success Padel

## Login strategy

| Surface | Login |
|--------|--------|
| **TestFlight / iOS app** | LINE OAuth via in-app browser → `successpadel://login` deep link. No email for players. |
| **Safari / web** | Tap **Sign In** in bottom nav → scan QR → open in LINE app, or finish OAuth when LINE redirects to `/login?code=…`. No dedicated login page. |
| **LINE app (LIFF)** | QR / reopen link opens `liff.line.me/{LIFF_ID}/friendly` — session restored from cache when possible. |

**Win condition (web):** User taps **Sign In** → scans QR → opens Success Padel in LINE → logged in (cached session or OAuth callback).

**Win condition (native):** LINE OAuth in system browser → deep link back → logged in.

**Do not rely on email/password** for Thai players — most do not register email on LINE. Email sign-in in the modal is for admins/dev only.

**No “Continue with LINE” button** — that flow was removed. `/login` is OAuth callback only; it redirects to `/friendly`.

**Key files:** [`src/components/ProfileChip.tsx`](src/components/ProfileChip.tsx), [`src/components/LineSignInModal.tsx`](src/components/LineSignInModal.tsx), [`src/lib/line/oauth.ts`](src/lib/line/oauth.ts), [`src/components/NativeDeepLinkHandler.tsx`](src/components/NativeDeepLinkHandler.tsx), [`src/components/LineOAuthReturnHandler.tsx`](src/components/LineOAuthReturnHandler.tsx)

**Profile photo from LINE:** Stored in `profiles.avatar_url` on LINE sign-in (OAuth or LIFF auth). Not refreshed on every app open — only when the user signs in again through LINE.

**TestFlight build:** `npm run ios:release` (needs `.env.production.local`)

## White screen (module init)

**Symptom:** Blank page, no React render — often after invite-card / schedule edits.

**Root cause:** Circular imports between `competitionFormatPresets.ts` ↔ `rankedSchedule.ts` (or `lib/` importing `components/`). Constants like `RANKED_AMERICANO_GAMES` live in `src/lib/competitionScheduleConstants.ts` — never import `rankedSchedule` from `competitionFormatPresets`.

**Before shipping schedule/competition changes:** `npm run check:cycles` (also run after touching `persistCompetitionSchedule`, `DuoTeamSlots`, invite roster).

**Never:** import React components from `src/lib/` — use `src/lib/competitionDuoTeams.ts` for shared duo helpers.

## Game card (viewport sizes)

**One game card** for friendly and competition — import `GameCard` from [`src/components/gameCard`](src/components/gameCard), never `ScoringGameCard` / `FriendlyManualGameCard`.

| Size | Viewport | File |
|------|----------|------|
| `mobile` | &lt; 768px | [`GameCardMobile.tsx`](src/components/gameCard/GameCardMobile.tsx) |
| `tablet` | 768–1023px | [`GameCardTablet.tsx`](src/components/gameCard/GameCardTablet.tsx) |
| `web` | 1024–1535px | [`GameCardWeb.tsx`](src/components/gameCard/GameCardWeb.tsx) |
| `tv` | ≥ 1536px | [`GameCardTv.tsx`](src/components/gameCard/GameCardTv.tsx) + [`gameCard.tv.css`](src/components/gameCard/gameCard.tv.css) |

**Rules:** Edit the size-specific file for layout changes. Do not add `tvCompact` or size `if` branches in shared shell/header/courts code. TV court grid / carousel CSS lives in `gameCard.tv.css` only. Hook: [`useGameCardSize`](src/hooks/useGameCardSize.ts). Breakpoints: [`viewBreakpoints.ts`](src/lib/viewBreakpoints.ts).

Run `npm run check:cycles` after changing game card imports.

## App shell (3 layers)

Every normal route stacks the same way:

1. **Paper** — `shell-paper` / `game-bg` ([`Layout.tsx`](src/components/Layout.tsx))
2. **One surface** — invite, settings, game, leaderboard, or profile
3. **Dock** — `shell-dock` / [`AppBottomNav.tsx`](src/components/AppBottomNav.tsx)

Gesture routes use **gesture-shell** (fullscreen, no dock): [`src/surfaces/gesture-score/`](src/surfaces/gesture-score/).

## Viewport & layout (prompt safety)

**Breakpoints** — single source [`src/lib/viewBreakpoints.ts`](src/lib/viewBreakpoints.ts):

| Bucket | Min width | `html[data-viewport]` |
|--------|-----------|------------------------|
| mobile | 0 | `mobile` |
| tablet | 768px | `tablet` |
| web | 1024px | `web` |
| tv | 1536px | `tv` |

[`ViewportProvider`](src/contexts/ViewportContext.tsx) sets `data-viewport` from each device’s real width (phone / tablet / laptop / TV).

**Layout is locked** in [`src/layouts/*.layout.css`](src/layouts/) (listed in `.cursorignore`). Logic tasks must **not** edit `src/layouts/**`. Layout tasks edit **one bucket block** in one layout file only.

| You say | Agent must |
|---------|------------|
| **mobile-only layout** | `src/layouts/<surface>.layout.css` → `html[data-viewport=mobile]` block only |
| **logic only** | TSX / hooks / `src/lib/` — never `src/layouts/` |
| **no kind fork** | Same CSS for friendly + competition; `kind` / `sessionKind` = data only |
| **gesture code only** | `src/lib/gesture*.ts` — no TSX, no layouts |
| **gesture-score layout only** | `gesture-score.layout.css` |

TSX uses **semantic hooks** (`hub-root`, `invite-game-card`, `profile-banner`) — not `md:`/`lg:` for layout forks.

**Unscoped layout ban (invite):** In `invite.layout.css`, only `.invite-game-card { display; width; min-width }` may be unscoped. Every `.invite-game-card__*` rule must live under `html[data-viewport='…']`. `npm run check:layouts` enforces this.

**Per-bucket edits:** Web/tablet invite work → edit `tablet` + `web` blocks only. Mobile invite work → `mobile` block only. Do not add `sm:`/`lg:` layout or sizing on the seven surface TSX files — use layout CSS hooks per bucket.

## Seven surfaces

Never add `Friendly*Card` / `Competition*Card` visual duplicates — `kind` = data only.

| # | Surface | TSX | Layout CSS |
|---|---------|-----|------------|
| 1 | Invite game card | [`InviteGameCard`](src/components/invite/SessionInviteCard.tsx) | `invite.layout.css` |
| 2 | Settings | [`SetupCard`](src/components/setup/SetupCard.tsx) | `settings.layout.css` |
| 3 | Game | [`GameCard`](src/components/gameCard/) | `game-card.layout.css` |
| 4 | Leaderboard | [`Leaderboard`](src/components/leaderboard/Leaderboard.tsx) | `leaderboard.layout.css` |
| 5 | Profile | [`PlayerProfileCard`](src/components/PlayerProfileCard.tsx) | `profile.layout.css` |
| 6 | Court | inside game card | `game-card.layout.css` |
| 7 | Camera / gesture | [`src/surfaces/gesture-score/`](src/surfaces/gesture-score/) + `src/lib/gesture*.ts` | `gesture-pad.layout.css`, `gesture-score.layout.css` |

Hub (`/friendly`, `/competitive`) = paper + list of **InviteGameCard** + gender bar + dock — [`hub.layout.css`](src/layouts/hub.layout.css).

## Five canonical cards (legacy table)

Never add `Friendly*Card` / `Competition*Card` duplicates — use `kind` / `mode` props on one component.

| Card | Path | Notes |
|------|------|-------|
| Invite | [`src/components/invite/`](src/components/invite/) | `InviteGameCard` (`SessionInviteCard` deprecated alias) |
| Game | [`src/components/gameCard/`](src/components/gameCard/) | `GameCard` facade + size variants |
| Leaderboard | [`src/components/leaderboard/Leaderboard.tsx`](src/components/leaderboard/Leaderboard.tsx) | Hub: [`pages/Leaderboard.tsx`](src/pages/Leaderboard.tsx) with `source: 'season' \| 'friendly'` |
| Court | [`src/components/gameCard/CourtCard.tsx`](src/components/gameCard/CourtCard.tsx) | Inside game card + manual score page |
| Setup | [`src/components/setup/SetupCard.tsx`](src/components/setup/SetupCard.tsx) | Shared by friendly + competition forms |

**Hub:** [`src/components/hub/`](src/components/hub/) — `GamesHubView`, `GamesList`. **Play:** [`src/components/play/`](src/components/play/). **Roster:** [`src/components/roster/RosterList.tsx`](src/components/roster/RosterList.tsx).

## Shared component checklist

Before closing any refactor PR:

1. `grep` the old symbol name — expect **zero** hits except the new file.
2. Update **all call sites** (hub + friendly play + competition play) in the same PR.
3. Run `npm run build`, `npm run check:cycles`, `npm run check:dead`.

## Protected stacks (do not delete)

- Entire `supabase/` tree (migrations, edge functions)
- Camera gesture scoring (`GesturePadPage`, `GestureScoreCourtPage`, `FriendlyPadPage`, `@mediapipe/tasks-vision`, `match_gesture_logs`)
- Auth/LINE stack

## Deployment (web)

Deploys are **git-based** — not manual Vercel CLI deploys.

1. Commit changes on `main` (only when the user asks to commit).
2. `git push origin main`
3. Vercel picks up the push and builds/deploys production automatically.

Do **not** use `vercel deploy` or npx vercel for routine releases unless the user explicitly asks. Supabase migrations and edge functions are separate (`supabase db push`, `supabase functions deploy …`).

## Local dev server

| Where | URL |
|--------|-----|
| **Mac (this machine)** | `http://localhost:5173` — `npm run dev` |
| **Phone/tablet (LAN)** | `http://172.20.10.2:5173` — **`npm run dev:phone` only** |

Peta’s Mac LAN IP (checked 2026-06-14): **`172.20.10.2`** on iPhone hotspot (`en0`). Re-check with `ipconfig getifaddr en0` after switching networks. An old `npm run dev` session may still print a stale address like `192.168.1.70` — ignore it; use the **Network** line from `npm run dev:phone`.

**LINE LIFF in the LINE app always loads production** (`https://success-padel-ffzt.vercel.app`) unless you change the LIFF Endpoint in LINE Developers. Local IP is for Safari/phone browser testing only.

## Local dev debug ingest

| Source | Where logs land |
|--------|------------------|
| **LINE app (production LIFF)** | Supabase `login_debug_events` (session `d2fcaa`) — not your Mac |
| **Phone → Mac Vite** | `npm run debug:tail` → `.debug/ingest.jsonl` and `.cursor/debug-d2fcaa.log` |

Phone/tablet on hotspot can POST debug logs to your Mac while **`npm run dev:phone`** is running:

1. Start dev server: `npm run dev:phone` (binds `0.0.0.0:5173`, Network line shows current IP)
2. Tail logs: `npm run debug:tail`
3. Open app at **`http://172.20.10.2:5173/friendly?debug=1`** (replace IP if `ipconfig getifaddr en0` differs)
4. Or set `VITE_DEV_DEBUG=1` in `.env.local` for always-on ingest in DEV

Client API: [`src/lib/debug/devDebug.ts`](src/lib/debug/devDebug.ts) — `devDebugLog(channel, message, data)`. Vite middleware: [`scripts/viteDebugIngestPlugin.ts`](scripts/viteDebugIngestPlugin.ts).
