# Coach voice observations

The profile header's **Coach note** button is visible only to signed-in users in
`public.coach_feedback_staff`. Initial membership is the admin snapshot captured by
the migration. Additional coaches must be granted membership by trusted database
administration using their verified profile ID. Changing a display name or the
legacy editable admin flag does not grant recording access.

## Flow

1. Header button requests the microphone. Browser recording supports WebM/Opus and
   Safari MP4, with a two-minute / 2 MB limit.
2. Stop releases the microphone. The coach can listen, discard, or **Send & save**.
3. `/api/coach-feedback` validates the session and database staff membership, then
   fixes the player identity from its canonical `padel_players.id` (never from AI).
4. A unique submission is inserted before the AI call. Whisper (`whisper-1`)
   transcribes; the transcript is persisted before GPT (`gpt-4o-mini`, configurable
   through server-only `OPENAI_COACH_MODEL`) organises structured observations.
5. Categories/subskills come from `src/lib/coachSkills.json`. Evidence must be a
   verbatim transcript excerpt. Each assessed observation stores a 1–10 skill rating
   and its source: coach-stated or AI-estimated from the fixed behavioural rubric.
   Insufficient evidence produces a null rating. No competition data are changed.
6. Successful save opens Coach Feedback and reloads its database entries. Original
   transcript, coach, date, model and token usage remain attached to the record.

## Cumulative skill ratings

Recordings append; retrying the same submission never adds another vote. All completed
history is loaded with cursor pagination (not just the latest 100). Each skill and
subskill shows the average across rated recordings, rounded to one decimal. Multiple
tags in the same recording are averaged first so a verbose note cannot outweigh
other recordings. There is no overall player rank or official competition-level change.
The comment retains its individual score and visibly identifies AI estimates.
Historical notes without ratings remain visible and do not count as zero; this change
does not retrospectively invent ratings or rewrite saved feedback. Deleting an authorised
note removes its contribution on the next calculation.

Completed observations are public on player profiles, including for signed-out
visitors and unrelated players. Public loading includes the comment, skill tags,
coach attribution and date; anonymous column grants exclude internal audio hashes,
model usage and error details. Only staff can read processing/error rows. The raw
audio is sent to OpenAI but not stored by Success Padel. The coach's browser keeps
it for retry while the recording dialog remains open. Closing/discarding removes
that local recording; unsaved audio does not survive closing/reloading the page.

Completed notes offer **Delete note** only to their original author while that
account still has coach access. Confirmation explains that deletion removes the
whole recording entry, including its transcript and all extracted skill tags.
Players, other coaches and anonymous visitors cannot delete it; a database DELETE
policy enforces this independently of the button. Processing entries cannot be
deleted. Failed deletion keeps the note visible; successful deletion updates the
skill counts without reloading the profile. No real notes are removed by setup.

Retries use the same ID/audio hash, return completed submissions without another
AI call, and reuse a saved transcript after GPT failure. An in-progress lease lasts
three minutes before retry is allowed. There is a per-coach 30-new-notes/hour guard.

## Local and deployment

- Local Vite middleware and the Vercel function share `server/coaching/feedback.mjs`.
- Keep `OPENAI_API_KEY` in ignored `.env.local`; never use a `VITE_` key name.
- Production needs `OPENAI_API_KEY` in server environment configuration, plus
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` (existing `VITE_SUPABASE_*` values also work).
- Node 22+ is required. No service-role credential is used: requests retain caller
  identity and database RLS. Do not deploy the private local environment file.
- The database migration is separate from git deployment. The new migration was
  applied via the management query API during development; reconcile migration
  history before a later blanket migration push.
- Native packaged-app routing/microphone permissions have not been verified. Phone
  browser use needs HTTPS (or localhost); use the existing `dev:phone` HTTPS mode.

## Checks

`node --test server/coaching/*.test.mjs` exercises schema/evidence validation,
provider failures, authorisation, pipeline persistence, retry and deduplication.
`npx vite-node scripts/test-coach-skill-ratings.mts` checks cumulative averages,
unrated history, per-recording weighting, duplicate protection, deletion recalculation
and full-history pagination without network access or live writes.
`server/coaching/permissions.test.sql` tests real database RLS in a transaction and
rolls every test write back. Build and layout checks remain unchanged.

Live test on 2026-09-11: the supplied OpenAI key returned HTTP 429,
`credit_balance_exhausted` / `insufficient_quota`. A successful live audio-to-feedback
run is still required after billing is restored. No real-player test notes were saved.
