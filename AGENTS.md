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

## Local dev debug ingest

Phone/tablet on the same Wi‑Fi can POST debug logs back to your Mac while `npm run dev` / `npm run dev:phone` is running.

1. Start dev server: `npm run dev:phone` (binds `0.0.0.0:5173`)
2. Tail logs: `npm run debug:tail` (writes to `.debug/ingest.jsonl`)
3. Open app with **`?debug=1`** once (sticky in localStorage), e.g. `http://192.168.x.x:5173/friendly/…/pad?debug=1`
4. Or set `VITE_DEV_DEBUG=1` in `.env.local` for always-on ingest in DEV

Client API: [`src/lib/debug/devDebug.ts`](src/lib/debug/devDebug.ts) — `devDebugLog(channel, message, data)`. Vite middleware: [`scripts/viteDebugIngestPlugin.ts`](scripts/viteDebugIngestPlugin.ts).
