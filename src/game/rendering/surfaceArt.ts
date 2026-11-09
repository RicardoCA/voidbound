import type Phaser from "phaser";
import type { BuildItem } from "../types";

const sprites = "surface-sprites";
const path = import.meta.env.BASE_URL + "surface/";
const ground = (kind: number) => "surface-ground-" + kind;
const horizon = (kind: number) => "surface-horizon-" + kind;

export class SurfaceArt {
  private tiles: Phaser.GameObjects.Image[] = [];
  private actors: Phaser.GameObjects.Image[] = [];
  private horizons: Phaser.GameObjects.Image[] = [];
  private tileCount = 0;
  private actorCount = 0;
  private tint = 0xffffff;
  private kind = 0;

  preload(scene: Phaser.Scene) {
    scene.load.atlas(sprites, path + "sprites.webp", path + "sprites.json");
    for (let kind = 0; kind < 6; kind++) {
      scene.load.spritesheet(ground(kind), path + "ground-" + kind + ".webp", {
        frameWidth: 32,
        frameHeight: 32,
      });
      scene.load.image(horizon(kind), path + "horizon-" + kind + ".webp");
    }
  }

  reset() {
    for (let i = 0; i < this.tileCount; i++) this.tiles[i]!.setVisible(false);
    for (let i = 0; i < this.actorCount; i++) this.actors[i]!.setVisible(false);
    for (const image of this.horizons) image.setVisible(false);
    this.tileCount = 0;
    this.actorCount = 0;
  }

  drawHorizon(
    scene: Phaser.Scene,
    kind: number,
    width: number,
    height: number,
    cameraX: number,
    light: number,
  ) {
    this.kind = kind;
    const red = Math.round(112 + light * 143);
    const green = Math.round(128 + light * 127);
    const blue = Math.round(165 + light * 90);
    this.tint = (red << 16) | (green << 8) | blue;

    const texture = horizon(kind);
    if (!scene.textures.exists(texture)) return false;
    const span = Math.max(width, height * 2.65);
    const scroll = cameraX * 0.15 + span * 0.22;
    const strip = Math.floor(scroll / span);
    for (let i = 0; i < 2; i++) {
      const image = (this.horizons[i] ??= scene.add
        .image(0, 0, texture)
        .setOrigin(0)
        .setDepth(-1.5));
      image
        .setTexture(texture)
        .setDisplaySize(span, height)
        .setPosition(Math.round((strip + i) * span - scroll), 0)
        .setFlipX((strip + i) % 2 !== 0)
        .setTint(this.tint)
        .setAlpha(0.52 + light * 0.48)
        .setVisible(true);
    }
    return true;
  }

  tile(scene: Phaser.Scene, x: number, y: number, column: number, row: number) {
    const texture = ground(this.kind);
    if (!scene.textures.exists(texture)) return false;
    const index = this.tileCount++;
    const image = (this.tiles[index] ??= scene.add
      .image(0, 0, texture)
      .setOrigin(0)
      .setDepth(-0.25));
    image
      .setTexture(texture, (row & 15) * 16 + (column & 15))
      .setPosition(x, y)
      .setDisplaySize(16, 16)
      .setVisible(true);
    return true;
  }

  sprite(
    scene: Phaser.Scene,
    key: string,
    x: number,
    groundY: number,
    width: number,
    height: number,
    flip = false,
    alpha = 1,
    depth = -0.05,
  ) {
    if (
      !scene.textures.exists(sprites) ||
      !scene.textures.get(sprites).has(key)
    )
      return false;
    const index = this.actorCount++;
    const image = (this.actors[index] ??= scene.add
      .image(0, 0, sprites)
      .setOrigin(0.5, 1));
    image
      .setTexture(sprites, key)
      .setPosition(Math.round(x), Math.round(groundY))
      .setDepth(depth)
      .setFlipX(flip)
      .setTint(this.tint)
      .setAlpha(alpha)
      .setVisible(true);
    const scale = Math.min(
      width / image.frame.width,
      height / image.frame.height,
    );
    image.setScale(scale);
    return true;
  }

  prop(
    scene: Phaser.Scene,
    kind: BuildItem,
    x: number,
    y: number,
    alpha: number,
  ) {
    const door = kind === "woodDoor";
    const drawn = this.sprite(
      scene,
      kind,
      x + 8,
      y + 16,
      16,
      door ? 32 : 16,
      false,
      alpha,
      alpha < 1 ? 0.1 : -0.02,
    );
    if (drawn && door) this.actors[this.actorCount - 1]!.setDisplaySize(16, 32);
    return drawn;
  }
}
