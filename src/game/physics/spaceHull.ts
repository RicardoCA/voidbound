type Body = { x: number; y: number; vx: number; vy: number };

export function resolveSpaceHull(
  body: Body,
  hull: { x: number; y: number },
  heading: number,
  halfLength: number,
  halfWidth: number,
) {
  const cos = Math.cos(heading),
    sin = Math.sin(heading);
  const dx = body.x - hull.x,
    dy = body.y - hull.y;
  const along = dx * cos + dy * sin;
  const across = -dx * sin + dy * cos;
  const lengthOverlap = halfLength - Math.abs(along);
  const widthOverlap = halfWidth - Math.abs(across);
  if (lengthOverlap <= 0 || widthOverlap <= 0) return;
  const end = lengthOverlap < widthOverlap;
  const sign = Math.sign(end ? along : across) || 1;
  const nx = (end ? cos : -sin) * sign;
  const ny = (end ? sin : cos) * sign;
  const overlap = (end ? lengthOverlap : widthOverlap) + 0.1;
  body.x += nx * overlap;
  body.y += ny * overlap;
  const inward = Math.min(0, body.vx * nx + body.vy * ny);
  body.vx -= 1.25 * inward * nx;
  body.vy -= 1.25 * inward * ny;
}
