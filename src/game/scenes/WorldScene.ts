import { settlementFor } from "../../construction/building";
import {
  clearPath,
  fruitsNear,
  Wildlife,
  FRUIT_REGROWTH,
  FAUNA_RETURN,
  type Fruit,
} from "../../survival/wildlife";
import { drawAnimal, drawFruit } from "../rendering/wildlife";
import { shipPalette } from "../../fleet/models";
import Phaser from "phaser";
import { useGame } from "../../stores/game";
import { useConstruction } from "../../stores/construction";
import { treesInRange, treeContains } from "../procedural/trees";
import {
  drawAlienTree,
  drawSettlement,
  drawPiece,
} from "../rendering/settlements";
import { stepSurface } from "../physics/surface";
import { footprint } from "../../construction/pieces";
import { daylight } from "../../construction/habitat";
import { biomes, type Mode } from "../types";
import { Terrain, tileItems } from "../procedural/terrain";
import { random, hash } from "../procedural/random";
import { planetPosition } from "../../universe/generator";
import {
  controls,
  takePulse,
  queuePulse,
  JumpBuffer,
  releaseControls,
  isEditing,
} from "../input";
import { audio } from "../systems/audio";
interface Rock {
  id: string;
  x: number;
  y: number;
  r: number;
  ore: "iron" | "copper" | "crystal" | "rawFuel" | "titanium" | "silicon";
  hits: number;
}
export class WorldScene extends Phaser.Scene {
  private store!: ReturnType<typeof useGame>;
  private building!: ReturnType<typeof useConstruction>;
  private treeHits = new Map<string, number>();
  private wildlife = new Wildlife();
  private fruit: Fruit[] = [];
  private surfaceTap:
    { x: number; y: number; wx: number; wy: number } | undefined;
  private gfx!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private terrain?: Terrain;
  private lastMode: Mode | "none" = "none";
  private lastSystem = "";
  private lastPlanet = "";
  private rocks: Rock[] = [];
  private camX = 0;
  private camY = 0;
  private vy = 0;
  private grounded = false;
  private mineTime = 0;
  private elapsed = 0;
  private facing = 1;
  private stars: { x: number; y: number; r: number; phase: number }[] = [];
  private particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: number;
  }[] = [];
  private beam:
    { x: number; y: number; tx: number; ty: number; life: number } | undefined;
  private interactHeld = false;
  private jumpHeld = false;
  private jumpBuffer = new JumpBuffer();
  constructor() {
    super("world");
  }
  create() {
    this.store = useGame();
    this.building = useConstruction();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        this.store.state.mode === "surface" &&
        !this.store.panel &&
        !this.store.paused
      ) {
        const wx = pointer.x - this.centerX + this.camX;
        const wy = pointer.y - this.centerY + this.camY;
        this.surfaceTap = {
          x: Math.floor(wx / 16),
          y: Math.floor(wy / 16),
          wx,
          wy,
        };
        this.building.setCursor(this.surfaceTap.x, this.surfaceTap.y);
      }
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.store.state.mode === "surface")
        this.building.setCursor(
          Math.floor((pointer.x - this.centerX + this.camX) / 16),
          Math.floor((pointer.y - this.centerY + this.camY) / 16),
        );
    });
    this.gfx = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,SPACE,E,M,I,C,ESC",
      false,
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    const suppressScroll = (event: KeyboardEvent) => {
      if (
        this.store.started &&
        !this.store.panel &&
        !this.store.paused &&
        !isEditing(event.target) &&
        ["Space", "ArrowUp", "ArrowDown"].includes(event.code)
      )
        event.preventDefault();
    };
    const focusInput = (event: FocusEvent) => {
      if (isEditing(event.target)) {
        this.input.keyboard!.resetKeys();
        this.jumpBuffer.clear();
        releaseControls();
      }
    };
    // Phaser queues the key first; only then prevent browser scrolling.
    window.addEventListener("keydown", suppressScroll);
    window.addEventListener("focusin", focusInput);
    this.events.once("shutdown", () => {
      window.removeEventListener("keydown", suppressScroll);
      window.removeEventListener("focusin", focusInput);
    });
    const r = random(142);
    this.stars = Array.from({ length: 180 }, () => ({
      x: r(),
      y: r(),
      r: r() > 0.9 ? 2 : 1,
      phase: r() * 6,
    }));
    this.game.events.on("blur", releaseControls);
    this.events.once("shutdown", () =>
      this.game.events.off("blur", releaseControls),
    );
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (!this.store.started || this.store.trading || isEditing(e.target))
        return;
      if (e.repeat) return;
      if (
        e.code === "Space" &&
        this.store.state.mode === "surface" &&
        !this.store.panel &&
        !this.store.paused
      )
        queuePulse("jump");
      if (e.code === "KeyB") {
        if (this.building.enabled) this.building.disable();
        else this.building.openPalette();
      }
      if (e.code === "KeyR" && this.building.enabled) this.building.rotate();
      if (e.code === "KeyM")
        this.store.panel = ["map", "bases"].includes(this.store.panel)
          ? ""
          : "map";
      if (e.code === "KeyI")
        this.store.panel = this.store.panel === "inventory" ? "" : "inventory";
      if (e.code === "KeyC")
        this.store.panel = this.store.panel === "craft" ? "" : "craft";
      if (e.code === "Escape") {
        if (this.store.panel) this.store.panel = "";
        else if (this.building.enabled) this.building.disable();
        else this.store.paused = !this.store.paused;
      }
    });
  }
  private get viewWidth() {
    return this.scale.width;
  }
  private get viewHeight() {
    return this.scale.height;
  }
  private get centerX() {
    return this.viewWidth / 2;
  }
  private get centerY() {
    return this.viewHeight / 2;
  }
  private down(key: string) {
    return this.keys[key]?.isDown ?? false;
  }
  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.04);
    this.elapsed += dt;
    const g = this.store;
    if (!g) return;
    const s = g.state;
    this.mineTime -= dt;
    if (this.beam) {
      this.beam.life -= dt;
      if (this.beam.life <= 0) this.beam = undefined;
    }
    if (this.lastSystem !== g.system.id) {
      this.lastSystem = g.system.id;
      const r = random(hash(g.system.id + ":asteroids"));
      this.rocks = Array.from({ length: 70 }, (_, i) => ({
        id: `${g.system.id}:a${i}`,
        x: 80 + r() * 6400,
        y: -800 + r() * 2000,
        r: 7 + r() * 13,
        ore: (
          [
            "iron",
            "copper",
            "crystal",
            "rawFuel",
            "titanium",
            "silicon",
          ] as const
        )[i % 6]!,
        hits: 0,
      }));
      this.lastMode = "none";
    }
    if (
      this.lastPlanet !== g.planet.id ||
      this.terrain?.changes !== s.changes[g.planet.id]
    ) {
      this.lastPlanet = g.planet.id;
      this.treeHits.clear();
      this.wildlife.animals.clear();
      this.fruit = [];
      s.changes[g.planet.id] ??= {};
      this.terrain = new Terrain(g.planet, s.changes[g.planet.id]!);
    }
    if (this.lastMode !== s.mode) {
      this.jumpBuffer.clear();
      this.jumpHeld = false;
      if (s.mode === "surface") {
        this.wildlife.animals.clear();
        this.vy = 0;
        if (s.player.y === 0) {
          s.player.x = s.landingX * 16 + 40;
          s.player.y =
            this.terrain!.height(Math.floor(s.player.x / 16)) * 16 - 13;
        }
        this.camX = s.player.x;
        this.camY = s.player.y;
      }
      this.lastMode = s.mode;
    }
    if (g.started && !g.paused && !g.panel && !g.busy) {
      g.tick(dt);
      if (s.mode === "space") this.spacePhysics(dt);
      if (s.mode === "surface") this.surfacePhysics(dt);
      const interact =
        takePulse("interact") ||
        Phaser.Input.Keyboard.JustDown(this.keys.E!) ||
        controls.interact;
      if (interact && !this.interactHeld) {
        if (s.mode === "space") {
          if (!g.dock()) {
            let nearest = 0,
              distance = Infinity;
            g.system.planets.forEach((_, i) => {
              const p = planetPosition(i),
                d = Math.hypot(s.ship.x - p.x, s.ship.y - p.y);
              if (d < distance) {
                distance = d;
                nearest = i;
              }
            });
            if (distance < 210) g.orbit(nearest);
            else
              g.notify("Aproxime-se de um planeta ou estação para interagir.");
          }
        } else if (s.mode === "surface") {
          const cabinet = this.building.nearestInteraction();
          if (
            cabinet.key &&
            cabinet.distance < Math.abs(s.player.x - s.landingX * 16)
          ) {
            const [x, y] = cabinet.key.split(",").map(Number);
            this.building.interactAt(x!, y!);
          } else if (
            Math.abs(s.player.x - s.landingX * 16) < 90 &&
            Math.abs(s.player.y - this.terrain!.height(s.landingX) * 16) < 80
          )
            g.enter();
          else if (cabinet.key) {
            const [x, y] = cabinet.key.split(",").map(Number);
            this.building.interactAt(x!, y!);
          } else {
            const fruit = this.fruit.find((target) =>
              this.canReachFood(target.x, target.y),
            );
            if (fruit) this.gatherFruit(fruit);
            else
              g.notify(
                "Aproxime-se da nave, de uma construção ou de frutas para interagir.",
              );
          }
        }
      }
      this.interactHeld = interact;
    } else {
      this.jumpBuffer.clear();
      this.surfaceTap = undefined;
      this.interactHeld = this.down("E") || controls.interact;
    }
    if (!g.started) {
      this.camX = 350;
      this.camY = 330;
    }
    this.draw(dt);
  }
  private spacePhysics(dt: number) {
    const g = this.store,
      s = g.state.ship;
    const rotate =
      (this.down("D") || controls.right ? 1 : 0) -
      (this.down("A") || controls.left ? 1 : 0);
    s.angle += rotate * 2.5 * dt;
    const thrust = this.down("W") || controls.up,
      brake = this.down("S") || controls.down;
    if (thrust && s.fuel > 0) {
      const acceleration =
        g.model.acceleration *
        (g.state.upgrades.includes("engine") ? 105 / 65 : 1);
      s.vx += Math.cos(s.angle) * acceleration * dt;
      s.vy += Math.sin(s.angle) * acceleration * dt;
      s.fuel = Math.max(0, s.fuel - dt * g.model.consumption);
      if (Math.random() < 0.7)
        this.particles.push({
          x: s.x - Math.cos(s.angle) * 22,
          y: s.y - Math.sin(s.angle) * 22,
          vx: -Math.cos(s.angle) * 60,
          vy: -Math.sin(s.angle) * 60,
          life: 0.3,
          color: 0x70e7ea,
        });
    }
    if (brake) {
      s.vx *= Math.exp(-dt * 2);
      s.vy *= Math.exp(-dt * 2);
    }
    const speed = Math.hypot(s.vx, s.vy),
      max = g.model.speed * (g.state.upgrades.includes("engine") ? 1.5 : 1);
    if (speed > max) {
      s.vx = (s.vx / speed) * max;
      s.vy = (s.vy / speed) * max;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    g.speed = Math.round(Math.hypot(s.vx, s.vy));
    this.camX = Phaser.Math.Linear(this.camX, s.x, 0.09);
    this.camY = Phaser.Math.Linear(this.camY, s.y, 0.09);
    if (s.fuel < 3 && !thrust) {
      s.fuel = Math.min(3, s.fuel + dt * 0.15);
    }
    for (const rock of this.rocks) {
      if (g.state.depleted.includes(rock.id)) continue;
      const distance = Math.hypot(rock.x - s.x, rock.y - s.y);
      if (distance < rock.r + 15 && speed > 30) {
        s.hull -=
          speed * dt * (g.state.upgrades.includes("shield") ? 0.025 : 0.07);
        s.vx *= -0.65;
        s.vy *= -0.65;
        s.x -= Math.cos(s.angle) * 8;
        s.y -= Math.sin(s.angle) * 8;
        if (s.hull <= 0) {
          s.hull = 30;
          s.vx = 0;
          s.vy = 0;
          s.fuel = Math.max(s.fuel, 15);
          g.notify("Sistema de emergência estabilizou a nave. Repare o casco.");
        }
      }
    }
    if (
      (takePulse("mine") || this.down("SPACE") || controls.mine) &&
      this.mineTime <= 0 &&
      s.energy >= 2
    ) {
      const range = g.state.upgrades.includes("laser") ? 200 : 130;
      const rock = this.rocks
        .filter(
          (r) =>
            !g.state.depleted.includes(r.id) &&
            Math.hypot(r.x - s.x, r.y - s.y) < range,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y),
        )[0];
      if (rock) {
        this.mineTime = g.state.upgrades.includes("laser") ? 0.15 : 0.35;
        s.energy -= 2;
        this.beam = { x: s.x, y: s.y, tx: rock.x, ty: rock.y, life: 0.15 };
        this.burst(rock.x, rock.y, 0xd8b48b);
        audio.play(170);
        rock.hits++;
        if (rock.hits >= 3) {
          if (g.collect(rock.ore, 3)) {
            g.state.depleted.push(rock.id);
            g.flag("asteroid");
            g.progress();
            void g.save();
          } else rock.hits = 2;
        }
      }
    }
  }
  private canReachFood(x: number, y: number, reach = 78) {
    const p = this.store.state.player;
    return (
      Math.hypot(x - p.x, y - p.y) <= reach &&
      clearPath(this.terrain!, this.building.settlement, p.x, p.y, x, y)
    );
  }
  private gatherFruit(fruit: Fruit) {
    const g = this.store;
    if (!this.canReachFood(fruit.x, fruit.y)) {
      g.notify("Aproxime-se das frutas para colher.");
      return;
    }
    if (!g.collect(fruit.item, 2)) return;
    const data = settlementFor(g.state, g.planet.id);
    (data.foraged ??= {})[fruit.id] = g.state.time + FRUIT_REGROWTH;
    this.fruit = this.fruit.filter((target) => target.id !== fruit.id);
    g.notify("Duas frutas coletadas. Abra a carga para comer.");
    void g.save();
  }
  private surfacePhysics(dt: number) {
    const g = this.store,
      p = g.state.player,
      t = this.terrain!;
    const direction =
      (this.down("D") || controls.right ? 1 : 0) -
      (this.down("A") || controls.left ? 1 : 0);
    if (direction) this.facing = direction;
    const pulse = takePulse("jump");
    const jumping = this.down("SPACE") || controls.jump;
    const jump = this.jumpBuffer.take(
      pulse || (jumping && !this.jumpHeld),
      this.grounded,
      dt,
    );
    if (jump && this.grounded) audio.play(300);
    this.jumpHeld = jumping;
    const movement = stepSurface(
      { x: p.x, y: p.y, vy: this.vy, grounded: this.grounded },
      direction,
      jump,
      g.planet.gravity,
      dt,
      t,
      this.building.settlement,
    );
    p.x = movement.x;
    p.y = movement.y;
    p.health -= movement.fallDamage;
    this.vy = movement.vy;
    this.grounded = movement.grounded;
    if (p.y > 1005) {
      p.health -= 25;
      p.x = g.state.landingX * 16 + 40;
      p.y = t.height(Math.floor(p.x / 16)) * 16 - 14;
      this.vy = 0;
    }
    this.camX = Phaser.Math.Linear(this.camX, p.x, 0.12);
    this.camY = Phaser.Math.Linear(this.camY, p.y - 32, 0.1);
    this.wildlife.update(
      g.planet,
      t,
      this.building.settlement,
      p,
      g.state.time,
      dt,
    );
    this.fruit = fruitsNear(
      g.planet,
      t,
      this.building.settlement,
      p.x,
      g.state.time,
    );
    const pointer = this.input.activePointer;
    const mobileMine = takePulse("mine") || controls.mine;
    const tap = this.surfaceTap;
    this.surfaceTap = undefined;
    if (this.building.enabled) {
      if (tap) {
        this.building.apply(tap.x, tap.y);
        this.mineTime = 0.2;
      } else if (mobileMine && this.mineTime <= 0) {
        const target = this.building.cursor ?? {
          x: Math.floor((p.x + this.facing * 32) / 16),
          y: Math.floor((p.y + 4) / 16),
        };
        this.building.apply(target.x, target.y);
        this.mineTime = 0.2;
      }
      return;
    }
    if (tap && this.building.interactAt(tap.x, tap.y)) return;
    if (tap) {
      const fruit = this.fruit.find(
        (target) => Math.hypot(target.x - tap.wx, target.y - tap.wy) < 12,
      );
      if (fruit) {
        this.gatherFruit(fruit);
        this.mineTime = 0.25;
        return;
      }
    }
    if (
      (mobileMine || pointer.isDown || tap) &&
      this.mineTime <= 0 &&
      p.energy >= 1
    ) {
      const trees = treesInRange(
        g.planet,
        t,
        Math.floor(p.x / 16) - 8,
        Math.floor(p.x / 16) + 8,
        this.building.settlement.cutTrees,
      );
      const wx = tap?.wx ?? pointer.x - this.centerX + this.camX,
        wy = tap?.wy ?? pointer.y - this.centerY + this.camY;
      const animal = [...this.wildlife.animals.values()]
        .filter(
          (target) =>
            this.canReachFood(target.x, target.y, mobileMine ? 50 : 78) &&
            (mobileMine
              ? (target.x - p.x) * this.facing >= 0 || target.hostile
              : Math.hypot(target.x - wx, target.y - wy) < 16),
        )
        .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      if (animal) {
        this.mineTime = 0.32;
        p.energy -= 1;
        this.beam = {
          x: p.x,
          y: p.y - 3,
          tx: animal.x,
          ty: animal.y,
          life: 0.15,
        };
        this.burst(animal.x, animal.y, animal.crest);
        audio.play(160);
        if (animal.health > 1) {
          animal.health--;
        } else if (g.collect("rawMeat", animal.hostile ? 3 : 2)) {
          const data = settlementFor(g.state, g.planet.id);
          (data.hunted ??= {})[animal.id] = g.state.time + FAUNA_RETURN;
          this.wildlife.animals.delete(animal.id);
          g.notify(`${animal.name}: carne crua coletada.`);
          void g.save();
        }
        return;
      }
      const tree = trees
        .filter(
          (tree) =>
            Math.hypot(tree.x * 16 + 8 - p.x, tree.ground * 16 - 8 - p.y) <=
              96 &&
            (mobileMine
              ? (tree.x * 16 + 8 - p.x) * this.facing > 0
              : treeContains(tree, wx, wy)),
        )
        .sort(
          (a, b) => Math.abs(a.x * 16 + 8 - p.x) - Math.abs(b.x * 16 + 8 - p.x),
        )[0];
      if (tree && p.energy >= 3) {
        this.mineTime = 0.28;
        const hits = (this.treeHits.get(tree.id) ?? 0) + 1;
        this.treeHits.set(tree.id, hits);
        this.beam = {
          x: p.x,
          y: p.y - 3,
          tx: tree.x * 16 + 8,
          ty: tree.ground * 16 - 24,
          life: 0.15,
        };
        this.burst(tree.x * 16 + 8, tree.ground * 16 - 24, tree.accent);
        audio.play(140);
        if (hits >= 3 && this.building.harvest(tree))
          this.treeHits.delete(tree.id);
        return;
      }
      let tx = Math.floor(wx / 16),
        ty = Math.floor(wy / 16);
      if (mobileMine) {
        tx = Math.floor((p.x + this.facing * 24) / 16);
        ty = Math.floor((p.y + 14) / 16);
        if (!t.get(tx, ty)) ty++;
      }
      const tile = t.get(tx, ty);
      if (
        tile &&
        ty < 63 &&
        Math.hypot(tx * 16 + 8 - p.x, ty * 16 + 8 - p.y) < 77
      ) {
        const rootedTree = trees.find(
          (tree) => tree.x === tx && tree.ground === ty,
        );
        if (rootedTree && !this.building.harvest(rootedTree)) return;
        const resource = tileItems[tile] ?? "iron";
        if (g.collect(resource, 1)) {
          t.remove(tx, ty);
          g.worldChanged();
          p.energy -= g.state.upgrades.includes("drill") ? 0.5 : 1;
          this.mineTime = g.state.upgrades.includes("drill") ? 0.1 : 0.22;
          this.beam = {
            x: p.x,
            y: p.y - 3,
            tx: tx * 16 + 8,
            ty: ty * 16 + 8,
            life: 0.12,
          };
          this.burst(tx * 16 + 8, ty * 16 + 8, 0x9dd5d5);
        }
      }
    }
  }
  private burst(x: number, y: number, color: number) {
    for (let i = 0; i < 7; i++)
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 65,
        vy: (Math.random() - 0.5) * 65,
        life: 0.3 + Math.random() * 0.3,
        color,
      });
    if (this.particles.length > 160) this.particles.splice(0, 40);
  }
  private draw(dt: number) {
    const g = this.store,
      s = g.state,
      f = this.gfx;
    f.clear();
    const surface = s.mode === "surface";
    const sky = surface ? biomes[g.planet.kind]!.sky : 0x080f20;
    f.fillStyle(sky);
    f.fillRect(0, 0, this.viewWidth, this.viewHeight);
    // Original procedural nebulae and layered starlight.
    for (let layer = 0; layer < 3; layer++) {
      f.fillStyle(
        [0x15213a, 0x18283c, 0x1b2540][layer]!,
        surface ? 0.13 : 0.23,
      );
      f.fillEllipse(
        100 + layer * 170 - Math.sin(this.elapsed * 0.02) * 10,
        70 + layer * 35,
        300,
        100,
      );
    }
    for (const star of this.stars) {
      const x =
          (((star.x * this.viewWidth - this.camX * 0.025) % this.viewWidth) +
            this.viewWidth) %
          this.viewWidth,
        y =
          (((star.y * this.viewHeight - this.camY * 0.025) % this.viewHeight) +
            this.viewHeight) %
          this.viewHeight;
      f.fillStyle(
        0xc7daeb,
        0.3 + Math.sin(this.elapsed * 0.6 + star.phase) * 0.25,
      );
      f.fillRect(Math.floor(x), Math.floor(y), star.r, star.r);
    }
    if (surface) this.drawSurface();
    else this.drawSpace();
    if (this.beam) {
      const b = this.beam;
      f.lineStyle(3, 0x80ecdf, 0.2);
      f.lineBetween(
        b.x - this.camX + this.centerX,
        b.y - this.camY + this.centerY,
        b.tx - this.camX + this.centerX,
        b.ty - this.camY + this.centerY,
      );
      f.lineStyle(1, 0xc5fff1);
      f.lineBetween(
        b.x - this.camX + this.centerX,
        b.y - this.camY + this.centerY,
        b.tx - this.camX + this.centerX,
        b.ty - this.camY + this.centerY,
      );
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      f.fillStyle(p.color, Math.min(1, p.life * 3));
      f.fillRect(
        Math.floor(p.x - this.camX + this.centerX),
        Math.floor(p.y - this.camY + this.centerY),
        2,
        2,
      );
    }
    if (g.busy) {
      f.fillStyle(0x80cced, 0.25);
      for (let i = 0; i < 50; i++) {
        const angle = i * 0.37,
          x = this.centerX + ((Math.cos(angle) * this.elapsed) % this.centerX),
          y = this.centerY + ((Math.sin(angle) * this.elapsed) % this.centerY);
        f.fillRect(x, y, 35, 1);
      }
    }
  }
  private drawSpace() {
    const f = this.gfx,
      g = this.store,
      s = g.state.ship;
    const station = g.system.station;
    if (station) {
      const x = Math.round(station.x - this.camX + this.centerX);
      const y = Math.round(station.y - this.camY + this.centerY);
      f.fillStyle(0x30485e);
      f.fillRect(x - 40, y - 9, 80, 18);
      f.fillStyle(0x637f92);
      f.fillRect(x - 17, y - 18, 34, 36);
      f.fillStyle(0x172947);
      f.fillRect(x - 37, y - 6, 20, 12);
      f.fillRect(x + 17, y - 6, 20, 12);
      f.fillStyle(0x92d6c8);
      f.fillRect(x - 11, y - 10, 22, 5);
      f.fillStyle(0xd4b079);
      f.fillRect(x - 7, y + 7, 14, 4);
    }
    g.system.planets.forEach((p, i) => {
      const pos = planetPosition(i),
        x = Math.round(pos.x - this.camX + this.centerX),
        y = Math.round(pos.y - this.camY + this.centerY);
      if (
        x < -120 ||
        x > this.viewWidth + 120 ||
        y < -120 ||
        y > this.viewHeight + 120
      )
        return;
      const radius = 57 + (i % 3) * 8;
      f.fillStyle(p.color, 0.035);
      f.fillCircle(x, y, radius + 14);
      f.fillStyle(p.color, 0.12);
      f.fillCircle(x, y, radius + 4);
      f.fillStyle(p.color);
      f.fillCircle(x, y, radius);
      const r = random(p.seed);
      for (let row = -radius; row < radius; row += 4) {
        const half = Math.sqrt(radius * radius - row * row);
        f.fillStyle([0x18243e, 0xbcd1bb, 0x43435c][Math.floor(r() * 3)]!, 0.22);
        f.fillRect(
          Math.floor(x - half + 3),
          y + row,
          Math.max(1, Math.floor(half * 2 - 6)),
          2 + r() * 4,
        );
      }
      f.fillStyle(0x061125, 0.5);
      f.fillEllipse(x + radius * 0.35, y + 4, radius * 1.2, radius * 1.7);
      f.lineStyle(1, 0xb8e1da, 0.17);
      f.strokeCircle(x, y, radius + 7);
    });
    for (const rock of this.rocks) {
      if (g.state.depleted.includes(rock.id)) continue;
      const x = Math.floor(rock.x - this.camX + this.centerX),
        y = Math.floor(rock.y - this.camY + this.centerY);
      if (
        x < -30 ||
        x > this.viewWidth + 30 ||
        y < -30 ||
        y > this.viewHeight + 30
      )
        continue;
      f.fillStyle(0x635e68);
      f.fillPoints(
        [
          { x: x - rock.r, y: y - 3 },
          { x: x - rock.r * 0.5, y: y - rock.r },
          { x: x + rock.r * 0.6, y: y - rock.r * 0.7 },
          { x: x + rock.r, y: y + rock.r * 0.4 },
          { x: x + rock.r * 0.3, y: y + rock.r },
          { x: x - rock.r * 0.7, y: y + rock.r * 0.7 },
        ],
        true,
      );
      f.fillStyle(0x8b8189);
      f.fillRect(x - 5, y - 5, 6, 4);
      f.fillStyle(
        rock.ore === "crystal"
          ? 0xb794e8
          : rock.ore === "copper"
            ? 0xd79d7d
            : 0x91b8bf,
      );
      f.fillRect(x + 3, y + 1, 3, 3);
      f.fillRect(x - 4, y + 4, 2, 2);
    }
    if (g.started)
      this.drawShip(
        s.x - this.camX + this.centerX,
        s.y - this.camY + this.centerY,
        s.angle,
        this.down("W") || controls.up,
      );
  }
  private drawShip(x: number, y: number, angle: number, thrust = false) {
    const f = this.gfx;
    const point = (px: number, py: number) => ({
      x: Math.round(x + px * Math.cos(angle) - py * Math.sin(angle)),
      y: Math.round(y + px * Math.sin(angle) + py * Math.cos(angle)),
    });
    const sprite = this.store.model.sprite;
    sprite.forEach((row, rowIndex) => {
      let start = 0;
      while (start < row.length) {
        const pixel = row[start]!;
        let end = start + 1;
        while (end < row.length && row[end] === pixel) end++;
        if (pixel !== ".") {
          const left = start * 3 - 22,
            right = end * 3 - 22;
          const top = rowIndex * 2.5 - 14;
          f.fillStyle(shipPalette[pixel as keyof typeof shipPalette]);
          f.fillPoints(
            [
              point(left, top),
              point(right, top),
              point(right, top + 2.5),
              point(left, top + 2.5),
            ],
            true,
          );
        }
        start = end;
      }
    });
    if (thrust) {
      f.fillStyle(0x7de3ee, 0.8);
      f.fillPoints(
        [point(-22, -3), point(-34 - Math.random() * 10, 0), point(-22, 3)],
        true,
      );
    }
  }
  private drawSurface() {
    const f = this.gfx,
      g = this.store,
      t = this.terrain!,
      biome = biomes[g.planet.kind]!,
      p = g.state.player;
    const startX = Math.floor((this.camX - this.centerX - 16) / 16),
      startY = Math.max(0, Math.floor((this.camY - this.centerY - 16) / 16));
    f.fillStyle(g.planet.color, 0.15);
    for (let i = -1; i < Math.ceil(this.viewWidth / 85) + 2; i++) {
      const x = i * 85 - ((this.camX * 0.15) % 85);
      const horizon = this.centerY + 85;
      f.fillTriangle(
        x,
        horizon,
        x + 70,
        horizon - 155 + Math.sin(i * 4) * 30,
        x + 145,
        horizon,
      );
    }
    for (const tree of treesInRange(
      g.planet,
      t,
      startX,
      startX + Math.ceil(this.viewWidth / 16) + 2,
      this.building.settlement.cutTrees,
    )) {
      drawAlienTree(
        f,
        tree,
        tree.x * 16 + 8 - this.camX + this.centerX,
        tree.ground * 16 - this.camY + this.centerY,
        this.elapsed,
        this.treeHits.get(tree.id) ?? 0,
      );
    }
    drawSettlement(
      f,
      this.building.settlement,
      this.camX,
      this.camY,
      this.viewWidth,
      this.viewHeight,
      "walls",
    );
    const colors: Record<number, number> = {
      2: 0x9fb8bf,
      3: 0xd99268,
      4: 0xb9a8d4,
      5: 0x596c7c,
      6: 0x74c5d5,
      7: 0xb38ee4,
      8: 0x98daec,
      9: 0x8dbd8d,
      10: 0xb2a273,
      11: 0xd8bb70,
    };
    for (let x = startX; x < startX + Math.ceil(this.viewWidth / 16) + 2; x++)
      for (
        let y = startY;
        y < Math.min(64, startY + Math.ceil(this.viewHeight / 16) + 2);
        y++
      ) {
        const tile = t.get(x, y);
        if (!tile) continue;
        const sx = Math.floor(x * 16 - this.camX + this.centerX),
          sy = Math.floor(y * 16 - this.camY + this.centerY);
        f.fillStyle(biome.ground);
        f.fillRect(sx, sy, 16, 16);
        f.fillStyle(0x101a2c, 0.22);
        f.fillRect(sx, sy + 13, 16, 3);
        if (!t.get(x, y - 1)) {
          f.fillStyle(g.planet.color);
          f.fillRect(sx, sy, 16, 3);
        }
        if (tile > 1) {
          f.fillStyle(colors[tile]!);
          f.fillRect(sx + 3, sy + 5, 4, 3);
          f.fillRect(sx + 10, sy + 9, 3, 4);
          f.fillStyle(0xffffff, 0.2);
          f.fillRect(sx + 4, sy + 5, 2, 1);
        } else {
          f.fillStyle(0xffffff, 0.06);
          f.fillRect(sx + 4, sy + 7, 3, 2);
        }
      }
    drawSettlement(
      f,
      this.building.settlement,
      this.camX,
      this.camY,
      this.viewWidth,
      this.viewHeight,
      "pieces",
    );
    for (const fruit of this.fruit)
      drawFruit(
        f,
        fruit,
        Math.round(fruit.x - this.camX + this.centerX),
        Math.round(fruit.y - this.camY + this.centerY),
      );
    for (const animal of this.wildlife.animals.values())
      drawAnimal(
        f,
        animal,
        Math.round(animal.x - this.camX + this.centerX),
        Math.round(animal.y - this.camY + this.centerY),
      );
    const shipX = g.state.landingX * 16,
      shipY = t.height(g.state.landingX) * 16 - 12;
    this.drawShip(
      shipX - this.camX + this.centerX,
      shipY - this.camY + this.centerY,
      0,
    );
    f.fillStyle(0x7b8f9a);
    f.fillRect(
      shipX - this.camX + this.centerX - 15,
      shipY - this.camY + this.centerY + 10,
      4,
      4,
    );
    f.fillRect(
      shipX - this.camX + this.centerX + 8,
      shipY - this.camY + this.centerY + 10,
      4,
      4,
    );
    const x = Math.round(p.x - this.camX + this.centerX),
      y = Math.round(p.y - this.camY + this.centerY),
      walk = this.grounded ? Math.sin(this.elapsed * 13) * 2 : 0;
    f.fillStyle(0x3b5164);
    f.fillRect(x - 6, y - 4, 4, 11);
    f.fillStyle(0xc0c9c8);
    f.fillRect(x - 4, y - 4, 9, 12);
    f.fillRect(x - 3, y - 12, 9, 9);
    f.fillStyle(0x5de3da);
    f.fillRect(x - 1 + (this.facing < 0 ? -2 : 0), y - 10, 6, 4);
    f.fillStyle(0x67858e);
    f.fillRect(x - 3, y + 7, 3, 5 + walk);
    f.fillRect(x + 2, y + 7, 3, 5 - walk);
    f.fillStyle(0xe4ad71);
    f.fillRect(x - 4, y + 1, 9, 2);
    f.fillStyle(0xbfcbd2);
    f.fillRect(x + (this.facing > 0 ? 5 : -9), y - 1, 5, 3);
    // Slow, deterministic day/night tint.
    f.fillStyle(0x050c25, (1 - daylight(g.state.time)) * 0.35);
    f.fillRect(0, 0, this.viewWidth, this.viewHeight);
    if (this.building.enabled && !g.panel) {
      const cursor = this.building.cursor ?? {
        x: Math.floor((p.x + this.facing * 32) / 16),
        y: Math.floor((p.y + 4) / 16),
      };
      const sx = Math.round(cursor.x * 16 - this.camX + this.centerX),
        sy = Math.round(cursor.y * 16 - this.camY + this.centerY);
      if (!this.building.removing)
        drawPiece(
          f,
          this.building.selected,
          sx,
          sy,
          this.building.facing,
          0.45,
        );
      const valid =
        this.building.removing || !this.building.errorAt(cursor.x, cursor.y);
      f.lineStyle(1, valid ? 0x9cf0cf : 0xf09d86, 0.9);
      f.strokeRect(
        sx,
        sy - (this.building.selected === "woodDoor" ? 16 : 0),
        16,
        footprint(this.building.selected, cursor.x, cursor.y).length * 16,
      );
    }
  }
}
