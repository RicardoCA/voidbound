import { SpaceCombat } from "../../combat/flight";
import {
  hasBlackMarket,
  salvage,
  SALVAGE_RANGE,
  systemWrecks,
  type Wreck,
} from "../../combat/traffic";
import type { Save } from "../types";
import { anomalyAt, ruinAt } from "../../progression/exploration";
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
import { weatherCeiling } from "../procedural/weather";
import { shipModels, shipPalette } from "../../fleet/models";
import Phaser from "phaser";
import {
  DOCKING_DURATION,
  SURFACE_SEQUENCE_DURATION,
  useGame,
} from "../../stores/game";
import { useConstruction } from "../../stores/construction";
import { treesInRange, treeContains } from "../procedural/trees";
import {
  drawAlienTree,
  drawSettlement,
  drawPiece,
} from "../rendering/settlements";
import { stepSurface } from "../physics/surface";
import { footprint } from "../../construction/pieces";
import { daylight, solarPhase } from "../../construction/habitat";
import { biomes, type Mode, type Planet } from "../types";
import { Terrain } from "../procedural/terrain";
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
import { StationInterior } from "../station/StationInterior";
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
  private flightShipGfx!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private terrain?: Terrain;
  private lastMode: Mode | "none" = "none";
  private lastSystem = "";
  private lastPlanet = "";
  private rocks: Rock[] = [];
  private planetLabels = new Map<string, Phaser.GameObjects.Text>();
  private combat = new SpaceCombat();
  private combatState?: Save;
  private contactAt = 0;
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
  private station = new StationInterior();
  private wasAtStation = false;
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
    this.flightShipGfx = this.add.graphics().setDepth(2);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,LEFT,RIGHT,UP,DOWN,SPACE,E,F,M,I,C,ESC",
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
      if (e.repeat || this.store.busy) return;
      if (this.store.inSequence) {
        if (e.code === "Escape") this.store.paused = !this.store.paused;
        return;
      }
      if (
        e.code === "KeyE" &&
        (this.store.state.mode === "docked" ||
          this.store.state.mode === "space") &&
        !this.store.panel &&
        !this.store.paused
      )
        queuePulse("interact");
      if (
        e.code === "KeyF" &&
        this.store.state.mode === "space" &&
        !this.store.panel &&
        !this.store.paused
      )
        queuePulse("fire");
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
    this.flightShipGfx.clear();
    const s = g.state;
    if (g.started && s.mode === "docked") {
      if (!this.wasAtStation) {
        this.station.reset();
        this.wasAtStation = true;
      }
      const clandestine = hasBlackMarket(g.system);
      if (!g.paused && !g.panel && !g.trading) {
        const direction =
          Number(this.down("D") || this.down("RIGHT") || controls.right) -
          Number(this.down("A") || this.down("LEFT") || controls.left);
        const depth =
          Number(this.down("S") || this.down("DOWN") || controls.down) -
          Number(this.down("W") || this.down("UP") || controls.up);
        this.station.walk(direction, depth, dt, clandestine);
        const npc = this.station.nearby(clandestine);
        g.stationContact = npc?.label;
        const pressed = takePulse("interact");
        const held = this.down("E") || controls.interact;
        if (pressed || (held && !this.interactHeld)) {
          if (npc) {
            releaseControls();
            g.panel = "station:" + npc.id;
          } else {
            g.notify("Aproxime-se de um atendente para conversar.");
          }
        }
        this.interactHeld = held;
      } else {
        this.interactHeld = this.down("E") || controls.interact;
      }
      for (const label of this.planetLabels.values()) label.setVisible(false);
      this.gfx.clear();
      this.station.draw(this, this.gfx, clandestine);
      return;
    }
    if (this.wasAtStation) {
      this.station.hide();
      g.stationContact = undefined;
      this.wasAtStation = false;
    }
    this.mineTime -= dt;
    if (this.beam) {
      this.beam.life -= dt;
      if (this.beam.life <= 0) this.beam = undefined;
    }
    if (this.lastSystem !== g.system.id || this.combatState !== s) {
      if (this.lastSystem !== g.system.id) {
        for (const label of this.planetLabels.values()) label.destroy();
        this.planetLabels.clear();
      }
      this.combatState = s;
      this.combat.reset(s, g.system);
      g.flightContact = undefined;
      this.contactAt = 0;
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
        this.camY = s.player.y - 32;
      }
      this.lastMode = s.mode;
    }
    if (g.dockingSequence && g.system.station) {
      if (!g.paused) {
        this.camX = Phaser.Math.Linear(this.camX, g.system.station.x, 0.09);
        this.camY = Phaser.Math.Linear(this.camY, g.system.station.y, 0.09);
      }
      this.draw(dt);
      g.advanceDocking(dt);
      if (!g.dockingSequence) this.combat.bolts = [];
      return;
    }
    const sequence = g.surfaceSequence;
    if (sequence) {
      const pad = sequence.landingX * 16;
      const ground = this.terrain!.height(sequence.landingX) * 16;
      const progress = Math.min(
        1,
        sequence.elapsed / SURFACE_SEQUENCE_DURATION[sequence.kind],
      );
      this.camX = sequence.kind === "landing" ? pad : pad + 40 * progress;
      this.camY = ground - 45;
      this.draw(dt);
      g.advanceSurfaceSequence(dt);
      return;
    }
    if (g.started && !g.paused && !g.panel && !g.busy) {
      g.tick(dt);
      if (s.mode === "space") this.spacePhysics(dt);
      if (s.mode === "surface") this.surfacePhysics(dt);
      const pressed = takePulse("interact");
      const held = this.down("E") || controls.interact;
      const surfacePress =
        s.mode === "surface" && Phaser.Input.Keyboard.JustDown(this.keys.E!);
      if (pressed || surfacePress || (held && !this.interactHeld)) {
        if (s.mode === "space") {
          if (!this.recoverWreck() && !g.dock()) g.interactFlightTarget();
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
      this.interactHeld = held;
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
      (takePulse("fire") || this.down("F") || controls.fire) &&
      this.combat.fire(g.state)
    )
      audio.play(260, 0.08);
    const encounter = this.combat.update(g.state, g.system, dt);
    if (encounter.crimeReported && !encounter.destroyed) {
      g.notify(
        `Ataque comunicado às autoridades. Procurado ${g.wanted.level}/5.`,
      );
      void g.save();
    }
    if (encounter.destroyed) {
      g.notify(
        "Nave destruída. Aproxime-se do destroço e interaja para recolher a carga.",
      );
      void g.save();
    }
    if (encounter.playerDisabled) {
      g.notify("Casco crítico. A nave foi estabilizada em emergência.");
      void g.save();
    }
    if (this.elapsed >= this.contactAt || encounter.destroyed) {
      this.updateFlightContact();
      this.contactAt = this.elapsed + 0.12;
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
        s.energy -= 2 * (1 - g.extractionEfficiency);
        this.beam = { x: s.x, y: s.y, tx: rock.x, ty: rock.y, life: 0.15 };
        this.burst(rock.x, rock.y, 0xd8b48b);
        audio.play(170);
        rock.hits++;
        if (rock.hits >= 3 && !g.mineAsteroid(rock.id, rock.ore)) rock.hits = 2;
      }
    }
  }
  private nearbyWrecks() {
    const g = this.store;
    return systemWrecks(g.system.id, g.state.progression.piracy);
  }
  private closestWreck(range: number): Wreck | undefined {
    const ship = this.store.state.ship;
    let closest: Wreck | undefined;
    for (const wreck of this.nearbyWrecks()) {
      const distance = Math.hypot(wreck.x - ship.x, wreck.y - ship.y);
      if (distance <= range) {
        closest = wreck;
        range = distance;
      }
    }
    return closest;
  }
  private recoverWreck() {
    const g = this.store;
    const wreck = this.closestWreck(SALVAGE_RANGE);
    if (!wreck) return false;
    const error = salvage(g.state, wreck, g.capacity);
    g.notify(error ?? "Carga recuperada · +160 XP de Pirata.");
    if (!error) {
      this.updateFlightContact();
      void g.save();
    }
    return true;
  }
  private updateFlightContact() {
    const g = this.store;
    const ship = g.state.ship;
    const wreck = this.closestWreck(520);
    const npc = this.combat.target(ship, 670);
    const target = wreck ?? npc;
    if (!target) {
      g.flightContact = undefined;
      return;
    }
    const dx = target.x - ship.x,
      dy = target.y - ship.y;
    const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    g.flightContact = {
      name: target.name,
      distance: Math.round(Math.hypot(dx, dy)),
      bearing: ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"][(octant + 8) % 8]!,
      wreck: Boolean(wreck),
      ...(target === npc
        ? { hull: Math.ceil(npc.hull), shield: Math.ceil(npc.shield) }
        : {}),
    };
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
        if (g.mineTerrain(t, tx, ty)) {
          const drill = g.state.upgrades.includes("drill");
          p.energy -= (drill ? 0.5 : 1) * (1 - g.extractionEfficiency);
          this.mineTime = (drill ? 0.1 : 0.22) * (1 - g.extractionEfficiency);
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
    const surface = s.mode === "surface" || Boolean(g.surfaceSequence);
    for (const label of this.planetLabels.values()) label.setVisible(false);
    const storm = surface ? g.weather : undefined;
    const light = surface
      ? daylight(s.time) * (1 - 0.32 * (storm?.intensity ?? 0))
      : 0;
    const biome = biomes[g.planet.kind]!;
    const sky = surface
      ? Phaser.Display.Color.GetColor(
          Math.round(
            Phaser.Math.Linear(
              (biome.sky >> 16) & 255,
              (biome.daySky >> 16) & 255,
              light,
            ),
          ),
          Math.round(
            Phaser.Math.Linear(
              (biome.sky >> 8) & 255,
              (biome.daySky >> 8) & 255,
              light,
            ),
          ),
          Math.round(
            Phaser.Math.Linear(biome.sky & 255, biome.daySky & 255, light),
          ),
        )
      : 0x080f20;
    f.fillStyle(sky);
    f.fillRect(0, 0, this.viewWidth, this.viewHeight);
    // Original procedural nebulae and layered starlight.
    for (let layer = 0; layer < 3; layer++) {
      f.fillStyle(
        [0x15213a, 0x18283c, 0x1b2540][layer]!,
        surface ? 0.13 * (1 - light) : 0.23,
      );
      f.fillEllipse(
        100 + layer * 170 - Math.sin(this.elapsed * 0.02) * 10,
        70 + layer * 35,
        300,
        100,
      );
    }
    for (const star of this.stars) {
      const parallax = surface
        ? 0.025
        : star.r === 2
          ? 0.18
          : 0.035 + star.phase * 0.012;
      const x =
          (((star.x * this.viewWidth - this.camX * parallax) % this.viewWidth) +
            this.viewWidth) %
          this.viewWidth,
        y =
          (((star.y * this.viewHeight - this.camY * parallax) %
            this.viewHeight) +
            this.viewHeight) %
          this.viewHeight;
      f.fillStyle(
        0xc7daeb,
        (0.3 + Math.sin(this.elapsed * 0.6 + star.phase) * 0.25) * (1 - light),
      );
      f.fillRect(Math.floor(x), Math.floor(y), star.r, star.r);
    }
    if (surface) {
      if (light > 0) {
        const phase = solarPhase(s.time);
        const sunX = Math.round(
          this.viewWidth * (0.5 + Math.sin(phase) * 0.26),
        );
        const sunY = Math.round(
          this.viewHeight * (0.34 - daylight(s.time) * 0.2),
        );
        const radius = Math.round(
          Math.min(this.viewWidth, this.viewHeight) * 0.065,
        );
        f.fillStyle(0xffd98d, light * 0.16);
        f.fillCircle(sunX, sunY, radius * 1.9);
        f.fillStyle(0xffe5a8, light * 0.24);
        f.fillCircle(sunX, sunY, radius * 1.4);
        f.fillStyle(0xffedb6, Math.min(1, light * 4));
        f.fillCircle(sunX, sunY, radius);
      }
      this.drawSurface(light);
      if (storm) this.drawWeather(storm);
    } else this.drawSpace();
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
  }
  private drawSpace() {
    const f = this.gfx,
      g = this.store,
      s = g.state.ship;
    // Small silhouettes behind the flight plane carry parallax without
    // introducing targets that can be mined or collided with.
    const distant = random(hash(g.system.id + ":depth"));
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Wrap(
        distant() * this.viewWidth - this.camX * 0.34,
        -20,
        this.viewWidth + 20,
      );
      const y = Phaser.Math.Wrap(
        distant() * this.viewHeight - this.camY * 0.34,
        -20,
        this.viewHeight + 20,
      );
      const radius = 2 + distant() * 7;
      f.fillStyle(0x26374c, 0.55);
      f.fillTriangle(
        x - radius,
        y,
        x + radius * 0.45,
        y - radius,
        x + radius,
        y + radius * 0.7,
      );
    }
    const station = g.system.station;
    if (station) {
      const x = Math.round(station.x - this.camX + this.centerX);
      const y = Math.round(station.y - this.camY + this.centerY);
      f.fillStyle(0x122438);
      f.fillPoints(
        [
          { x: x - 40, y: y + 9 },
          { x: x + 40, y: y + 9 },
          { x: x + 45, y: y + 16 },
          { x: x - 35, y: y + 16 },
        ],
        true,
      );
      f.fillStyle(0x30485e);
      f.fillRect(x - 40, y - 9, 80, 18);
      f.fillStyle(0x88a3af);
      f.fillRect(x - 40, y - 9, 80, 2);
      f.fillStyle(0x263a4d);
      f.fillRect(x - 12, y - 12, 34, 36);
      f.fillStyle(0x637f92);
      f.fillRect(x - 17, y - 18, 34, 36);
      f.fillStyle(0x9cb0b7);
      f.fillRect(x - 17, y - 18, 34, 3);
      f.fillStyle(0x172947);
      f.fillRect(x - 37, y - 6, 20, 12);
      f.fillRect(x + 17, y - 6, 20, 12);
      f.fillStyle(0x92d6c8);
      f.fillRect(x - 11, y - 10, 22, 5);
      f.fillStyle(0xd4b079);
      f.fillRect(x - 7, y + 7, 14, 4);
      if (g.dockingSequence) {
        const blink = Math.floor(g.dockingSequence.elapsed * 9) % 2 === 0;
        f.fillStyle(blink ? 0xffe2a0 : 0x92d6c8);
        f.fillRect(x - 18, y - 17, 4, 3);
        f.fillRect(x + 14, y - 17, 4, 3);
        f.fillRect(x - 18, y + 14, 4, 3);
        f.fillRect(x + 14, y + 14, 4, 3);
      }
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
      if (
        g.started &&
        g.state.mode === "space" &&
        !g.panel &&
        !g.paused &&
        g.state.progression.cataloguedPlanets[p.id]
      )
        this.drawPlanetLabel(p, x, y, radius);
    });
    const anomaly = anomalyAt(g.system);
    if (anomaly) this.drawScienceSignal(anomaly.x, anomaly.y, 0x9ac9ee);
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
      const r = rock.r;
      const rim = [
        { x: x - r, y: y - 3 },
        { x: x - r * 0.5, y: y - r },
        { x: x + r * 0.6, y: y - r * 0.7 },
        { x: x + r, y: y + r * 0.4 },
        { x: x + r * 0.3, y: y + r },
        { x: x - r * 0.7, y: y + r * 0.7 },
      ];
      const facets = [
        0x998c8b, 0x827981, 0x605967, 0x393c50, 0x474657, 0x716872,
      ];
      for (const [i, edge] of rim.entries()) {
        const next = rim[(i + 1) % rim.length]!;
        f.fillStyle(facets[i]!);
        f.fillTriangle(
          x - r * 0.2,
          y - r * 0.13,
          edge.x,
          edge.y,
          next.x,
          next.y,
        );
      }
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
    if (g.started && g.state.mode === "space") {
      for (const npc of this.combat.npcs) {
        if (npc.hull <= 0) continue;
        const x = npc.x - this.camX + this.centerX;
        const y = npc.y - this.camY + this.centerY;
        if (
          x < -35 ||
          x > this.viewWidth + 35 ||
          y < -35 ||
          y > this.viewHeight + 35
        )
          continue;
        this.drawShip(
          x,
          y,
          npc.angle,
          npc.engaged,
          shipModels[npc.model].sprite,
        );
        f.fillStyle(npc.engaged || npc.role === "pirate" ? 0xff8c78 : 0xe5bb77);
        f.fillRect(x - 11, y - 20, (22 * npc.hull) / npc.maxHull, 2);
        if (npc.shield > 0) {
          f.fillStyle(0x8ad7ff);
          f.fillRect(x - 11, y - 24, npc.shield * 0.7, 2);
        }
      }
      for (const wreck of this.nearbyWrecks()) {
        const x = Math.round(wreck.x - this.camX + this.centerX);
        const y = Math.round(wreck.y - this.camY + this.centerY);
        f.fillStyle(0x687783);
        f.fillRect(x - 15, y - 4, 11, 7);
        f.fillRect(x + 9, y + 3, 8, 5);
        f.fillStyle(0xc39cf6);
        f.fillRect(x - 5, y - 5, 10, 10);
        f.fillStyle(0x6c4f91);
        f.fillRect(x - 2, y - 2, 4, 4);
      }
      for (const bolt of this.combat.bolts) {
        f.fillStyle(bolt.hostile ? 0xff8874 : 0xe0f8be);
        f.fillCircle(
          bolt.x - this.camX + this.centerX,
          bolt.y - this.camY + this.centerY,
          2.5,
        );
      }
    }
    if (g.started) {
      const docking = g.dockingSequence;
      const t = docking ? Math.min(1, docking.elapsed / DOCKING_DURATION) : 0;
      const eased = t * t * (3 - 2 * t);
      const x =
        docking && station ? Phaser.Math.Linear(s.x, station.x, eased) : s.x;
      const y =
        docking && station ? Phaser.Math.Linear(s.y, station.y, eased) : s.y;
      const angle = docking
        ? Phaser.Math.Angle.Wrap(s.angle) * (1 - eased)
        : s.angle;
      this.drawShip(
        x - this.camX + this.centerX,
        y - this.camY + this.centerY,
        angle,
        docking ? t < 0.78 : this.down("W") || controls.up,
        undefined,
        this.flightShipGfx,
      );
    }
  }
  private drawPlanetLabel(
    planet: Planet,
    x: number,
    y: number,
    radius: number,
  ) {
    const width = this.viewWidth,
      height = this.viewHeight;
    if (
      x + radius < 0 ||
      x - radius > width ||
      y + radius < 0 ||
      y - radius > height
    )
      return;

    let label = this.planetLabels.get(planet.id);
    if (!label) {
      const biome = biomes[planet.kind]!;
      label = this.add
        .text(
          0,
          0,
          [planet.name, `✓ Catalogado · ${biome.name}`, biome.resources],
          {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#b8e4db",
            backgroundColor: "#101d2e",
            padding: { x: 7, y: 5 },
            lineSpacing: 3,
          },
        )
        .setDepth(1);
      this.planetLabels.set(planet.id, label);
    }

    const margin = 8,
      gap = radius + 12;
    const right = x + gap,
      left = x - gap - label.width;
    const side =
      right + label.width <= width - margin
        ? right
        : left >= margin
          ? left
          : undefined;
    const top =
      side !== undefined
        ? y - label.height / 2
        : y - gap - label.height >= margin
          ? y - gap - label.height
          : y + gap;
    label
      .setPosition(
        Math.round(
          Phaser.Math.Clamp(
            side ?? x - label.width / 2,
            margin,
            Math.max(margin, width - label.width - margin),
          ),
        ),
        Math.round(
          Phaser.Math.Clamp(
            top,
            margin,
            Math.max(margin, height - label.height - margin),
          ),
        ),
      )
      .setVisible(true);
  }

  private drawShip(
    x: number,
    y: number,
    angle: number,
    thrust = false,
    sprite = this.store.model.sprite as readonly string[],
    f = this.gfx,
  ) {
    const cosine = Math.cos(angle),
      sine = Math.sin(angle);
    const point = (px: number, py: number) => ({
      x: Math.round(x + px * cosine - py * sine),
      y: Math.round(y + px * sine + py * cosine),
    });
    const drawHull = (depth: number) => {
      sprite.forEach((row, rowIndex) => {
        let start = 0;
        while (start < row.length) {
          const pixel = row[start]!;
          let end = start + 1;
          while (end < row.length && row[end] === pixel) end++;
          if (pixel !== ".") {
            const left = start * 3 - 22,
              right = end * 3 - 22,
              top = rowIndex * 2.5 - 14;
            f.fillStyle(
              depth ? 0x162d43 : shipPalette[pixel as keyof typeof shipPalette],
            );
            f.fillPoints(
              [
                point(left, top),
                point(right, top),
                point(right, top + 2.5),
                point(left, top + 2.5),
              ].map((vertex) => ({
                x: vertex.x + depth * 0.5,
                y: vertex.y + depth,
              })),
              true,
            );
          }
          start = end;
        }
      });
    };
    if (this.store.state.mode === "space") {
      drawHull(4);
      drawHull(2);
    }
    drawHull(0);
    if (thrust) {
      f.fillStyle(0x7de3ee, 0.8);
      f.fillPoints(
        [point(-22, -3), point(-34 - Math.random() * 10, 0), point(-22, 3)],
        true,
      );
    }
  }
  private drawScienceSignal(wx: number, wy: number, color: number) {
    const x = Math.round(wx - this.camX + this.centerX);
    const y = Math.round(wy - this.camY + this.centerY);
    if (
      x < -30 ||
      x > this.viewWidth + 30 ||
      y < -30 ||
      y > this.viewHeight + 30
    )
      return;
    const f = this.gfx;
    f.fillStyle(color, 0.15 + 0.08 * Math.sin(this.elapsed * 2));
    f.fillRect(x - 13, y - 13, 26, 26);
    f.fillStyle(0x324863);
    f.fillRect(x - 6, y - 9, 12, 19);
    f.fillStyle(color);
    f.fillRect(x - 2, y - 6, 4, 11);
    f.fillRect(x - 8, y - 1, 16, 3);
  }
  private drawWeather(
    storm: NonNullable<ReturnType<typeof useGame>["weather"]>,
  ) {
    const f = this.gfx;
    const { kind, intensity } = storm;
    const snow = kind === "snow";
    const time = this.store.state.time;
    const width = this.viewWidth,
      height = this.viewHeight;
    const wrap = (value: number, length: number) =>
      ((value % length) + length) % length;
    const ceilings = new Map<number, number>();
    const count = Math.floor(this.stars.length * intensity);
    f.fillStyle(kind === "acid" ? 0x96ef58 : snow ? 0xecf6ff : 0xa6cee9, 0.73);
    for (let i = 0; i < count; i++) {
      const seed = this.stars[i]!;
      const wind = snow ? Math.sin(time * 1.5 + i) * 9 : time * 48;
      const x = Math.floor(
        wrap(seed.x * width + wind - this.camX * 0.6, width),
      );
      const speed = snow ? 22 + seed.r * 5 : 230 + seed.r * 28;
      const y = Math.floor(
        wrap(seed.y * height + time * speed - this.camY * 0.35, height),
      );
      const column = Math.floor((x + this.camX - this.centerX) / 16);
      let ceiling = ceilings.get(column);
      if (ceiling === undefined) {
        ceiling = weatherCeiling(
          this.terrain!,
          this.building.settlement,
          column,
        );
        ceilings.set(column, ceiling);
      }
      if (y + this.camY - this.centerY >= ceiling) continue;
      const length = Math.min(
        snow ? seed.r + 1 : 8,
        Math.ceil(ceiling - y - this.camY + this.centerY),
      );
      f.fillRect(x, y, snow ? seed.r + 1 : 1, length);
    }
  }
  private drawSurface(light: number) {
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
    const ruin = ruinAt(g.planet, t);
    if (ruin) this.drawScienceSignal(ruin.x, ruin.y, 0xc3a2e6);
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
    const sequence = g.surfaceSequence;
    const landingX = sequence?.landingX ?? g.state.landingX;
    const shipX = landingX * 16 - this.camX + this.centerX;
    const shipY = t.height(landingX) * 16 - 12 - this.camY + this.centerY;
    if (sequence?.kind === "landing") {
      const progress = Math.min(
        1,
        sequence.elapsed / SURFACE_SEQUENCE_DURATION.landing,
      );
      const approach = Math.max(0, 1 - progress / 0.86) ** 2;
      const x = shipX - 92 * approach;
      const y = shipY - 142 * approach;
      this.drawShip(x, y, -0.22 * approach, progress < 0.86);
      if (progress > 0.68) {
        const dust = (progress - 0.68) / 0.32;
        f.fillStyle(0xd6bfa1, Math.sin(Math.PI * dust) * 0.55);
        for (let i = 0; i < 8; i++) {
          const offset = (10 + 38 * dust + i * 3) * (i % 2 === 0 ? 1 : -1);
          f.fillRect(
            Math.round(shipX + offset),
            Math.round(shipY + 10 - dust * ((i % 3) + 3)),
            4,
            2,
          );
        }
      }
    } else {
      this.drawShip(shipX, shipY, 0);
      f.fillStyle(0x7b8f9a);
      f.fillRect(shipX - 15, shipY + 10, 4, 4);
      f.fillRect(shipX + 8, shipY + 10, 4, 4);
      if (sequence?.kind === "disembark") {
        const progress = Math.min(
          1,
          sequence.elapsed / SURFACE_SEQUENCE_DURATION.disembark,
        );
        const step = Math.max(0, (progress - 0.18) / 0.82);
        const worldX = landingX * 16 + 12 + 28 * step;
        const ground = t.height(Math.floor(worldX / 16)) * 16;
        f.fillStyle(0x657d90);
        f.fillRect(shipX + 10, shipY + 4, 15, 3);
        f.fillRect(shipX + 18, shipY + 7, 15, 3);
        if (progress >= 0.18)
          this.drawAstronaut(
            Math.round(worldX - this.camX + this.centerX),
            Math.round(ground - 13 - (1 - step) * 4 - this.camY + this.centerY),
            Math.sin(step * Math.PI * 6) * 2,
            1,
          );
      } else if (g.state.mode === "surface") {
        this.drawAstronaut(
          Math.round(p.x - this.camX + this.centerX),
          Math.round(p.y - this.camY + this.centerY),
          this.grounded ? Math.sin(this.elapsed * 13) * 2 : 0,
          this.facing,
        );
      }
    }
    // Slow, deterministic day/night tint.
    f.fillStyle(0x050c25, (1 - light) * 0.35);
    f.fillRect(0, 0, this.viewWidth, this.viewHeight);
    f.fillStyle(0xffda9a, light * 0.1);
    f.fillRect(0, 0, this.viewWidth, this.viewHeight);
    if (this.building.enabled && !g.panel && !sequence) {
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
  private drawAstronaut(x: number, y: number, walk: number, facing: number) {
    const f = this.gfx;
    f.fillStyle(0x3b5164);
    f.fillRect(x - 6, y - 4, 4, 11);
    f.fillStyle(0xc0c9c8);
    f.fillRect(x - 4, y - 4, 9, 12);
    f.fillRect(x - 3, y - 12, 9, 9);
    f.fillStyle(0x5de3da);
    f.fillRect(x - 1 + (facing < 0 ? -2 : 0), y - 10, 6, 4);
    f.fillStyle(0x67858e);
    f.fillRect(x - 3, y + 7, 3, 5 + walk);
    f.fillRect(x + 2, y + 7, 3, 5 - walk);
    f.fillStyle(0xe4ad71);
    f.fillRect(x - 4, y + 1, 9, 2);
    f.fillStyle(0xbfcbd2);
    f.fillRect(x + (facing > 0 ? 5 : -9), y - 1, 5, 3);
  }
}
