# Game-card camera: preparation

## Requested experience

Keep the score-tracker control. Add a separate camera control to the game card, associated with the selected court and game. A person opens it on the filming phone, permits rear-camera and microphone access, checks framing, and starts a live broadcast to the club's Success Padel YouTube channel. Stopping ends the broadcast; the resulting YouTube recording is linked to the match after processing.

Show clear camera-ready, connecting, live, interrupted, stopping and replay-processing states. Only show LIVE after YouTube confirms active ingest and live broadcast status. Preserve player photos, names and learning-icon placement.

## Existing work verified on September 10

- `src/features/streaming/StreamMatchPage.tsx`: phone preview, start/stop and stream status.
- `src/features/streaming/publisher.ts`: browser camera publication.
- `server/streaming/`: controller, MediaMTX/FFmpeg relay, YouTube OAuth helper and broadcast lifecycle.
- `supabase/migrations/20260910035614_match_live_streaming.sql`: stream/recording data model, pending deployment verification.
- Event route: `/competitions/:id/stream?court=:courtId`.
- Ten existing controller/helper tests pass. They do not establish camera-to-YouTube operation, deployment readiness or recording reliability.
- Existing broadcasts are unlisted. Existing publishing access is admin or staff-assigned operator only.
- No live channel authorization, broadcast or deployment was performed during this preparation.

## Implementation gaps

1. Add the separate camera control in the appropriate GameCard size-specific header/court action area; keep the score tracker. Carry event, court and round identity to the streaming page. The current page preselects a court but does not select an exact round from the originating card; fix that before connecting the button.
2. Align publishing access with the request that whoever presses the button can film. Reuse Success Padel sign-in, with no Google sign-in required on each phone. The current staff-assignment requirement does not yet implement that experience. Define event-eligible signed-in publishing access before changing the backend checks; do not merely remove authorization checks or grant anonymous channel control.
3. The user confirmed channel `UCFqN_NwDh-im988piXNzD3g` via `https://studio.youtube.com/channel/UCFqN_NwDh-im988piXNzD3g`. Use this exact ID for `YOUTUBE_CHANNEL_ID` and the authorization identity check. Owner authorization is still required; a channel URL does not provide authorization. Public versus unlisted visibility is pending.
4. Verify YouTube Live is enabled and the API project/channel can publish at the requested visibility. Configure server-side credentials, relay hosting, HTTPS and TURN. Existing local documentation is a deployment recipe, not evidence that infrastructure is running.
5. Keep one active camera per court. A second phone should see that a camera is already live instead of replacing it. Bind broadcasts/replays to round and court IDs, not player names.
6. Saving currently means a processed YouTube archive and a match replay link. Independent backup recording is not implemented. If a separate guaranteed copy is required, add server recording/storage as its own deliverable; do not describe YouTube archival as a guarantee.

## Acceptance run

First use one court and an unlisted test broadcast after owner authorization. Verify the phone camera preview, actual moving video and audio on YouTube, accurate LIVE state, stop confirmation, and a playable saved replay linked to that match. Confirm the person filming does not need club Google credentials. Test a second phone, denied camera permission, network loss and a locked/backgrounded phone. Then test the intended simultaneous-court count on club Wi-Fi, including iPhone Safari/LINE behavior, before rollout.

The existing design supports up to four relay slots, but four concurrent streams and YouTube account limits have not been validated. Keep the phone foregrounded and powered during filming; interruption handling must be tested on the actual devices.

## Primary references

- YouTube channel-owner authorization and broadcast/stream model: https://developers.google.com/youtube/v3/live/getting-started
- YouTube can automatically archive streams under twelve hours; this is not an independent backup: https://support.google.com/youtube/answer/6247592

See `docs/match-streaming.md` for existing service configuration and deployment details. This document records preparation and gaps, not completed production integration.
