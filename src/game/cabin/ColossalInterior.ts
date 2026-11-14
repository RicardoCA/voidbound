import type Phaser from "phaser";
import type { ShipModelId } from "../types";

const assets = ["console", "bay", "bulkhead", "reactor", "bridge"] as const;
type Art = (typeof assets)[number];
type Room = "hangar" | "reactor" | "bridge";
const CONSOLE_WIDTH = 122;
const BAY_WIDTH = 79;
const BULKHEAD_WIDTH = 102;
const ROOM_WIDTH = 480;
const hangarDoor = (slots: number) =>
  CONSOLE_WIDTH + slots * BAY_WIDTH + BULKHEAD_WIDTH / 2;

export class ColossalInterior {
  private room: Room = "hangar";
  private x = 48;
  private y = 16;
  private facing = 1;
  private stride = 0;
  private images: Phaser.GameObjects.Image[] = [];
  private visible = 0;

  preload(scene: Phaser.Scene) {
    for (const asset of assets)
      scene.load.image(
        "colossal-room:" + asset,
        import.meta.env.BASE_URL + "colossal/" + asset + ".webp",
      );
  }

  reset() {
    this.room = "hangar";
    this.x = 48;
    this.y = 16;
    this.stride = 0;
  }

  hide() {
    for (let i = 0; i < this.visible; i++) this.images[i]!.setVisible(false);
    this.visible = 0;
  }

  walk(x: number, y: number, dt: number, slots: number) {
    const step = (140 * dt) / Math.max(1, Math.hypot(x, y));
    const right =
      this.room === "hangar" ? hangarDoor(slots) + 35 : ROOM_WIDTH - 18;
    const nextX = Math.max(18, Math.min(right, this.x + x * step));
    const nextY = Math.max(4, Math.min(24, this.y + y * step));
    this.stride =
      nextX === this.x && nextY === this.y ? 0 : this.stride + dt * 16;
    this.x = nextX;
    this.y = nextY;
    if (x) this.facing = x;
  }

  contact(slots: number) {
    const near = (x: number) => Math.abs(this.x - x) < 30;
    if (this.room === "hangar") {
      if (near(48)) return "colossal-hangar";
      if (near(hangarDoor(slots))) return "colossal-enter-bridge";
    } else if (this.room === "bridge") {
      if (near(44)) return "colossal-return-hangar";
      if (near(210)) return "colossal-map";
      if (near(340)) return "colossal-bridge";
      if (near(435)) return "colossal-enter-reactor";
    } else {
      if (near(44)) return "colossal-return-bridge";
      if (near(240)) return "colossal-reactor";
    }
    return "";
  }

  enter(contact: string, slots: number) {
    switch (contact) {
      case "colossal-enter-bridge":
        this.room = "bridge";
        this.x = 44;
        break;
      case "colossal-return-hangar":
        this.room = "hangar";
        this.x = hangarDoor(slots);
        break;
      case "colossal-enter-reactor":
        this.room = "reactor";
        this.x = 44;
        break;
      case "colossal-return-bridge":
        this.room = "bridge";
        this.x = 435;
        break;
      default:
        return false;
    }
    this.y = 16;
    this.stride = 0;
    return true;
  }

  draw(
    scene: Phaser.Scene,
    width: number,
    height: number,
    ships: ShipModelId[],
    slots: number,
    drawPlayer: (x: number, y: number, step: number, facing: number) => void,
    drawShip: (model: ShipModelId, x: number, y: number) => void,
  ) {
    const left = width / 2 - this.x;
    const floor = height * 0.58;
    const image = (asset: Art, x: number, y: number, w: number, h: number) => {
      if (left + x + w <= 0 || left + x >= width) return;
      const texture = "colossal-room:" + asset;
      const index = this.visible++;
      (this.images[index] ??= scene.add
        .image(0, 0, texture)
        .setOrigin(0)
        .setDepth(-0.2))
        .setTexture(texture)
        .setPosition(Math.round(left + x), Math.round(floor + y))
        .setDisplaySize(w, h)
        .setVisible(true);
    };

    if (this.room === "hangar") {
      image("console", 0, -112, CONSOLE_WIDTH, 184);
      for (let i = 0; i < slots; i++) {
        const x = CONSOLE_WIDTH + i * BAY_WIDTH;
        image("bay", x, -112, BAY_WIDTH, 184);
        const model = ships[i];
        if (model && left + x + BAY_WIDTH > 0 && left + x < width)
          drawShip(model, left + x + BAY_WIDTH / 2, floor - 10);
      }
      image(
        "bulkhead",
        CONSOLE_WIDTH + slots * BAY_WIDTH,
        -112,
        BULKHEAD_WIDTH,
        184,
      );
    } else {
      image(this.room, 0, -91, ROOM_WIDTH, 126);
    }
    drawPlayer(
      width / 2,
      floor + this.y,
      Math.sin(this.stride) * 2,
      this.facing,
    );
  }
}
