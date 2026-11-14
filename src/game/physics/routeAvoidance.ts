interface Motion {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Obstacle extends Motion {
  radius: number;
}

export function avoidRouteObstacles(
  ship: Motion,
  desired: { x: number; y: number },
  acceleration: number,
  obstacles: Obstacle[],
) {
  const speed = Math.hypot(desired.x, desired.y);
  const heading = Math.atan2(desired.y, desired.x);
  const horizon = 2 + Math.hypot(ship.vx, ship.vy) / acceleration;
  const nearby = obstacles.filter(
    (obstacle) =>
      Math.hypot(obstacle.x - ship.x, obstacle.y - ship.y) <=
      obstacle.radius +
        horizon *
          (Math.max(speed, Math.hypot(ship.vx, ship.vy)) +
            Math.hypot(obstacle.vx, obstacle.vy)),
  );
  if (!nearby.length) return desired;

  let best = desired;
  let bestScore = -Infinity;
  for (const angle of [0, 25, -25, 50, -50, 80, -80, 115, -115, 180, null]) {
    const bearing = heading + ((angle ?? 0) * Math.PI) / 180;
    const velocity =
      angle === null
        ? { x: 0, y: 0 }
        : {
            x: Math.cos(bearing) * speed,
            y: Math.sin(bearing) * speed,
          };
    let { x, y, vx, vy } = ship;
    let clearance = Infinity;
    for (let t = 0.15; t <= horizon; t += 0.15) {
      const dx = velocity.x - vx;
      const dy = velocity.y - vy;
      const fraction = Math.min(
        1,
        (acceleration * 0.15) / Math.max(0.001, Math.hypot(dx, dy)),
      );
      vx += dx * fraction;
      vy += dy * fraction;
      x += vx * 0.15;
      y += vy * 0.15;
      for (const obstacle of nearby)
        clearance = Math.min(
          clearance,
          Math.hypot(
            obstacle.x + obstacle.vx * t - x,
            obstacle.y + obstacle.vy * t - y,
          ) - obstacle.radius,
        );
    }
    if (angle === 0 && clearance >= 0) return desired;
    const score =
      (clearance >= 0 ? 1000 : clearance * 10) -
      (angle === null ? 100 : Math.abs(angle)) +
      Math.min(20, clearance);
    if (score > bestScore) {
      bestScore = score;
      best = velocity;
    }
  }
  return best;
}
