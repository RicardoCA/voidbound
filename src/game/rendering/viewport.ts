export const MOBILE_LAYOUT = "(pointer: coarse), (max-width: 760px)";
/** Extend the visible world instead of cropping or stretching the 480×270 view. */
export function logicalViewport(
  width: number,
  height: number,
  expand: boolean,
) {
  if (!expand || width <= 0 || height <= 0) return { width: 480, height: 270 };
  const scale = Math.min(width / 480, height / 270);
  return {
    width: Math.round(width / scale),
    height: Math.round(height / scale),
  };
}
