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

Only the court, four players, attached ball, coverage shadows and recommended path
are visible. Drag players; double-tap or double-click near any player to select the
shooter and switch attacking sides. The shot starts at the centre of the selected player, whose disc turns lime. Moving the shooter carries the ball. Empty
court taps never relocate it.

Each player casts a rounded, widening shadow away from the incoming ball.
Colours use the selected attack's perspective. On the receiving half, green gaps
are aim opportunities and coral shadows are defended lanes. On the shooting half,
green shadows are protected space and coral gaps are exposed. This meaning follows
the selected shooter when the attacking team changes. There are no zone words.

Useful lobs cut out small green landing pockets inside otherwise defended shadows;
white curved arrows and dashed rings distinguish them from direct-shot openings.
Each pocket is inscribed in cells with a lob score of at least 70. Lobs remain optional
and never turn the recommended direct line into a shot through a defender.

The shadows are geometric footprints, not win probabilities. They use tangents from
the incoming origin to a 1.15 m racket/step footprint, clipped to each player's half.
On the receiving half the source is the shooter; on the shooting half it is the
earliest reachable return contact, or the chosen target for orientation if no return
is reachable. Green is a positional opportunity, not a guarantee of a winning shot.

The automatic direct shot compares 10/12/14/16 m/s drives, keeping nominal targets
at least 1.25 m inside the receiving half. From 4 m or more behind the net, the first
bounce must be at least 3.5 m beyond it: no delicate short-angle recommendation from
the back. Wide cross-court rally shots remain available when they pass these checks.

Execution tolerance is an eligibility gate, not a small bonus that a winner score
can override. Heading varies by ±0.04 rad, launch elevation by ±0.025 rad and power by
±6%. Every one of the 27 combinations must clear the net by at least 12 cm and land
at least 35 cm inside the receiving half. Among eligible shots, opponent difficulty
contributes 70 points and the worst-case execution margin 30 points. Returning a playable rally
ball is preferable to recommending a precision winner. These are conservative design
assumptions, not measured player skill levels. A central moderate-paced rally target
is the fallback if the sampled candidates provide no eligible option.

Players default to right-handed. An optional per-player `handedness` model field
supports left-handed receivers without changing court-side orientation. Up to 30
ranking points favour an early reachable backhand contact, particularly outside the
pair rather than in the partner's forehand lane. An available early forehand reply
neutralises this preference; overhead contact height and time to run around the ball
reduce it. This is a coaching preference, not a claim that every backhand is weaker.
The execution gate still applies before any handedness bonus. No new court labels
or controls are introduced.

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
return the ball. A lob landing cue must land 0.6–3.4 m from the back wall, at least
0.6 m from a side wall, and at least 2.8 m behind both opponents. It requires an
apex of at least 3.5 m and no reachable overhead below 3.1 m before forcing the
opponent two metres backwards. This positional-benefit score is a heuristic,
not a guarantee against a smash. The lob cues disappear when no targets qualify.

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

The yellow ball continuously replays the calculated trajectory using sample timestamps,
with a tapered trail that grows with speed and shortens after the bounce. Playback
pauses while dragging and when hidden; reduced-motion settings show a stationary
ball and trail. Court rendering is cached between state changes.

Ball radius follows the sampled height continuously: 6 px at ground level, 7.25 px
at net height (0.95 m), and at most 12 px for a 5 m or higher lob. It shrinks as the
ball falls and grows again after a bounce. Position and speed still follow the same
trajectory; optional lob cues do not replace the main direct shot.
