import { showroomSpawn } from "../station/showroom";
import { shallowReactive } from "vue";
import { hash } from "../procedural/random";
import type { Bolt } from "../../combat/flight";

export function spaceAltitude(
  kind: "planet" | "star" | "asteroid",
  id: string,
) {
  const spread = kind === "planet" ? 420 : kind === "star" ? 300 : 260;
  return (hash(kind + ":" + id) % (spread * 2 + 1)) - spread;
}

export const flight3D = shallowReactive({
  enabled: false,
  selected: false,
  colossalBoarding: undefined as
    { x: number; y: number; altitude: number; elapsed: number } | undefined,
  colossal: {
    room: "hangar" as "hangar" | "reactor" | "bridge",
    x: 48,
    z: 16,
    stride: 0,
    heading: -Math.PI / 2,
  },
  colossalView: false,
  stationView: false,
  showroom: { ...showroomSpawn },
  station: { x: -274, z: -38, heading: -Math.PI / 2, stride: 0 },
  cabin: { x: 145, z: -24, stride: 0, heading: -Math.PI / 2 },
  pitch: 0,
  altitude: 0,
  velocity: 0,
  thrust: false,
  touchPitch: 0,
  bolts: [] as readonly Bolt[],
  beam: undefined as
    | { x: number; y: number; tx: number; ty: number; targetAltitude?: number }
    | undefined,
  reset() {
    this.bolts = [];
    this.beam = undefined;
    this.pitch = 0;
    this.altitude = 0;
    this.velocity = 0;
    this.thrust = false;
    this.touchPitch = 0;
  },
});
