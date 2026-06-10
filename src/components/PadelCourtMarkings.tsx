import {
  PADEL_CENTRAL_LINE_TOP_END_Y,
  PADEL_CENTRAL_SEGMENT_HEIGHT_BOTTOM,
  PADEL_CENTRAL_SEGMENT_HEIGHT_TOP,
  PADEL_CENTER_LINE_X,
  PADEL_LINE_WIDTH_COURT_X,
  PADEL_LINE_WIDTH_COURT_Y,
  PADEL_NET_LINE_WIDTH_COURT_Y,
  PADEL_NET_Y,
  PADEL_SERVICE_LINE_BOTTOM_Y,
  PADEL_SERVICE_LINE_TOP_Y,
  pct,
} from '../lib/padelCourtLayout'

/** FIP 10 m x 20 m court line markings, drawn inside a [data-court-surface] box. */
export function PadelCourtMarkings() {
  const lineY = pct(PADEL_LINE_WIDTH_COURT_Y)
  const netLineY = pct(PADEL_NET_LINE_WIDTH_COURT_Y)
  const lineX = pct(PADEL_LINE_WIDTH_COURT_X)

  return (
    <>
      <div
        className="absolute inset-0 box-border border-white"
        style={{ borderWidth: lineX }}
      />
      <div
        className="absolute inset-x-0 -translate-y-1/2 bg-white"
        style={{ top: pct(PADEL_NET_Y), height: netLineY }}
      />
      <div
        className="absolute inset-x-0 -translate-y-1/2 bg-white"
        data-service-line="top"
        style={{ top: pct(PADEL_SERVICE_LINE_TOP_Y), height: lineY }}
      />
      <div
        className="absolute inset-x-0 -translate-y-1/2 bg-white"
        data-service-line="bottom"
        style={{ top: pct(PADEL_SERVICE_LINE_BOTTOM_Y), height: lineY }}
      />
      <div
        className="absolute -translate-x-1/2 bg-white"
        style={{
          left: pct(PADEL_CENTER_LINE_X),
          top: pct(PADEL_CENTRAL_LINE_TOP_END_Y),
          width: lineX,
          height: pct(PADEL_CENTRAL_SEGMENT_HEIGHT_TOP),
        }}
      />
      <div
        className="absolute -translate-x-1/2 bg-white"
        style={{
          left: pct(PADEL_CENTER_LINE_X),
          top: pct(PADEL_NET_Y),
          width: lineX,
          height: pct(PADEL_CENTRAL_SEGMENT_HEIGHT_BOTTOM),
        }}
      />
    </>
  )
}
