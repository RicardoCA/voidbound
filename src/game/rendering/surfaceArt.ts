import type Phaser from "phaser";
import type { BuildItem, PlacedPiece } from "../types";

const sprites = "surface-sprites";
const materials = "surface-wood-and-deposits";
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
    scene.load.spritesheet(materials, path + "wood-and-deposits.webp", {
      frameWidth: 32,
      frameHeight: 32,
    });
    for (let kind = 0; kind < 6; kind++) {
      scene.load.spritesheet(ground(kind), path + "ground-" + kind + ".webp", {
        frameWidth: 32,
        frameHeight: 32,
      });
      scene.load.image(horizon(kind), path + "horizon-" + kind + ".webp");
    }
  }

  prepareDoor(scene: Phaser.Scene) {
    if (!scene.textures.exists(sprites)) return;
    const atlas = scene.textures.get(sprites);
    if (!atlas.has("woodDoor") || atlas.has("doorHeader")) return;
    const door = atlas.get("woodDoor");
    const jamb = Math.round(door.cutWidth * 0.16);
    const header = Math.round(door.cutHeight * 0.19);
    const height = door.cutHeight - header;
    const add = (name: string, x: number, y: number, w: number, h: number) =>
      atlas.add(name, door.sourceIndex, door.cutX + x, door.cutY + y, w, h);
    add("doorHeader", 0, 0, door.cutWidth, header);
    add("doorLeft", 0, header, jamb, height);
    add("doorRight", door.cutWidth - jamb, header, jamb, height);
    add("doorLeaf", jamb, header, door.cutWidth - 2 * jamb, height);
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
    // Snap the strip width and shared scroll so the mirrored edges touch every frame.
    const span = Math.ceil(Math.max(width, height * 2.65));
    const scroll = Math.round(cameraX * 0.15 + span * 0.22);
    const strip = Math.floor(scroll / span);
    for (let i = 0; i < 2; i++) {
      const image = (this.horizons[i] ??= scene.add
        .image(0, 0, texture)
        .setOrigin(0)
        .setDepth(-1.5));
      image
        .setTexture(texture)
        .setDisplaySize(span, height)
        .setPosition((strip + i) * span - scroll, 0)
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
    key: string | number,
    x: number,
    groundY: number,
    width: number,
    height: number,
    flip = false,
    alpha = 1,
    depth = -0.05,
    texture = sprites,
  ) {
    if (
      !scene.textures.exists(texture) ||
      !scene.textures.get(texture).has(String(key))
    )
      return false;
    const index = this.actorCount++;
    const image = (this.actors[index] ??= scene.add
      .image(0, 0, texture)
      .setOrigin(0.5, 1));
    image
      .setTexture(texture, key)
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

  deposit(
    scene: Phaser.Scene,
    tile: number,
    x: number,
    y: number,
    column: number,
    row: number,
  ) {
    if (tile < 2 || tile > 11) return false;
    const flip = ((column ^ row) & 1) !== 0;
    const size = 12 + ((column + row) & 1);
    return this.sprite(
      scene,
      tile,
      x + 8,
      y + 15,
      size,
      size,
      flip,
      1,
      -0.15,
      materials,
    );
  }

  private openDoor(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1) {
    if (
      !scene.textures.exists(sprites) ||
      !scene.textures.get(sprites).has("doorHeader")
    )
      return false;
    const bottom = y + 16;
    const pieces = [
      {
        frame: "doorHeader",
        center: 8,
        bottom: bottom - 26,
        width: 16,
        height: 6,
      },
      { frame: "doorLeft", center: 1, bottom, width: 2, height: 26 },
      { frame: "doorRight", center: 15, bottom, width: 2, height: 26 },
      {
        frame: "doorLeaf",
        center: facing === 1 ? 3 : 13,
        bottom,
        width: 4,
        height: 26,
      },
    ];
    for (const piece of pieces) {
      this.sprite(
        scene,
        piece.frame,
        x + piece.center,
        piece.bottom,
        piece.width,
        piece.height,
        false,
        1,
        -0.02,
      );
      this.actors[this.actorCount - 1]!.setDisplaySize(
        piece.width,
        piece.height,
      );
    }
    return true;
  }

  prop(
    scene: Phaser.Scene,
    kind: BuildItem,
    x: number,
    y: number,
    alpha: number,
    state?: PlacedPiece,
  ) {
    if (kind === "woodBlock" || kind === "woodWall") {
      const depth = alpha < 1 ? -0.01 : kind === "woodWall" ? -0.4 : -0.02;
      return this.sprite(
        scene,
        kind === "woodBlock" ? 0 : 1,
        x + 8,
        y + 16,
        16,
        16,
        false,
        alpha,
        depth,
        materials,
      );
    }
    const door = kind === "woodDoor";
    if (door && state?.open) return this.openDoor(scene, x, y, state.facing);
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
