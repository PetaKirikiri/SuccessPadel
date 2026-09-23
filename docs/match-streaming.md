# Success Padel court streaming

Implementation status: local implementation; **not deployed or verified against the club's YouTube channel**. Uses the existing Supabase/LINE identity and competition records, as confirmed by Peta. This checkout has neither Firebase nor TanStack Query; no second data store or query framework was introduced.

## Architecture

```text
Success Padel React page — HTTPS control requests — Node controller — Supabase
        |                                              |
        | rear camera + microphone                     | club OAuth
        | WebRTC / WHIP                                v
        v                                        YouTube Live API
    MediaMTX — local RTSP — FFmpeg per court — RTMPS — YouTube
                                                        |
                                              archived video / Watch Match
```

Use one Linux VM with MediaMTX 1.21.0, one Node controller and up to four FFmpeg processes. Caddy terminates HTTPS. TURN can run on the same VM with Coturn, or be supplied by an existing service supporting temporary HMAC credentials. The frontend stays in the existing Vite deployment. Persistent media processes cannot run inside the app's Vercel request functions or Supabase Edge Functions.

MediaMTX already supports WebRTC ingest and RTMPS forwarding. However, browser audio is usually Opus, and negotiated video/keyframe behavior varies. The implemented FFmpeg bridge always produces H.264 + AAC with a two-second GOP. This deliberately spends CPU to avoid depending on browser codecs being suitable for YouTube. A later measured optimization can copy compliant H.264 video while still converting audio. MediaMTX itself is not a transcoder. LiveKit would add room/egress infrastructure; Janus/mediasoup would require more custom media coordination than these four camera feeds need.

1080p30 is requested, not guaranteed. The browser may supply a lower resolution. FFmpeg caps dimensions at 1920×1080 without upscaling, preserves aspect ratio, and encodes at a 10 Mbps video target plus 128 kbps audio. Start benchmarking on an 8-vCPU / 16-GB machine with at least 100 Mbps sustained network capacity; this is an estimate, **not a verified capacity guarantee**. Four software encoders must be load-tested before selecting a paid instance. At four 10 Mbps outgoing feeds, media egress is roughly 18 GB per hour, before overhead. The club connection must also sustain all phone uploads; test with all four courts operating together. Use 720p if Wi-Fi, thermals, or CPU cannot sustain 1080p.

## Operator experience

Set `VITE_STREAMING_API_URL=https://stream-api.YOUR-DOMAIN` in the frontend build to enable the feature. Without it, the route explains that streaming is not configured and the navigation entry stays hidden.

- On the Competitive hub, open the Competitive menu and choose **Stream Match** (`/stream`).
- An event-specific link is `/competitions/{sessionId}/stream`; append `?court={courtId}` to preselect a court. Staff can distribute this link/QR.
- Sign in using the existing Success Padel sign-in. No YouTube account is requested on the phone.
- Admins see scheduled courts. Other signed-in users see only courts assigned to them by staff.
- Staff expand **Assign a camera operator**, search the signed-in person's profile name, and assign the selected court for twelve hours.
- Select a match; **Stream Match** requests camera/microphone permission and shows a muted, inline preview. **Start Stream** begins publication.
- The page shows court, round, both teams, expected duration, connection state, outgoing bitrate when available, elapsed time, and **Stop Stream**.
- “LIVE on YouTube” requires both YouTube broadcast `live` and active ingest confirmation. Preview or WebRTC connectivity alone is not presented as LIVE.
- Reopening the page lists active streams with a Stop action. V1 does not take over a camera from another device or silently replace an existing publisher.
- After YouTube finishes processing, signed-in viewers with permission to see that event get **Watch Match** in player match history. Multiple recording attempts remain separate links.

Scheduled auto-start, score-triggered auto-stop, automatic phone reconnection/ICE restart, friendly-game streaming, and public anonymous archive access are **not part of this initial competition implementation**. Starting a new stream is allowed within thirty minutes before a persisted round start, until its persisted end; this window does not change match timing. An active stream can finish after the expected match end. A three-hour ceiling is a runaway-stream safety bound, not a match timer.

## Match and recording authority

`competition_rounds` plus `competition_round_players` provide the scheduled match identity: `(round_id, court_id)`. Titles and names come from the backend's roster joins, not caller-supplied text. The backend reads the persisted round start/end timestamps; it does not invent match duration or alter scheduling constants.

`matches` may not exist until somebody saves a score. Therefore:

