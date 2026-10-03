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
players; double-tap or double-click near any player to select the shooter and switch the attacking side.
Players stay in place; shot targets, return danger and lob zones recalculate for the selected team.
The ball snaps beside that player and follows them, with a lime ring marking the shooter.
The ball is always anchored to a player, including on first load. It has no independent
pointer or keyboard control, and tapping empty court never relocates it. Moving the
shooter carries the ball; moving another player leaves the shot origin unchanged.
The opponents’ return and defensive exposure are calculated automatically. The trajectory always selects the highest rated legal direct shot, comparing 12/16 m/s
drives over all 25 cm landing cells. Lobs at 7 m/s are evaluated separately as optional
green landing zones labelled “Lob”; they never determine the trajectory line. On the defending
half, each cell shows the best direct-shot score or qualifying lob opportunity. The shooting half estimates replies from reachable
contact points along the selected shot. An opponent crossing to intercept must reply
from that new contact point, with contact height and movement pressure limiting the shot. Green means
attacking opportunity on the receiving half and return safety on the shooting half; red is the
reverse. The court uses three flat visual states: green for useful/covered areas, coral
for risky/exposed areas, and blue for neutral space. The display groups scores at
70 or above into green and 20 or below into coral. Small disconnected patches under
1.5 square metres are omitted; high-resolution rounded masks replace contours and gradients.
Short on-court labels explain the colours in context: “Covered” and “Exposed” on the
shooting half, “Avoid” on the receiving half, and a bullseye labelled “Aim here” for
a favourable direct shot (or “Best option” when its score is below 55). Labels avoid
player discs and each other; no toolbar or off-court legend is added. Useful deep lob zones are green and labelled “Lob”. There is no manual aim, pace or play control.

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
player data. Spin, movement direction, body orientation and skill are excluded. Defensive coverage is conditional on the displayed outbound shot. The model allows up to
0.5 s of anticipatory movement, then samples early and balanced contacts for each opponent
before and after the bounce. Return origins are actual reachable samples, not the players’
starting positions or an arbitrary landing point. This head start is a deliberately generous
prototype assumption to include interceptions by players who read the shot early.

Return pace ranges from 10 m/s for a stretched contact to 16 m/s for a balanced contact,
with a reduction for redirecting away from the incoming line. Four pace fractions down to
40% allow soft replies. Each return must clear the net from the actual contact height;
a low pickup cannot fire a fast ball into a short target through the net. Defenders can
intercept at reachable heights, using reaction/acceleration and a limited preparation
credit from the outbound flight; they are not teleported towards the eventual reply.

Immediate racket/step coverage remains green within 0.9 m of either shooting player
and fades to zero at 2.9 m. Elsewhere, the quickest feasible reply determines exposure.
If no reachable or legal reply is found, that area is neutral, not guaranteed safe.
These are coaching heuristics, not calibrated probabilities or a complete ball/player
simulation. Spin, handedness, precise body balance and post-return wall recovery are
not modelled. The teammate contributes to defensive coverage, not outbound-shot scoring.

## Verification

`node --experimental-strip-types --test scripts/test-tactics.mts`

Checks interception versus open space, net failures, glass reflection, hitter/ball
movement, court boundaries, finite heatmaps, automatic selection, and mirrored play. Also run the project build and cycle
check after routing changes. Browser checks cover dragging, permanent shooter attachment, automatic trajectory changes,
and viewport fit. No database migrations or deployment are required locally.
