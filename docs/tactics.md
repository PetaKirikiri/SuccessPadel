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
players or the ball; double-tap or double-click near any player to select the shooter and switch the attacking side.
Players stay in place; shot targets, return danger and lob zones recalculate for the selected team.
The ball snaps beside that player and follows them, with a lime ring marking the shooter.
Dragging or placing the ball manually releases that attachment. Tap empty space on the attacking half to place the ball. Taps on empty
defending court do nothing, and dragging the ball cannot cross the net. A manually placed ball remains at the chosen
start when players move. The opponents’ return and defensive exposure are calculated automatically. The trajectory always selects the highest rated legal direct shot, comparing 12/16 m/s
drives over all 25 cm landing cells. Lobs at 7 m/s are evaluated separately as optional
green landing zones labelled “Lob”; they never determine the trajectory line. On the defending
half, each cell shows the best direct-shot score or qualifying lob opportunity. The other half estimates fast-return lanes from both opponents and the
recommended landing area, using our players as defenders. An exposed lane from
either opponent is dangerous, even if the ball might later be retrieved off glass. Green means
attacking opportunity on the receiving half and return safety on the shooting half; red is the
reverse. Both halves use rich red and green with a smooth blend and no grid. Useful deep lob zones are green and labelled “Lob”. There is no manual aim, pace or play control.

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

Lob usefulness also credits forcing opponents back, even if they can eventually
return the ball. A labelled zone must land 0.6–3.4 m from the back wall, at least
0.6 m from a side wall, and at least 2.8 m behind both opponents. It requires an
apex of at least 3.5 m and no reachable overhead below 3.1 m before forcing the
opponent two metres backwards. This positional-benefit score is a heuristic,
not a guarantee against a smash. Labels disappear when no targets qualify.

Assumptions: 0.22 s reaction, 5 m/s² acceleration, 4.5 m/s running, 0.8 m horizontal
racket reach, 2.7 m maximum contact height, floor restitution 0.68 vertically / 0.72
horizontally, wall restitution 0.75. These are prototype parameters, not measured
player data. Spin, movement direction, body orientation and skill are excluded. Defensive coverage is a positional pressure estimate: 16 m/s direct return lanes,
ready movement at 4.5 m/s after reaction, and 0.12 s extra recovery for the player
nearest the ball. It checks interceptions before the target, so a player can screen
space behind them. It does not award safety for a later bounce or a difficult
boundary shot, and does not predict an exact legal return height. Players stay at
their current positions. The teammate contributes to defensive coverage, not
the score of the outbound shot. A defensive lob may still be marked covered because an opponent can return it.

## Verification

`node --experimental-strip-types --test scripts/test-tactics.mts`

Checks interception versus open space, net failures, glass reflection, hitter/ball
movement, court boundaries, finite heatmaps, automatic selection, and mirrored play. Also run the project build and cycle
check after routing changes. Browser checks cover dragging, ball placement, automatic trajectory changes,
and viewport fit. No database migrations or deployment are required locally.
