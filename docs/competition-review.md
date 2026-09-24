# Competition Review

The competition invite page adds Review beside Players, Rules and Matches after
the event is complete/concluded/ended, or a started event passes its saved end time.
Opening it never starts a competition, regenerates a schedule, or saves scores.
A direct link is `/competitive?competition=<id>&view=review`.
Player-specific links add `&player=<session_players.id>`; selection is ID-based,
not name-based, and an explicit linked player takes priority over the signed-in account.
The TV hero is a one-screen preview: compact stats, two match cards, a coaching
preview, and a paged 2-by-2 standings selector. Its QR changes with the selected
player and always targets `https://successpadel.app`. The phone keeps the complete
match and coaching lists. QR handoff requires the web changes to be deployed.

`competitionReview.ts` reads persisted round assignments and numeric court results.
Missing or conflicting scores are not losses; identical duplicates count once.
Each player gets match outcomes, scores for/against, closest match, partners and
opponents. Fixed-pair standings require complete pair records and the existing duo
format validator. No pairs are inferred from names or adjacent roster slots.

Coach notes are filtered by BOTH canonical player ID and recorded competition ID.
Unlinked notes remain on the full profile, not attributed to a guessed event.
The column-only migration permits anonymous filtering by competition ID; completed
row visibility and all write policies remain unchanged. Applied separately from web
deployment; reconcile migration history before any blanket database push.

Styles are isolated in `src/layouts/competition-review/review.<viewport>.css`.
No clips are shown until an actual footage source and player tagging are available.

Checks:

- `npx vite-node scripts/test-competition-review.mts`
- `npx vite-node scripts/test-coach-skill-ratings.mts`
- `npm run build`
- `npm run check:cycles`
