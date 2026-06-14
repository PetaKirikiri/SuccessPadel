# Agent notes — Success Padel

## Login strategy

| Surface | Login |
|--------|--------|
| **TestFlight / iOS app** | LINE OAuth via in-app browser → `successpadel://login` deep link. No email for players. |
| **Safari / web** | Tap **Sign In** (top-right chip) → scan QR → open in LINE app, or finish OAuth when LINE redirects to `/login?code=…`. No dedicated login page. |
| **LINE app (LIFF)** | QR / reopen link opens `liff.line.me/{LIFF_ID}/friendly` — session restored from cache when possible. |

**Win condition (web):** User taps **Sign In** → scans QR → opens Success Padel in LINE → logged in (cached session or OAuth callback).

**Win condition (native):** LINE OAuth in system browser → deep link back → logged in.

**Do not rely on email/password** for Thai players — most do not register email on LINE. Email sign-in in the modal is for admins/dev only.

**No “Continue with LINE” button** — that flow was removed. `/login` is OAuth callback only; it redirects to `/friendly`.

**Key files:** [`src/components/ProfileChip.tsx`](src/components/ProfileChip.tsx), [`src/components/LineSignInModal.tsx`](src/components/LineSignInModal.tsx), [`src/lib/line/oauth.ts`](src/lib/line/oauth.ts), [`src/components/NativeDeepLinkHandler.tsx`](src/components/NativeDeepLinkHandler.tsx), [`src/components/LineOAuthReturnHandler.tsx`](src/components/LineOAuthReturnHandler.tsx)

**Profile photo from LINE:** Stored in `profiles.avatar_url` on LINE sign-in (OAuth or LIFF auth). Not refreshed on every app open — only when the user signs in again through LINE.

**TestFlight build:** `npm run ios:release` (needs `.env.production.local`)

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
