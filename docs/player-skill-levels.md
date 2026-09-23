# Success Padel player levels

The live database catalog is `public.padel_skill_levels`, ordered by `rank`:

| Code | Rank | Display name | Existing-client storage value |
|---|---:|---|---|
| beginner | 1 | Beginner | Beginner |
| low_inter | 2 | Low Inter | Low Inter |
| inter | 3 | Inter | Intermediate |
| high_inter | 4 | High Inter | High Inter |
| advanced | 5 | Advanced | Advanced |
| advanced_plus | 6 | Advanced Plus | Advanced Plus |

These are the user's agreed club categories, not an official external rating or a numerical conversion from another platform. Rank is category order, not match points.

## Player assignment

`profiles.skill_level` and `padel_players.skill_level` reference the catalog's `storage_value`. For members use the linked profile as the authority. The registry field supports unlinked guest players; do not use a registry snapshot instead of a linked profile. NULL means unassessed, not Beginner.

`Inter` writes are normalized to the existing `Intermediate` storage value. This preserves older clients, saved ratings and historical filters. Display the catalog's `name` in the new guide and badges.

Open is an event admission option, not player ability. Historical Open events remain intact.

## Event eligibility

`game_sessions.skill_level_min_rank` and `skill_level_max_rank` support explicit inclusive ranges. Both must be provided or both NULL; minimum cannot exceed maximum. Resolve ranks through the catalog.

When both are NULL, use the existing single `skill_level` field; Open is unrestricted. No existing event has been assigned a new range by this migration. Future setup UI must update both fields together and explicitly clear an old range when switching back to a single-level event.

## Educational guide, next phase

`public.padel_skill_level_guides` stores per-level/per-language summary, self-check array, next-level focus, image URL and accessible alternative text. Supported locales: en, th, fr, ru, he.

Six blank English drafts exist. There are no invented assessment thresholds or published images. Develop the criteria and illustrations with the user before publishing. Explain repeatable abilities under match conditions, not one successful shot or time spent playing.

Anonymous visitors can read the catalog and published guides. Only existing admins can edit/read drafts through the app. Publishing requires a summary, at least one self-check, an image URL and alternative text. The catalog itself is read-only to browser roles.

The guide, new badges and app level pickers are not changed by this database migration. They must consume the catalog in the next UI phase; existing hard-coded choices in `competitionPresets.ts` are legacy.

## Verification

Apply `20260923041213_canonical_player_levels.sql` before consuming the new fields. Run `npx supabase db query --linked --file scripts/test-padel-skill-levels.sql` for rollback-only checks of the initial migration, constraints and public permissions.
