# Agent notes — Success Padel

## Login strategy

| Surface | Login |
|--------|--------|
| **TestFlight / iOS app** | LINE OAuth via in-app browser → `successpadel://login` deep link. No email. |
| **Safari / web** | LINE OAuth at `https://success-padel-ffzt.vercel.app/login`. No email for players. |

**Win condition (native):** Tap **Continue with LINE** → LINE login → returns to app logged in.

**Win condition (web):** Open link in Safari → **Continue with LINE** → returns to site logged in.

**Do not rely on email/password** for Thai players — most do not register email on LINE.

**Key files:** [`src/lib/line/oauth.ts`](src/lib/line/oauth.ts), [`src/components/LineNativeLoginPanel.tsx`](src/components/LineNativeLoginPanel.tsx), [`src/components/NativeDeepLinkHandler.tsx`](src/components/NativeDeepLinkHandler.tsx)

**TestFlight build:** `npm run ios:release` (needs `.env.production.local`)
