// Presentation cues only: height remains measured from the court in metres.
// Cap emphasis so a high lob does not hide the rest of the court.
const cueHeight=height=>Math.max(0,Math.min(8,height));
export const overheadPathExtra=height=>cueHeight(height)*1.15;
export const overheadBallPixels=height=>7+cueHeight(height)*2;

export function updateBallView(ball,camera,viewportHeight){
  if(!camera.isOrthographicCamera){ball.scale.setScalar(1);return;}
  const metresPerPixel=(camera.top-camera.bottom)/(camera.zoom*Math.max(1,viewportHeight));
  // The visual sphere has a 0.15m diameter. Keep the overhead cue legible at
  // every zoom, with the centre on the actual trajectory (no positional lift).
  ball.scale.setScalar(overheadBallPixels(ball.position.y)*metresPerPixel/.15);
}
