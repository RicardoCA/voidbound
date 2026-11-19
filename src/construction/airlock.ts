import type { Settlement } from "../game/types";
import { overlapsActor } from "./pieces";

/** Pair aligned doors on the same floor, closest first, without sharing partners. */
export function airlockPartner(data: Settlement, key: string) {
  const doors = Object.entries(data.pieces).filter(
    ([, piece]) => piece.kind === "airlockDoor",
  );
  const candidates: { a: string; b: string; distance: number }[] = [];
  for (let i = 0; i < doors.length; i++) {
    const [a, first] = doors[i]!;
    const [ax = 0, ay = 0, az = 0] = a.split(",").map(Number);
    for (const [b, second] of doors.slice(i + 1)) {
      if ((first.rotation ?? 0) % 2 !== (second.rotation ?? 0) % 2) continue;
      const [bx = 0, by = 0, bz = 0] = b.split(",").map(Number);
      const along =
        (first.rotation ?? 0) % 2 ? Math.abs(ax - bx) : Math.abs(az - bz);
      const lateral =
        (first.rotation ?? 0) % 2 ? Math.abs(az - bz) : Math.abs(ax - bx);
      if (ay === by && lateral === 0 && along >= 1 && along <= 5)
        candidates.push({ a, b, distance: along });
    }
  }
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.a.localeCompare(b.a) ||
      a.b.localeCompare(b.b),
  );
  const paired = new Set<string>();
  for (const pair of candidates) {
    if (paired.has(pair.a) || paired.has(pair.b)) continue;
    if (pair.a === key) return pair.b;
    if (pair.b === key) return pair.a;
    paired.add(pair.a);
    paired.add(pair.b);
  }
}

export function toggleAirlockDoor(
  data: Settlement,
  key: string,
  actor: { x: number; y: number; surfaceZ?: number },
) {
  const door = data.pieces[key];
  if (door?.kind !== "airlockDoor") return "Porta de antecâmara indisponível.";
  const mateKey = airlockPartner(data, key),
    mate = mateKey ? data.pieces[mateKey] : undefined;
  const closingKey = door.open ? key : mate?.open ? mateKey : undefined;
  if (closingKey) {
    const [x = 0, y = 0, z = 0] = closingKey.split(",").map(Number);
    if (
      Math.abs((actor.surfaceZ ?? 0) - z * 16) < 12 &&
      overlapsActor("airlockDoor", x, y, actor)
    )
      return "Saia do vão da porta antes de acionar a antecâmara.";
  }
  if (!door.open && mate) mate.open = false;
  door.open = !door.open;
}
