# Standalone tactics prototype

Open `/tactics` directly. The lazy route sits outside the normal Layout and AppFrame:
no dock, visible controls, account requirement, game record or navigation entry. Existing root providers
remain in place. Nothing is saved or sent by the tactics surface.

## Ownership

- `src/surfaces/tactics/tacticsModel.ts`: framework-independent model in metres/seconds.
- `src/surfaces/tactics/drawCourt.ts`: canvas drawing and reversible court/screen mapping.
- `src/surfaces/tactics/TacticsPage.tsx`: local state and pointer/keyboard interaction.
- `src/layouts/tactics.layout.css`: route-local presentation, including safe-area spacing.

The mathematical model can later be imported into another Success Padel surface without
importing this page or connecting to competition state.

## Interaction

Only the court, four players, ball, heatmap and recommended path are visible. Drag
players or the ball; tap empty court to place the ball. The ball remains at the chosen
start when players move. Either half can be the attacking side. Target, pace and shot
kind are selected automatically by comparing 12/16 m/s drives and 7 m/s lobs over all
25 cm landing cells. On the attacking half, each cell shows its best candidate; the path shows the
highest rated legal candidate overall. The other half estimates return coverage
from that recommended landing area, using our players as defenders. Green means
attacking opportunity on their half and defensive safety on ours; red is the
reverse. Both halves share a softly smoothed red-to-green blend with no grid. There is no manual aim, pace, hitter or play control.

## What the heatmap means

For each 25 cm target cell, horizontal speed determines flight duration. A ballistic
vertical launch velocity is solved so the ball first bounces on that target. Net
clearance is checked analytically. After the first bounce, the model samples the ball
until a second bounce, mesh contact, exit above glass, or return across the net.
Glass rebounds reverse and reduce the relevant horizontal velocity.

Each opponent's reach time combines reaction, acceleration, maximum running speed
and racket reach. At each reachable-height sample, compare that reach time to the
ball's time. The minimum difference is the internal time margin; positive is better
for the hitter. A sigmoid maps this margin to colour, with an edge-accuracy penalty.
It is not a win probability. Drive and lob candidates differ in contact height and horizontal pace; the launch
angle follows the candidate target.

Assumptions: 0.22 s reaction, 5 m/s² acceleration, 4.5 m/s running, 0.8 m horizontal
racket reach, 2.7 m maximum contact height, floor restitution 0.68 vertically / 0.72
horizontally, wall restitution 0.75. These are prototype parameters, not measured
player data. Spin, movement direction, body orientation and skill are excluded. Defensive
coverage approximates a return from the recommended landing area, keeping players
at their current positions. The teammate contributes to defensive coverage, not
the score of the outbound shot. A defensive lob may still be marked covered because an opponent can return it.

## Verification

`node --experimental-strip-types --test scripts/test-tactics.mts`

Checks interception versus open space, net failures, glass reflection, hitter/ball
movement, court boundaries, finite heatmaps, automatic selection, and mirrored play. Also run the project build and cycle
check after routing changes. Browser checks cover dragging, ball placement, automatic trajectory changes,
and viewport fit. No database migrations or deployment are required locally.
