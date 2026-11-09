import { hash, random } from "../game/procedural/random";

export const starClasses = {
  red: {
    name: "Anã vermelha",
    color: "#ff765f",
    radius: 49,
    danger: 118,
    damage: 8,
  },
  yellow: {
    name: "Estrela amarela",
    color: "#ffc75f",
    radius: 68,
    danger: 150,
    damage: 12,
  },
  blue: {
    name: "Estrela azul",
    color: "#7dbbff",
    radius: 79,
    danger: 175,
    damage: 18,
  },
  giant: {
    name: "Gigante vermelha",
    color: "#ff9952",
    radius: 105,
    danger: 205,
    damage: 16,
  },
  white: {
    name: "Anã branca",
    color: "#e9f5ff",
    radius: 36,
    danger: 112,
    damage: 14,
  },
  neutron: {
    name: "Estrela de nêutrons",
    color: "#ce9bff",
    radius: 24,
    danger: 155,
    damage: 28,
  },
} as const;
export type StarKind = keyof typeof starClasses;
export const starKinds = Object.keys(starClasses) as StarKind[];
export type HeatDeflector = `deflector-${StarKind}`;
export const deflectorFor = (kind: StarKind): HeatDeflector =>
  `deflector-${kind}`;
export const isHeatDeflector = (id: string) =>
  starKinds.some((kind) => deflectorFor(kind) === id);

export interface StellarBody {
  id: string;
  kind: StarKind;
  x: number;
  y: number;
}

export function systemStars(
  id: string,
  primary: StarKind,
  home: boolean,
): StellarBody[] {
  const r = random(hash(id + ":stars"));
  const multiple = r();
  const count = home || multiple < 0.68 ? 1 : multiple < 0.93 ? 2 : 3;
  const kinds = [
    home ? "yellow" : r() < 0.08 ? "neutron" : primary,
  ] as StarKind[];
  while (kinds.length < count)
    kinds.push(starKinds[Math.floor(r() * starKinds.length)]!);
  return kinds.map((kind, index) => ({
    id: `${id}:star:${index}`,
    kind,
    x: -230 - index * 450,
    y: 120 + (index === 1 ? -290 : index === 2 ? 250 : 0),
  }));
}

export function starSystemLabel(stars: readonly StellarBody[]) {
  return stars.length === 1
    ? "Sistema simples"
    : stars.length === 2
      ? "Sistema binário"
      : "Sistema triplo";
}

export function stellarExposure(
  stars: readonly StellarBody[],
  ship: { x: number; y: number },
  upgrades: readonly string[],
) {
  return stars
    .flatMap((star) => {
      const data = starClasses[star.kind];
      const distance = Math.hypot(ship.x - star.x, ship.y - star.y);
      if (distance > data.danger) return [];
      const protectedByDeflector = upgrades.includes(deflectorFor(star.kind));
      const intensity = Math.min(
        1,
        Math.max(0.2, (data.danger - distance) / (data.danger - data.radius)),
      );
      return [
        {
          star,
          data,
          distance,
          protectedByDeflector,
          damage: protectedByDeflector ? 0 : data.damage * intensity,
        },
      ];
    })
    .sort((a, b) => b.damage - a.damage || a.distance - b.distance);
}
