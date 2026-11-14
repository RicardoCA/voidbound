type Position = { x: number; y: number; altitude: number };

export function resolveStellarCollision(
  ship: Position & { vx: number; vy: number; verticalSpeed: number },
  star: Position & { radius: number },
) {
  const clearance = star.radius + 48;
  const dx = ship.x - star.x;
  const dy = ship.y - star.y;
  const dz = ship.altitude - star.altitude;
  const distance = Math.hypot(dx, dy, dz);
  if (distance >= clearance) return;
  const nx = distance ? dx / distance : 1;
  const ny = distance ? dy / distance : 0;
  const nz = distance ? dz / distance : 0;
  ship.x = star.x + nx * clearance;
  ship.y = star.y + ny * clearance;
  ship.altitude = star.altitude + nz * clearance;
  const inward = Math.min(
    0,
    ship.vx * nx + ship.vy * ny + ship.verticalSpeed * nz,
  );
  ship.vx -= nx * inward * 1.2;
  ship.vy -= ny * inward * 1.2;
  ship.verticalSpeed -= nz * inward * 1.2;
}
