interface Motion {
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
}

interface Obstacle extends Motion {
  radius: number;
}

export function avoidRouteObstacles(
  ship: Motion,
  desired: { x: number; y: number; z?: number },
  acceleration: number,
  obstacles: Obstacle[],
) {
  const speed = Math.hypot(desired.x, desired.y, desired.z ?? 0);
  const heading = Math.atan2(desired.y, desired.x);
  const pitch = Math.atan2(desired.z ?? 0, Math.hypot(desired.x, desired.y));
  const shipSpeed = Math.hypot(ship.vx, ship.vy, ship.vz ?? 0);
  const horizon = 2 + shipSpeed / acceleration;
  const nearby = obstacles.filter(
    (obstacle) =>
      Math.hypot(obstacle.x - ship.x, obstacle.y - ship.y, (obstacle.z ?? 0) - (ship.z ?? 0)) <=
      obstacle.radius +
        horizon *
          (Math.max(speed, shipSpeed) +
            Math.hypot(obstacle.vx, obstacle.vy, obstacle.vz ?? 0)),
  );
  if (!nearby.length) return desired;

  let best = desired;
  let bestScore = -Infinity;
  const yawChoices = [0, 25, -25, 50, -50, 80, -80, 115, -115, 180];
  const candidates: [number, number][] = yawChoices.map((angle) => [angle, 0]);
  if (ship.z !== undefined)
    candidates.push([0, 25], [0, -25], [0, 50], [0, -50], [25, 25], [-25, 25],
      [25, -25], [-25, -25], [0, 90], [0, -90]);
  // The final candidate brakes along all axes.
  candidates.push([0, 0]);
  for (const [index, [angle, elevation]] of candidates.entries()) {
    const braking = index === candidates.length - 1;
    const bearing = heading + angle * Math.PI / 180;
    const tilt = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + elevation * Math.PI / 180));
    const cruise = braking ? 0 : speed;
    const velocity = {
      x: Math.cos(bearing) * Math.cos(tilt) * cruise,
      y: Math.sin(bearing) * Math.cos(tilt) * cruise,
      z: Math.sin(tilt) * cruise,
    };
    let { x, y, z = 0, vx, vy, vz = 0 } = ship;
    let clearance = Infinity;
    for (let t = 0.15; t <= horizon; t += 0.15) {
      const dx = velocity.x - vx;
      const dy = velocity.y - vy;
      const dz = velocity.z - vz;
      const fraction = Math.min(
        1,
        (acceleration * 0.15) / Math.max(0.001, Math.hypot(dx, dy, dz)),
      );
      vx += dx * fraction;
      vy += dy * fraction;
      vz += dz * fraction;
      x += vx * 0.15;
      y += vy * 0.15;
      z += vz * 0.15;
      for (const obstacle of nearby)
        clearance = Math.min(
          clearance,
          Math.hypot(
            obstacle.x + obstacle.vx * t - x,
            obstacle.y + obstacle.vy * t - y,
            (obstacle.z ?? 0) + (obstacle.vz ?? 0) * t - z,
          ) - obstacle.radius,
        );
    }
    if (index === 0 && clearance >= 0) return desired;
    const score =
      (clearance >= 0 ? 1000 : clearance * 10) -
      (braking ? 100 : Math.abs(angle) + Math.abs(elevation)) +
      Math.min(20, clearance);
    if (score > bestScore) {
      bestScore = score;
      best = velocity;
    }
  }
  return best;
}
