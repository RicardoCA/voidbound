import { hash, random } from "../game/procedural/random";

const ores = [
  "iron",
  "copper",
  "crystal",
  "rawFuel",
  "titanium",
  "silicon",
] as const;
export type AsteroidOre = (typeof ores)[number];

export interface Asteroid {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  ore: AsteroidOre;
}

export function asteroidsIn(systemId: string): Asteroid[] {
  const r = random(hash(systemId + ":asteroids"));
  return Array.from({ length: 70 }, (_, i) => ({
    id: `${systemId}:a${i}`,
    name: `Asteroide ${String(i + 1).padStart(2, "0")}`,
    x: 80 + r() * 6400,
    y: -800 + r() * 2000,
    r: 7 + r() * 13,
    ore: ores[i % ores.length]!,
  }));
}

export const ASTEROID_RESPAWN_SECONDS = 600;

export interface AsteroidRespawn {
  generation: number;
  readyAt: number;
}

export function availableAsteroids(
  field: Asteroid[],
  depleted: ReadonlySet<string>,
  respawns: Record<string, AsteroidRespawn> | undefined,
  activeTime: number,
) {
  return field.flatMap((rock) => {
    const respawn =
      respawns?.[rock.id] ??
      (depleted.has(rock.id)
        ? { generation: 1, readyAt: ASTEROID_RESPAWN_SECONDS }
        : undefined);
    if (!respawn) return [rock];
    if (activeTime < respawn.readyAt) return [];
    const generation = respawn.generation;
    return [
      {
        ...rock,
        x: 80 + ((rock.x - 80 + ((generation * 1739) % 6400)) % 6400),
        y: -800 + ((rock.y + 800 + ((generation * 557) % 2000)) % 2000),
      },
    ];
  });
}
