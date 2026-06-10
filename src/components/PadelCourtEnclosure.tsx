import type { CSSProperties } from 'react'
import { glassBandHighlightClass } from '../lib/gestureFeedback'
import {
  PADEL_ENCLOSURE_CAGE_DEPTH_ALONG_LENGTH_FR,
  PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR,
  PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_LENGTH_FR,
  PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR,
  PADEL_END_WALL_PANEL_COUNT,
  PADEL_SIDE_GLASS_FR,
  PADEL_SIDE_GLASS_PANEL_COUNT,
  PADEL_SIDE_MESH_CENTER_FR,
  pct,
  type EnclosureZoneId,
} from '../lib/padelCourtLayout'

type EdgeKind = 'glass' | 'cage'

type PanelSeams = { orientation: 'vertical' | 'horizontal'; count: number }

/** Faint seams marking the joints between FIP glass panels (~2 m wide). */
function PanelSeamLines({ orientation, count }: PanelSeams) {
  if (count < 2) return null
  const seams = []
  for (let i = 1; i < count; i++) {
    const at = pct(i / count)
    seams.push(
      orientation === 'vertical' ? (
        <div key={i} className="absolute inset-y-0 w-px bg-white/20" style={{ left: at }} />
      ) : (
        <div key={i} className="absolute inset-x-0 h-px bg-white/20" style={{ top: at }} />
      ),
    )
  }
  return <>{seams}</>
}

type Props = {
  startGlassBand?: EnclosureZoneId | null
  activeGlassBand?: EnclosureZoneId | null
  glassBandFeedback?: boolean
}

function EdgeBand({
  kind,
  bandId,
  highlight,
  style,
  seams,
}: {
  kind: EdgeKind
  bandId?: EnclosureZoneId
  highlight?: string
  style: CSSProperties
  seams?: PanelSeams
}) {
  return (
    <div
      data-glass-band={bandId}
      className={`absolute transition-colors duration-150 ${kind === 'glass' ? 'padel-glass-band' : 'padel-cage-band'} ${highlight ?? ''}`}
      style={style}
    >
      {kind === 'glass' && seams ? <PanelSeamLines {...seams} /> : null}
    </div>
  )
}

/** Outward band on the top/bottom (10 m end walls). */
function EndWallBands({
  side,
  xStart,
  xSize,
  kind,
  bandId,
  highlight,
}: {
  side: 'top' | 'bottom'
  xStart: number
  xSize: number
  kind: EdgeKind
  bandId?: EnclosureZoneId
  highlight?: string
}) {
  const outward = side === 'top' ? 'top' : 'bottom'

  if (kind === 'cage') {
    return (
      <EdgeBand
        kind="cage"
        style={{
          left: pct(xStart),
          width: pct(xSize),
          height: pct(PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR),
          [outward]: pct(-PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR),
        }}
      />
    )
  }

  return (
    <>
      <EdgeBand
        kind="cage"
        style={{
          left: pct(xStart),
          width: pct(xSize),
          height: pct(PADEL_ENCLOSURE_CAGE_DEPTH_ALONG_LENGTH_FR),
          [outward]: pct(-PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR),
        }}
      />
      <EdgeBand
        kind="glass"
        bandId={bandId}
        highlight={highlight}
        seams={{ orientation: 'vertical', count: PADEL_END_WALL_PANEL_COUNT }}
        style={{
          left: pct(xStart),
          width: pct(xSize),
          height: pct(PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_LENGTH_FR),
          [outward]: pct(-PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_LENGTH_FR),
        }}
      />
    </>
  )
}

/** Outward band on the left/right (20 m side walls). */
function SideWallBands({
  side,
  yStart,
  ySize,
  kind,
  bandId,
  highlight,
}: {
  side: 'left' | 'right'
  yStart: number
  ySize: number
  kind: EdgeKind
  bandId?: EnclosureZoneId
  highlight?: string
}) {
  const outward = side === 'left' ? 'left' : 'right'

  if (kind === 'cage') {
    return (
      <EdgeBand
        kind="cage"
        bandId={bandId}
        highlight={highlight}
        style={{
          top: pct(yStart),
          height: pct(ySize),
          width: pct(PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR),
          [outward]: pct(-PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR),
        }}
      />
    )
  }

  return (
    <EdgeBand
      kind="glass"
      bandId={bandId}
      highlight={highlight}
      seams={{ orientation: 'horizontal', count: PADEL_SIDE_GLASS_PANEL_COUNT }}
      style={{
        top: pct(yStart),
        height: pct(ySize),
        width: pct(PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR),
        [outward]: pct(-PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR),
      }}
    />
  )
}

/** FIP Variant 2 Crystal — glass vs mesh zones in the margin outside the playing surface. */
export function PadelCourtEnclosure({
  startGlassBand = null,
  activeGlassBand = null,
  glassBandFeedback = false,
}: Props) {
  const sideGlass = PADEL_SIDE_GLASS_FR
  const sideMesh = PADEL_SIDE_MESH_CENTER_FR

  const hi = (bandId: EnclosureZoneId) =>
    glassBandHighlightClass(bandId, startGlassBand, activeGlassBand, glassBandFeedback)

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-visible" aria-hidden>
      <EndWallBands
        side="top"
        xStart={0}
        xSize={1}
        kind="glass"
        bandId="top"
        highlight={hi('top')}
      />
      <EndWallBands
        side="bottom"
        xStart={0}
        xSize={1}
        kind="glass"
        bandId="bottom"
        highlight={hi('bottom')}
      />

      <SideWallBands
        side="left"
        yStart={0}
        ySize={sideGlass}
        kind="glass"
        bandId="left-top"
        highlight={hi('left-top')}
      />
      <SideWallBands
        side="left"
        yStart={sideGlass}
        ySize={sideMesh}
        kind="cage"
        bandId="left-mesh"
        highlight={hi('left-mesh')}
      />
      <SideWallBands
        side="left"
        yStart={sideGlass + sideMesh}
        ySize={sideGlass}
        kind="glass"
        bandId="left-bottom"
        highlight={hi('left-bottom')}
      />

      <SideWallBands
        side="right"
        yStart={0}
        ySize={sideGlass}
        kind="glass"
        bandId="right-top"
        highlight={hi('right-top')}
      />
      <SideWallBands
        side="right"
        yStart={sideGlass}
        ySize={sideMesh}
        kind="cage"
        bandId="right-mesh"
        highlight={hi('right-mesh')}
      />
      <SideWallBands
        side="right"
        yStart={sideGlass + sideMesh}
        ySize={sideGlass}
        kind="glass"
        bandId="right-bottom"
        highlight={hi('right-bottom')}
      />
    </div>
  )
}
