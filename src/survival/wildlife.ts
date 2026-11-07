import type { Item, Planet, Settlement } from "../game/types";
import type { Terrain } from "../game/procedural/terrain";
import { hash } from "../game/procedural/random";
import { solidCell, stepSurface, type Actor } from "../game/physics/surface";

const biomeLife = [
  {
    fruit: "basaltBerry",
    fruitColor: 0xcf93e7,
    peaceful: "Lagarto de basalto",
    hostile: "Rastejante de obsidiana",
    hide: 0xa6959c,
    crest: 0x75c3ba,
  },
  {
    fruit: "amberFig",
    fruitColor: 0xe9ba63,
    peaceful: "Lebre âmbar",
    hostile: "Chacal de dunas",
    hide: 0xc9a570,
    crest: 0xddbd84,
  },
  {
    fruit: "frostPlum",
    fruitColor: 0x99ddef,
    peaceful: "Lêmure glacial",
    hostile: "Urso de geada",
    hide: 0xbcd4e1,
    crest: 0x82b6d1,
  },
  {
    fruit: "jadePear",
    fruitColor: 0xc9e475,
    peaceful: "Cervo de jade",
    hostile: "Felino da copa",
    hide: 0x82a57c,
    crest: 0xb3c47b,
  },
  {
    fruit: "emberFruit",
    fruitColor: 0xfa9868,
    peaceful: "Tatu de cinzas",
    hostile: "Salamandra brasa",
    hide: 0xb87261,
    crest: 0xe6a567,
  },
  {
    fruit: "tideMelon",
    fruitColor: 0x70dbb9,
    peaceful: "Caranguejo de maré",
    hostile: "Víbora do mangue",
    hide: 0x6daba4,
    crest: 0x81c3d0,
  },
] satisfies {
  fruit: Item;
  fruitColor: number;
  peaceful: string;
  hostile: string;
  hide: number;
  crest: number;
}[];

export interface Fruit {
  id: string;
  x: number;
  y: number;
  item: Item;
  color: number;
}

export interface Animal extends Actor {
  id: string;
  home: number;
  name: string;
  hostile: boolean;
  health: number;
  maxHealth: number;
  hide: number;
  crest: number;
  facing: number;
  nextAttack: number;
  kind: number;
}

export const FRUIT_REGROWTH = 180;
export const FAUNA_RETURN = 300;

function available(
  history: Record<string, number> | undefined,
  id: string,
  time: number,
) {
  return (history?.[id] ?? 0) <= time;
}

export function fruitsNear(
  planet: Planet,
  terrain: Terrain,
  settlement: Settlement,
  worldX: number,
  time: number,
) {
  const life = biomeLife[planet.kind]!,
    fruit: Fruit[] = [];
  const cell = Math.floor(worldX / (16 * 14));
  for (let i = cell - 3; i <= cell + 3; i++) {
    const id = `fruit:${i}`;
    if (!available(settlement.foraged, id, time)) continue;
    const tx = i === 0 ? 6 : i * 14 + 5 + (hash(`${planet.seed}:${id}`) % 5);
    const ground = terrain.height(tx);
    if (
      !terrain.get(tx, ground) ||
      solidCell(terrain, settlement, tx, ground - 1)
    )
      continue;
    fruit.push({
      id,
      x: tx * 16 + 8,
      y: ground * 16 - 8,
      item: life.fruit,
      color: life.fruitColor,
    });
  }
  return fruit;
}

export function clearPath(
  terrain: Terrain,
  settlement: Settlement,
  x: number,
  y: number,
  tx: number,
  ty: number,
) {
  const steps = Math.ceil(Math.hypot(tx - x, ty - y) / 8);
  for (let step = 1; step < steps; step++) {
    const t = step / steps;
    if (
      solidCell(
        terrain,
        settlement,
        Math.floor((x + (tx - x) * t) / 16),
        Math.floor((y + (ty - y) * t) / 16),
      )
    )
      return false;
  }
  return true;
}

export class Wildlife {
  readonly animals = new Map<string, Animal>();

  update(
    planet: Planet,
    terrain: Terrain,
    settlement: Settlement,
    player: { x: number; y: number; health: number },
    time: number,
    dt: number,
  ) {
    const life = biomeLife[planet.kind]!;
    const cell = Math.floor(player.x / (16 * 20));
    const visible = new Set<string>();
    for (let i = cell - 2; i <= cell + 2; i++) {
      const id = `animal:${i}`;
      if (!available(settlement.hunted, id, time)) continue;
      visible.add(id);
      if (!this.animals.has(id)) {
        const seed = hash(`${planet.seed}:${id}`);
        let tile = i * 20 + 10 + (seed % 3);
        for (const pad of [0, 24, 48])
          if (Math.abs(tile - pad) < 6) tile = pad + 6;
        const ground = terrain.height(tile);
        if (solidCell(terrain, settlement, tile, ground - 1)) continue;
        const hostile = i === 0 ? false : i === 1 ? true : seed % 3 === 0;
        const health = hostile ? 3 : 2;
        this.animals.set(id, {
          id,
          home: tile * 16 + 8,
          x: tile * 16 + 8,
          y: ground * 16 - 12,
          vy: 0,
          grounded: false,
          hostile,
          health,
          maxHealth: health,
          name: hostile ? life.hostile : life.peaceful,
          hide: life.hide,
          crest: life.crest,
          facing: 1,
          nextAttack: time + 1,
          kind: planet.kind,
        });
      }
    }

    for (const [id, animal] of this.animals) {
      if (!visible.has(id)) {
        this.animals.delete(id);
        continue;
      }
      const distance = Math.hypot(player.x - animal.x, player.y - animal.y);
      const chasing =
        animal.hostile &&
        distance < 115 &&
        Math.abs(player.x - animal.home) < 200 &&
        clearPath(terrain, settlement, animal.x, animal.y, player.x, player.y);
      const patrol = animal.home + Math.sin(time * 0.55 + animal.home) * 23;
      const dx = (chasing ? player.x : patrol) - animal.x;
      const direction = Math.abs(dx) < (chasing ? 14 : 4) ? 0 : Math.sign(dx);
      if (direction) animal.facing = direction;
      const result = stepSurface(
        animal,
        direction * (chasing ? 0.55 : 0.22),
        false,
        planet.gravity,
        dt,
        terrain,
        settlement,
      );
      Object.assign(animal, result);
      if (chasing && distance < 24 && time >= animal.nextAttack) {
        player.health -= 9;
        animal.nextAttack = time + 1.3;
      }
    }
  }
}
