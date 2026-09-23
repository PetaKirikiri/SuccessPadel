# LINE invite return contract

Ordinary sign-in transports the requested page in `sp_return_to`. Authentication
code must never contain a competition ID, date, default event or deployment host.
`returnDestination.ts` validates the public app path; `competitionInviteUrl` alone
owns existing permanent aliases when the HTTP redirect has already resolved one.

1. Automatic LINE entry and the sign-in QR use `lineSignInEntryUrl(destination)`.
   The LIFF URL contains a query, not an appended path. An old `/login` endpoint
   therefore cannot turn it into the unknown `/login/competitive` route.
2. `LineEntryGate` intercepts the primary `liff.state` and secondary query before
   rendering route fallbacks. LIFF initializes on its configured endpoint.
3. `line-liff-recognize` verifies LINE identity and looks up an existing member.
   With `handoff: true`, it returns a one-use Supabase magic-link ticket, without
   consuming it on the legacy origin. No account is created or linked here.
4. The browser transfers that ticket in the fragment to
   `https://successpadel.app/auth/line/resume`, carrying the validated destination
   separately. Access/refresh tokens never appear in the URL. The fragment is
   removed before the app renders; single-use verification is deduplicated.
5. On success, unknown member, denied consent or timeout, open the requested page.
   An existing app session is not replaced. A storage + URL marker prevents a new
   automatic handoff; the public page remains available without login.

Account-link QR and native OAuth keep their separate existing protocols.
Prefer the LIFF console endpoint `https://successpadel.app/`; the bridge also
supports the legacy Vercel `/login` endpoint as long as it serves this build.

## Release and verification

- Deploy `line-liff-recognize` separately before releasing the web build.
- Web release is the usual requested git commit/push, never a manual Vercel deploy.
- `npm run test:line-return` covers different destinations, both endpoint shapes,
  unsafe return URLs, one-use ticket shape, guest/timeout and late-result fencing.
- A real phone LINE consent/sign-in round trip is still required after release;
  local tests do not prove provider console configuration or a production deploy.