1. `match_streams` stores the court/round, operator, worker slot, lifecycle, and YouTube resource IDs.
2. `match_recordings` saves the broadcast/video ID immediately after creation, before video publication.
3. Every five minutes, `reconcile_match_recording_links()` attaches recordings to any subsequently created `matches` rows by the canonical round/court pair. This also runs after the stream ends and after controller restarts.
4. Archive processing is separate from broadcast completion. Only confirmed processed videos become `ready` and appear as Watch Match.

No RTMP keys or OAuth tokens are stored in either table. Only the service role can access `match_streams` and assignments or mutate recordings. Recording SELECT uses the app's existing `can_view_game_session` policy. Signed-out requests are denied.

## Control API

All public requests require the existing Supabase access token and the configured exact app Origin. The service validates identity with Supabase Auth and reads `profiles.is_admin`; it does not trust user-editable metadata. Customer publish rights require an unexpired assignment. Court visibility alone does not grant publishing rights.

| Endpoint | Purpose |
| --- | --- |
| `GET /matches?session=UUID` | Authorized scheduled round/court metadata; absent session uses a bounded upcoming window |
| `GET /active` | Own active streams, or all streams for admins |
| `GET /operators?q=name` | Admin-only profile lookup |
| `POST /assign` | Admin-only twelve-hour session/court/operator grant |
| `POST /streams` | Reserve court/slot, create broadcast/stream, persist IDs, bind |
| `GET /streams/{id}` | Operator/admin status |
| `POST /streams/{id}/publisher` | Short-lived, path-scoped WHIP bearer and temporary TURN credentials |
| `POST /streams/{id}/heartbeat` | Renew an authorized publisher's ninety-second lease |
| `POST /streams/{id}/stop` | Persist stop intent; worker retries finalization |

The phone never receives YouTube credentials, ingest URLs, or stream keys. The two-minute publishing token authorizes only one MediaMTX path; it is checked against database state and lease on publication. MediaMTX rejects publisher replacement. Control API, RTSP, and authentication callback listeners are loopback-only and are not exposed through Caddy.

The controller serializes mutations. Database partial unique indexes independently reject a second active stream on a court or a fifth worker slot. Deploy **exactly one controller instance**; this is not a distributed worker design. Use process supervision and alert on repeated reconciliation failures. Authentication is separate from the controller's mutation queue, avoiding a deadlock when FFmpeg reads MediaMTX.

## YouTube lifecycle and failure handling

The club owner authorizes offline access once. On creation the controller verifies the authorized channel ID, creates an unlisted `liveBroadcast`, saves its ID, creates a non-reusable `liveStream`, saves its ID, and binds them. The worker waits for the camera path, starts FFmpeg, waits for YouTube active ingest, requests the live transition and subsequently verifies the returned lifecycle. Auto-stop is disabled so a brief disconnection does not immediately finalize a broadcast.

Stop closes local tracks immediately and persists backend stop intent. The worker terminates FFmpeg, disconnects MediaMTX sessions, completes the broadcast, and retries until YouTube confirms completion. A prepared broadcast that never went live is deleted because it cannot transition directly to complete. A closed phone or lost network is detected through the ninety-second lease; server reconciliation runs every fifteen seconds. Whole-controller outages cannot finalize YouTube until the controller restarts; monitor the VM.

Do not retry YouTube `insert` operations blindly: they are not idempotent. Known resource IDs are persisted after each successful response. An uncertain insert response can leave a YouTube resource the controller cannot identify. The attempt is stopped and staff must inspect the channel for the recording reference in the description before retrying. That unavoidable cross-service ambiguity is surfaced rather than pretending exactly-once creation. Unused `liveStream` resources from failed preparations may need admin cleanup.

The controller polls live state every fifteen seconds and archives every five minutes. Four simultaneous feeds consume roughly 1,920 one-unit list requests/hour, plus creation/transition calls and archive checks. Check the project's real quota against the expected event length. Archive polling currently processes up to 200 pending recordings per pass; monitor a large backlog. A failed or deleted archive becomes unavailable; this implementation does not promise YouTube will retain every recording. Local backup recording is not enabled.

## One-time setup

1. Enable YouTube livestreaming for the actual Success Padel Club channel and the YouTube Data API in the Google Cloud project. Configure OAuth consent and an OAuth web client with `http://127.0.0.1:8099/callback` as an authorized redirect. The owner must select the correct club/Brand Account. Set the appropriate audience designation; do not leave consent in a short-lived testing configuration for production use. Verify actual channel restrictions, API audit/privacy behavior, quota, and four simultaneous broadcasts with the channel.
2. Copy `server/streaming/.env.example` to `.env.local`. Keep all secrets server-side. Generate `PUBLISH_SECRET` with at least 32 random characters. Set the exact frontend origin and the two media/control DNS names. Set `YOUTUBE_MADE_FOR_KIDS` to the club owner's correct designation.
3. With client ID, secret and club channel ID in a local environment, run from the repository root:
   ```sh
   node --env-file=server/streaming/.env.local server/streaming/connect-youtube.mjs
   ```
   Open the printed Google authorization URL as the club owner. The tool validates OAuth state, PKCE and channel identity, then writes a new `server/streaming/youtube.env.local` file with mode 0600. It does not print the refresh token. Securely transfer that value into the controller environment. Never send it in chat or put it in any `VITE_` variable. The helper refuses to overwrite an existing token file.
