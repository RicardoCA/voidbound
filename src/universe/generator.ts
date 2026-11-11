import { blackHoleAt } from "./blackHoles";
import { hash, random, LRU } from "../game/procedural/random";
import { starClasses, systemStars } from "./stars";
import type { Station, StarSystem } from "../game/types";
const cache = new LRU<string, StarSystem>(40);
export function systemAt(seed: string, x: number, y: number): StarSystem {
  const id = `${seed}:${x}:${y}`,
    cached = cache.get(id);
  if (cached) return cached;
  const r = random(hash(id)),
    names = [
      "Veyra",
      "Ortheon",
      "Talos",
      "Kepleris",
      "Aster",
      "Nimara",
      "Elyon",
      "Solis",
      "Nox",
      "Caelis",
    ];
  const name = `${names[Math.floor(r() * names.length)]}-${Math.floor(r() * 900 + 100)}`;
  // Keep the original draw in the seed stream for existing planet generation.
  const legacyKind = (["red", "yellow", "blue", "giant", "white"] as const)[
    Math.floor(r() * 5)
  ]!;
  const stars = systemStars(id, legacyKind, x === 0 && y === 0);
  const star = starClasses[stars[0]!.kind].name;
  const planets = Array.from({ length: 1 + Math.floor(r() * 8) }, (_, i) => {
    const ps = hash(`${id}:planet:${i}`),
      p = random(ps),
      kind =
        x === 0 && y === 0 && i === 0
          ? 0
          : Math.floor((p() * 6 + (legacyKind === "blue" ? 1 : 0)) % 6);
    return {
      id: `${id}:p${i}`,
      seed: ps,
      name: `${name} ${["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][i]}`,
      kind,
      gravity: 0.5 + p() * 1.1,
      temperature: [12, 66, -70, 24, 150, 18][kind]!,
      breathable: kind === 3 || kind === 5,
      color: [0x9b817c, 0xd6b47c, 0x99c7d8, 0x7dab9b, 0xdb8064, 0x6db8c3][
        kind
      ]!,
      radius: 1000 + Math.floor(p() * 9000),
    };
  });
  const stationSeed = hash(`${id}:station`);
  const clandestine =
    (y === 0 && x === 1) ||
    (!(x === 0 && y === 0) && hash(`${id}:black-market`) % 3 === 0);
  const station: Station | undefined =
    (y === 0 && (x === 0 || x === 1)) || stationSeed % 3 === 0
      ? {
          id: `${id}:station`,
          kind: clandestine ? "clandestine" : "standard",
          name: clandestine ? `Estação Clandestina ${name}` : `Estação ${name}`,
          x: 100 + (stationSeed % 80),
          y: 560,
        }
      : undefined;
  return cache.set(id, {
    id,
    x,
    y,
    name,
    star,
    stars,
    planets,
    station,
    blackHole: blackHoleAt(id, x === 0 && y === 0),
  });
}
export function systemExists(seed: string, x: number, y: number) {
  return (
    (y === 0 && (x === 0 || x === 1)) ||
    hash(`${seed}:${x}:${y}:exists`) % 5 !== 0
  );
}
export function nearby(seed: string, x: number, y: number, radius = 3) {
  const result: StarSystem[] = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      if ((dx === 0 && dy === 0) || systemExists(seed, x + dx, y + dy))
        result.push(systemAt(seed, x + dx, y + dy));
    }
  return result;
}
export function planetPosition(index: number) {
  return { x: 530 + index * 860, y: 330 + Math.sin(index * 2) * 500 };
}
