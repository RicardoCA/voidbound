import type { Box3, Vector3 } from "three";

type Axis = "x" | "y" | "z";

export interface SurfaceOccluder {
  axis: Axis;
  center: Vector3;
  halfThickness: number;
  halfWidth: number;
  halfHeight: number;
}

const planeAxes = {
  x: ["z", "y"],
  y: ["x", "z"],
  z: ["x", "y"],
} as const;

export function behindSurfaceOccluder(eye: Vector3, bounds: Box3, wall: SurfaceOccluder) {
  const { axis, center, halfThickness, halfWidth, halfHeight } = wall;
  const distance = center[axis] - eye[axis];
  if (Math.abs(distance) <= halfThickness) return false;
  const near = bounds.min[axis] - eye[axis];
  const far = bounds.max[axis] - eye[axis];
  if (distance > 0 ? near <= distance : far >= distance) return false;

  // Project both ends of the box onto the opaque plane. A box is hidden
  // only when every projected corner fits inside the same solid rectangle.
  const [horizontal, vertical] = planeAxes[axis];
  const minU = bounds.min[horizontal] - eye[horizontal];
  const maxU = bounds.max[horizontal] - eye[horizontal];
  const minV = bounds.min[vertical] - eye[vertical];
  const maxV = bounds.max[vertical] - eye[vertical];
  for (const scale of [distance / near, distance / far]) {
    const u = eye[horizontal] - center[horizontal];
    const v = eye[vertical] - center[vertical];
    if (u + minU * scale <= -halfWidth || u + maxU * scale >= halfWidth ||
        v + minV * scale <= -halfHeight || v + maxV * scale >= halfHeight)
      return false;
  }
  return true;
}
