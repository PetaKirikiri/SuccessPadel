# Halloween costume descriptions and avatar pickup

The field lives directly below the name on the existing competition roster card (`InviteCardRosterEditor` → `MemberPlayerSlots`). It is Halloween-only. The stored description is not a player-name edit and cannot change the draw or attendance.

- Store: `public.player_event_costumes`, event key `halloween-2026`.
- Identity: server-resolved padel player ID, then profile ID, then roster ID plus guest-name fingerprint. Names and card positions never identify linked players.
- Access: existing member-directory owner token or authorized admin. Both RPCs check access on every call. The table is not directly readable/writable by public clients.
- Read: `list_halloween_costumes(exact_session_uuid, owner_token)` returns each roster ID, stable subject key, display name, description, revision, update time and `needs_avatar`.
- Save: `save_halloween_costume(...)` checks roster identity and expected revision. New edits cannot silently overwrite another device's changes.
- Empty places need a player name before a costume can be saved.

## When asked to make new or updated avatars

1. Read the exact requested event's records. Select nonempty descriptions where `needs_avatar` is true. For the current Halloween event use `882f0946-4cf7-4575-b6b4-982146f02479`; never select the newest event automatically.
2. Record the subject key and revision used for each image. Use their linked normal profile photo only if the user asks for a recognizable transformation. Do not alter the normal profile photo.
3. Generate images only when requested. Upload to the existing approved asset/storage location.
4. Save the image URL to `portrait_url` and the source description revision to `portrait_revision`, conditioned on the row still having that same revision. If it changed during generation, keep it pending and re-read the description.
5. A record is pending when its description is nonempty and its portrait is missing or `portrait_revision IS DISTINCT FROM revision`. Changing the description therefore makes it pending again; blank descriptions do not enter the queue.

The inline editor/storage are implemented. Showing generated portraits on leaderboard/game cards is a separate follow-up once portraits exist; do not claim those consumers are connected yet.

Verification: `scripts/test-halloween-costumes.sql` runs in a rollback transaction and checks owner authorization, persistence, stale-write rejection, identity mismatch and avatar revision tracking. Browser QA also verifies save → reload → restore blank.
