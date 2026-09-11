# Visual modes: change contract

One competition engine, four visual modes. This is a safety contract, not a claim
that the legacy UI is already four independent component trees.

| User's name | Code | Width, except compact touch devices |
|---|---|---|
| Phone / mobile | mobile | below 768px |
| Tablet | tablet | 768–1023px |
| Desktop / web | web | 1024–1535px |
| Big screen / TV | tv | 1536px and above |

The existing ViewportProvider selects one mode. Do not introduce a second detector.

## Single-mode changes

Only the corresponding `src/layouts/{invite,game-card,court-card}/*.MODE.css`
files qualify as isolated changes today. Every selector must begin with the exact
mode root. Nested media rules are checked too. Global imports, fonts and keyframes
are prohibited in these files. Unknown/new paths fail closed as shared work.

Before committing a mobile-only change:

```sh
npm run check:layout-scope -- --scope mobile --staged
npm run build
```

Without `--staged`, the scope check includes tracked and untracked workspace changes.
For a committed branch use `--base <base-commit> --committed`. Deletions and both
sides of renames are checked. Use `tablet`, `web` or `tv` for the other modes.

## Shared versus infrastructure work

Changing shared components, images, translations, shell geometry or combined
stylesheets is **shared** work. It cannot pass a single-mode scope check, even if
the change was intended for just one screen. This includes GameCard.tsx and
gameCard.tv.css: despite its legacy name, the latter contains all-mode styling.

Changing the checks, package/build configuration, mode selector, agent contract
or GitHub protection files is **infrastructure** work. A shared label is not enough.

PRs must have exactly one `layout:mobile`, `layout:tablet`, `layout:web`,
`layout:tv`, `layout:shared`, or `layout:infrastructure` label. CI validates the
changed paths and builds. The normal build always runs the static layout guard
and its regression tests. A push build cannot prove a declared single-mode scope;
that declaration is enforced by the PR workflow.

## Protection requiring repository-owner setup

In GitHub, require pull requests, the `layout-integrity` check and code-owner
approval on main. Disallow bypasses and direct pushes. CODEOWNERS is provided,
but these repository settings are not activated by committing a file. A solo
owner may need an independent reviewer; self-approval is not independent review.

## Remaining migration

The Game Card still has shared header/court/rendering code. Leaderboard, setup,
profile and shell still contain mixed/shared visual styling. Move presentation
ownership surface by surface with unchanged screenshots in all four modes;
do not create four wrappers around the same mutable visual component and call
that isolation. Shared business logic and data should remain shared.

Automated screenshot baselines across modes, orientation, short windows,
long names and five rule languages are still needed. Current tests prove the
guard rejects known leak patterns; they do not prove pixel-level equivalence.