4. Provision one Linux VM, point the two DNS names at it, and configure a compatible TURN service. Set `TURN_SECRET` to the server's shared authentication secret and `TURN_URLS` to its UDP and TLS addresses. Coturn requires `use-auth-secret`, `static-auth-secret`, `realm`, a public/external IP when NATed, valid TLS certificates, relay ports and firewall rules. Restrict relay destinations from reaching private infrastructure. For restrictive mobile networks, offer TURN/TLS on port 443 on a separate IP/hostname from Caddy if needed. Test a forced-relay browser connection; STUN alone is insufficient.
5. Open Caddy TCP 80/443 and MediaMTX UDP/TCP 8189 on the VM; allow outgoing YouTube RTMPS and HTTPS. TURN requires its own configured listener/relay ports. Keep 8090, 8554, 8889, and 9997 private. Do not collect process-command dumps: FFmpeg's server-side argv contains its temporary YouTube ingest key; stderr is suppressed to avoid leaking it into logs.
6. Apply only the reviewed `match_live_streaming` migration. There are unrelated pending migrations in this checkout; **do not blindly push the entire migration directory**. Check deployment history first.
7. On the VM, from `server/streaming`, run:
   ```sh
   docker compose --env-file .env.local up -d --build
   ```
   Host networking is intentionally Linux-specific. Do not scale the controller. MediaMTX/Caddy receive only their needed environment values, not the YouTube or database secrets.
8. Configure `VITE_STREAMING_API_URL` in the frontend deployment and release through the existing git-based deployment flow. No commit or production deployment was requested or performed during implementation.

## Validation and release acceptance

Verified locally: app build; cycle/layout checks; targeted lint of new streaming code; ten backend tests; isolated PostgreSQL migration/RLS/locking/linkage tests; MediaMTX 1.21.0 configuration validation; synthetic browser camera/microphone publishing over actual WebRTC/WHIP into MediaMTX (VP8 + Opus). Forcing H.264 initially produced audio-only ingest in headless Chromium, so the publisher now leaves codec negotiation to the browser and MediaMTX gets ten seconds to collect tracks. FFmpeg-to-YouTube and real-device tests remain outstanding. The existing global TSX audit reports pre-existing utility-class debt; the new surface uses semantic CSS. The existing PlayerMatchHistory effect also has a pre-existing lint warning/error that was not part of this feature.

Local checks:

```sh
node --test server/streaming/core.test.mjs
npm run build
npm run check:cycles
npm run check:layouts
npm run audit:tsx-css
```

`server/streaming/schema.test.sql` runs against a **disposable** PostgreSQL database and rolls back. It builds minimal existing-schema fixtures, applies the actual migration, verifies exclusive court/slot reservation, denies unauthorized reads/mutations, permits an authorized event recording read, and confirms late score linkage. It does not replace a migration test against a complete copy of the production schema.

Before live launch: use real iPhone Safari and Android Chrome, grant/deny both permissions, check actual rear camera and microphone, start/stop an unlisted broadcast, verify audio and video on a second device, wait for archive processing and check Watch Match. Repeat with four simultaneous cameras, TURN-only networking, a phone lock/call/tab close, a network change, a controller restart, duplicate starts, and YouTube quota/OAuth failures. Observe CPU, thermals, dropped frames, bitrate and end-to-end delay. End each test broadcast and inspect the club channel for orphaned preparations. Browser-simulated tests do not certify these real-device paths.

## Primary references checked

- [MediaMTX forwarding and FFmpeg](https://mediamtx.org/docs/features/forward)
- [MediaMTX 1.21.0 configuration](https://mediamtx.org/docs/references/configuration-file)
- [MediaMTX authentication](https://mediamtx.org/docs/features/authentication)
- [YouTube broadcast/stream workflow](https://developers.google.com/youtube/v3/live/guides/implementation/broadcasts-and-streams)
- [YouTube transition requirements](https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/transition)
- [YouTube broadcast creation](https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/insert)
- [YouTube encoder recommendations](https://support.google.com/youtube/answer/2853702)
- [Browser capture permissions and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
