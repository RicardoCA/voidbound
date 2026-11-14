import type Phaser from "phaser";
import type { ShipModelId } from "../types";

const HANGAR = -420;
const bridgePosition = (slots: number) => Math.max(420, -290 + slots * 74);

export class ColossalInterior {
  private x = HANGAR;
  private y = 16;
  private facing = 1;
  private stride = 0;

  reset() {
    this.x = HANGAR;
    this.y = 16;
    this.stride = 0;
  }

  walk(x: number, y: number, dt: number, slots: number) {
    const step = (140 * dt) / Math.max(1, Math.hypot(x, y));
    const nextX = Math.max(
      -455,
      Math.min(bridgePosition(slots) + 35, this.x + x * step),
    );
    const nextY = Math.max(-43, Math.min(62, this.y + y * step));
    this.stride =
      nextX === this.x && nextY === this.y ? 0 : this.stride + dt * 16;
    this.x = nextX;
    this.y = nextY;
    if (x) this.facing = x;
  }

  contact(slots: number) {
    if (Math.hypot(this.x - HANGAR, this.y - 16) < 42) return "colossal-hangar";
    if (Math.hypot(this.x - bridgePosition(slots), this.y - 16) < 42)
      return "colossal-bridge";
    return "";
  }

  draw(
    g: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    ships: ShipModelId[],
    slots: number,
    drawPlayer: (x: number, y: number, step: number, facing: number) => void,
    drawShip: (model: ShipModelId, x: number, y: number) => void,
  ) {
    const left = width / 2 - this.x;
    const top = height * 0.52;
    const bridge = bridgePosition(slots);
    const right = bridge + 60;
    g.fillStyle(0x132638).fillRect(left - 480, top - 78, right + 480, 145);
    g.fillStyle(0x263d4c).fillRect(left - 480, top - 45, right + 480, 113);
    for (let x = -480; x < right; x += 24) {
      if (left + x < 0 || left + x > width) continue;
      g.lineStyle(1, 0x4d6475, 0.55).lineBetween(
        left + x,
        top - 45,
        left + x,
        top + 68,
      );
    }
    for (const y of [-45, -12, 22, 68])
      g.lineStyle(1, 0x5a7483).lineBetween(
        left - 480,
        top + y,
        left + right,
        top + y,
      );
    g.fillStyle(0xf2bb68).fillRect(left + HANGAR - 25, top - 11, 50, 13);
    g.fillStyle(0x73dbc8).fillRect(left + bridge - 25, top - 11, 50, 13);
    for (let i = 0; i < slots; i++) {
      const x = left - 354 + i * 74;
      if (x < -58 || x > width) continue;
      g.lineStyle(1, 0xd6ab6e).strokeRect(x, top - 40, 58, 23);
      const model = ships[i];
      if (model) drawShip(model, x + 29, top - 28);
    }
    drawPlayer(width / 2, top + this.y, Math.sin(this.stride) * 2, this.facing);
  }
}
