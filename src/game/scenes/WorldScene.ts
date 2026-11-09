import { starClasses } from "../../universe/stars";
import { astronautArt } from "../../wardrobe/astronautArt";
import {
  drawAsteroid,
  drawBlackHole,
  createSpaceBackdrop,
  drawSpaceStar,
  drawSpaceWreck,
  PlanetTextures,
  StellarTextures,
} from "../rendering/spaceArt";
import { SpaceCombat } from "../../combat/flight";
import {
  hasBlackMarket,
  salvage,
  SALVAGE_RANGE,
  systemWrecks,
  type Wreck,
} from "../../combat/traffic";
import type { Save, ShipModelId } from "../types";
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
import { shipModels } from "../../fleet/models";
import { shipTextures, shipTextureUrl } from "../../fleet/shipTextures";
import { shipArt } from "../../fleet/shipArt";
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
import {
  drawBoardingRamp,
  drawDockingLane,
  drawGroundWake,
  drawLandingGear,
} from "../rendering/flightEffects";
import {
  drawTerrainTile,
  surfaceMaterials,
} from "../rendering/surfaceMaterials";
import { SurfaceArt } from "../rendering/surfaceArt";
import {
  drawSurfaceRidges,
  drawTerrainDepth,
  terrainTargetAt,
} from "../rendering/surfaceDepth";
import {
  solidCell,
  stairFloor,
  stepClimb,
  stepSurface,
} from "../physics/surface";
import { cabinetWidths, isCabinet } from "../../construction/pieces";
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
import { CabinInterior } from "../cabin/CabinInterior";
import { drawStationHull } from "../station/stationArt";
import { StationInterior } from "../station/StationInterior";
import { audio } from "../systems/audio";
const ATMOSPHERE_EXIT = 3.2;
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
  private surfaceMouse?: PointerEvent;
  private surfaceTap:
    { x: number; y: number; wx: number; wy: number } | undefined;
  private shipSprites: Phaser.GameObjects.Image[] = [];
  private usedShipSprites = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  private surfaceSky!: Phaser.GameObjects.Graphics;
  private surfaceBase!: Phaser.GameObjects.Graphics;
  private surfaceArt = new SurfaceArt();
  private backdrop!: Phaser.GameObjects.Graphics;
  private spaceDust!: Phaser.GameObjects.TileSprite;
  private planetTextures = new PlanetTextures();
  private stellarTextures = new StellarTextures();
  private flightShipGfx!: Phaser.GameObjects.Graphics;
  private atmosphereGfx!: Phaser.GameObjects.Graphics;
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
  private cabin = new CabinInterior();
  private wasInCabin = false;
  private station = new StationInterior();
  private wasAtStation = false;
  private interactHeld = false;
  private jumpHeld = false;
  private jumpBuffer = new JumpBuffer();
  constructor() {
    super("world");
  }
  preload() {
    this.surfaceArt.preload(this);
    for (const hull of shipTextures)
      this.load.image("hull:" + hull, shipTextureUrl(hull));
  }
  create() {
    this.surfaceArt.prepareDoor(this);
    this.store = useGame();
    this.building = useConstruction();
    const canvas = this.game.canvas;
    const onSurface = () =>
      this.store.started &&
      this.store.state.mode === "surface" &&
      !this.store.panel &&
      !this.store.paused &&
      !this.store.busy &&
      !this.store.inSequence;
    const targetSurface = (event: PointerEvent) => {
      if (!onSurface()) return;
      const target = this.surfacePoint(event);
      if (this.building.enabled) this.building.setCursor(target.x, target.y);
      return target;
    };
    const press = (event: PointerEvent) => {
      if (event.button !== 0) return;
      this.surfaceTap = targetSurface(event);
      if (event.pointerType === "mouse") this.surfaceMouse = event;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      this.surfaceMouse = event;
      targetSurface(event);
    };
    const clearMouse = () => {
      this.surfaceMouse = undefined;
    };
    canvas.addEventListener("pointerdown", press);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", clearMouse);
    canvas.addEventListener("pointerleave", clearMouse);
    canvas.addEventListener("pointercancel", clearMouse);
    this.game.events.on("blur", clearMouse);
    this.events.once("shutdown", () => {
      canvas.removeEventListener("pointerdown", press);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", clearMouse);
      canvas.removeEventListener("pointerleave", clearMouse);
      canvas.removeEventListener("pointercancel", clearMouse);
      this.game.events.off("blur", clearMouse);
    });
    this.gfx = this.add.graphics();
    this.surfaceSky = this.add.graphics().setDepth(-1);
    this.surfaceBase = this.add.graphics().setDepth(-0.5);
    this.backdrop = this.add.graphics().setDepth(-2);
    this.spaceDust = createSpaceBackdrop(this).setVisible(false);
    this.events.once("shutdown", () => {
      this.planetTextures.clear(this);
      this.stellarTextures.clear(this);
    });
    this.flightShipGfx = this.add.graphics().setDepth(2);
    this.atmosphereGfx = this.add.graphics().setDepth(3);
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
          this.store.state.mode === "interior" ||
          this.store.state.mode === "space") &&
        !this.store.panel &&
        !this.store.paused
      )
        queuePulse("interact");
      if (e.code === "KeyQ") this.store.switchWeapon();
      if (
        e.code === "KeyF" &&
        !this.store.flightCabin &&
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
      if (
        e.code === "KeyM" &&
        this.store.state.mode !== "surface" &&
        this.store.state.mode !== "space" &&
        this.store.state.mode !== "interior"
      )
        this.store.panel = ["map", "bases"].includes(this.store.panel)
          ? ""
          : "map";
      if (
        e.code === "KeyI" &&
        this.store.state.mode !== "interior" &&
        this.store.state.mode !== "space"
      )
        this.store.panel = this.store.panel === "inventory" ? "" : "inventory";
      if (
        e.code === "KeyC" &&
        this.store.state.mode !== "surface" &&
        this.store.state.mode !== "interior" &&
        this.store.state.mode !== "space"
      )
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
  private surfacePoint(event: PointerEvent) {
    const rect = this.game.canvas.getBoundingClientRect();
    const wx =
      ((event.clientX - rect.left) * this.viewWidth) / rect.width -
      Math.floor(this.centerX - this.camX);
    const wy =
      ((event.clientY - rect.top) * this.viewHeight) / rect.height -
      Math.floor(this.centerY - this.camY);
    return { wx, wy, x: Math.floor(wx / 16), y: Math.floor(wy / 16) };
  }
  private down(key: string) {
    return this.keys[key]?.isDown ?? false;
  }
  private walkingDirection() {
    return {
      x:
        Number(this.down("D") || this.down("RIGHT") || controls.right) -
        Number(this.down("A") || this.down("LEFT") || controls.left),
      y:
        Number(this.down("S") || this.down("DOWN") || controls.down) -
        Number(this.down("W") || this.down("UP") || controls.up),
    };
  }
  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.04);
    this.elapsed += dt;
    const g = this.store;
    if (!g) return;
    g.advanceBlackHole(this.game.loop.rawDelta / 1000);
    g.advancePlanetScan(this.game.loop.rawDelta / 1000);
    for (let i = 0; i < this.usedShipSprites; i++)
      this.shipSprites[i]!.setVisible(false);
    this.usedShipSprites = 0;
    this.flightShipGfx.clear();
    this.atmosphereGfx.clear();
    this.surfaceSky.clear();
    this.surfaceBase.clear();
    this.surfaceArt.reset();
    this.backdrop.clear();
    this.spaceDust.setVisible(false);
    this.planetTextures.hide();
    this.stellarTextures.hide();
    const s = g.state;
    if (g.started && s.mode === "docked") {
      if (!this.wasAtStation) {
        this.station.reset();
        this.wasAtStation = true;
      }
      const clandestine = hasBlackMarket(g.system);
      if (!g.paused && !g.panel && !g.trading) {
        const { x, y } = this.walkingDirection();
        this.station.walk(x, y, dt, clandestine);
        const npc = this.station.nearby(clandestine);
        g.stationContact = npc?.label;
        const pressed = takePulse("interact");
        const held = this.down("E") || controls.interact;
        if (pressed || (held && !this.interactHeld)) {
          if (npc) {
            releaseControls();
            g.panel = "station:" + npc.id;
          } else {
            g.notify("Nenhum atendente ao alcance.");
          }
        }
        this.interactHeld = held;
      } else {
        this.interactHeld = this.down("E") || controls.interact;
      }
      for (const label of this.planetLabels.values()) label.setVisible(false);
      this.gfx.clear();
      this.station.draw(this, this.gfx, clandestine, (x, y, step, facing) =>
        this.drawAstronaut(x, y, step, facing),
      );
      return;
    }
    if (this.wasAtStation) {
      this.station.hide();
      g.stationContact = undefined;
      this.wasAtStation = false;
    }
    if (
      g.started &&
      (s.mode === "interior" || g.flightCabin) &&
      !g.surfaceSequence
    ) {
      if (!this.wasInCabin) {
        this.cabin.reset(g.flightCabin);
        this.wasInCabin = true;
      }
      const held = this.down("E") || controls.interact;
      if (!g.paused && !g.panel && !g.busy) {
        g.tick(dt);
        if (g.flightCabin) {
          this.spacePhysics(dt, false);
          if (!g.flightCabin) return;
        }
        const { x, y } = this.walkingDirection();
        this.cabin.walk(x, y, dt);
        g.cabinContact = this.cabin.nearby();
        if (takePulse("interact") || (held && !this.interactHeld))
          g.interactCabin();
      }
      this.interactHeld = held;
      for (const label of this.planetLabels.values()) label.setVisible(false);
      this.gfx.clear();
      this.cabin.draw(this, this.gfx, (x, y, step, facing) =>
        this.drawAstronaut(x, y, step, facing),
      );
      return;
    }
    if (this.wasInCabin) {
      this.cabin.hide();
      this.wasInCabin = false;
      g.cabinContact = undefined;
    }
    this.mineTime -= dt;
    if (this.beam) {
      this.beam.life -= dt;
      if (this.beam.life <= 0) this.beam = undefined;
    }
    if (this.lastSystem !== g.system.id || this.combatState !== s) {
      if (this.lastSystem !== g.system.id) {
        this.planetTextures.clear(this);
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
      if (s.mode === "space" && this.lastMode === "orbit") {
        this.camX = s.ship.x;
        this.camY = s.ship.y;
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
      if (sequence.kind === "takeoff") {
        if (sequence.elapsed >= ATMOSPHERE_EXIT) {
          const ship = this.takeoffInSpace(sequence.elapsed);
          this.camX = ship.x;
          this.camY = ship.y;
        } else {
          const lift = this.takeoffLift(sequence.elapsed);
          this.camX = pad + 46 * lift;
          this.camY = ground - 45 - 108 * lift;
        }
      } else {
        this.camX = sequence.kind === "landing" ? pad : pad + 40 * progress;
        this.camY = ground - 45;
      }
      this.draw(dt);
      g.advanceSurfaceSequence(
        sequence.kind === "takeoff" ? this.game.loop.rawDelta / 1000 : dt,
      );
      return;
    }
    if (s.mode === "orbit") {
      const position = planetPosition(s.planetIndex);
      this.camX = position.x;
      this.camY = position.y + this.viewHeight * 0.22;
    }
    if (g.started && !g.paused && !g.panel && !g.busy) {
      g.tick(dt);
      if (s.mode === "space") {
        this.spacePhysics(dt);
        if (s.mode !== "space") return;
      }
      if (s.mode === "surface") {
        this.surfacePhysics(dt);
        if (g.resolvePlayerDeath()) return;
      }
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
      this.surfaceMouse = undefined;
      this.interactHeld = this.down("E") || controls.interact;
    }
    if (!g.started) {
      this.camX = 350;
      this.camY = 330;
    }
    this.draw(dt);
  }
  private followRoute(dt: number, index: number) {
    const g = this.store,
      ship = g.state.ship;
    const target = planetPosition(index);
    const dx = target.x - ship.x,
      dy = target.y - ship.y;
    const distance = Math.hypot(dx, dy);
    const speed = Math.hypot(ship.vx, ship.vy);
    if (distance <= 148 && speed < 5) {
      ship.vx = 0;
      ship.vy = 0;
      g.clearRoute("Destino alcançado: " + g.routePlanet?.name + ".");
      return;
    }
    if (ship.fuel <= 0) {
      g.clearRoute("Rota interrompida por falta de combustível.");
      return;
    }
    const acceleration =
      g.model.acceleration *
      (g.state.upgrades.includes("engine") ? 105 / 65 : 1);
    const cruise = Math.min(
      g.model.speed,
      Math.sqrt(1.5 * acceleration * Math.max(0, distance - 135)),
    );
    const vx = (dx / Math.max(1, distance)) * cruise;
    const vy = (dy / Math.max(1, distance)) * cruise;
    const changeX = vx - ship.vx,
      changeY = vy - ship.vy;
    const change = Math.hypot(changeX, changeY);
    const fraction = Math.min(1, (acceleration * dt) / Math.max(0.001, change));
    ship.vx += changeX * fraction;
    ship.vy += changeY * fraction;
    if (distance > 1) {
      const turn = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ship.angle);
      ship.angle += Phaser.Math.Clamp(turn, -2.5 * dt, 2.5 * dt);
    }
    ship.fuel = Math.max(
      0,
      ship.fuel - dt * g.model.consumption * Math.min(1, change / acceleration),
    );
  }
  private spacePhysics(dt: number, piloting = true) {
    const g = this.store,
      s = g.state.ship;
    const rotate = piloting
      ? Number(this.down("D") || controls.right) -
        Number(this.down("A") || controls.left)
      : 0;
    const thrust = piloting && (this.down("W") || controls.up);
    const brake = piloting && (this.down("S") || controls.down);
    if (g.routeIndex !== undefined && (rotate || thrust || brake)) {
      g.clearRoute("Piloto automático desativado. Controle manual.");
    }
    if (g.routeIndex !== undefined) this.followRoute(dt, g.routeIndex);
    s.angle += rotate * 2.5 * dt;
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
    const pull = g.gravityWell;
    if (pull) {
      s.vx += pull.x * dt;
      s.vy += pull.y * dt;
    }
    const speed = Math.hypot(s.vx, s.vy),
      max = g.model.speed * (g.state.upgrades.includes("engine") ? 1.5 : 1);
    if (speed > max) {
      s.vx = (s.vx / speed) * max;
      s.vy = (s.vy / speed) * max;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (g.captureBlackHole()) return;
    if (g.applyStellarHeat(dt)) {
      this.camX = g.state.ship.x;
      this.camY = g.state.ship.y;
      return;
    }
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
        if (
          s.hull <= 0 &&
          g.handleHullFailure(
            "Sistema de emergência estabilizou a nave. Repare o casco.",
          )
        )
          return;
      }
    }
    if (
      piloting &&
      (takePulse("fire") || this.down("F") || controls.fire) &&
      this.combat.fire(g.state)
    )
      audio.play(260, 0.08);
    const encounter = this.combat.update(g.state, g.system, dt);
    if (encounter.impacts.length) {
      for (const { x, y } of encounter.impacts) {
        this.burst(x, y, 0xffbf66);
        this.burst(x, y, 0xffeee0);
      }
      this.cameras.main.shake(125, 0.004);
      audio.play(72, 0.16, "triangle");
      audio.play(165, 0.045);
      g.speed = Math.round(Math.hypot(s.vx, s.vy));
      if (!encounter.destroyed && !encounter.playerDisabled)
        g.notify("Colisão entre naves. Ambos os cascos sofreram danos.");
      if (!encounter.playerDisabled) void g.save();
    }
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
      if (!encounter.impacts.length) void g.save();
    }
    if (encounter.playerDisabled) {
      if (
        g.handleHullFailure(
          "Casco crítico. A nave foi estabilizada em emergência.",
        )
      )
        return;
    }
    if (this.elapsed >= this.contactAt || encounter.destroyed) {
      this.updateFlightContact();
      this.contactAt = this.elapsed + 0.12;
    }
    if (
      piloting &&
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
    g.notify("Duas frutas coletadas. Abra a mochila para comer.");
    void g.save();
  }
  private surfacePhysics(dt: number) {
    const g = this.store,
      p = g.state.player,
      t = this.terrain!;
    const direction =
      (this.down("D") || this.down("RIGHT") || controls.right ? 1 : 0) -
      (this.down("A") || this.down("LEFT") || controls.left ? 1 : 0);
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
    const vertical =
      Number(this.down("S") || this.down("DOWN") || controls.down) -
      Number(this.down("W") || this.down("UP") || controls.up);
    const grip = this.building.climbingColumn;
    const climb =
      !direction &&
      !jumping &&
      !pulse &&
      !this.building.enabled &&
      (grip !== undefined || vertical !== 0)
        ? stepClimb(p, grip, vertical, dt, t, this.building.settlement)
        : undefined;
    this.building.climbingColumn = climb ? Math.floor(climb.x / 16) : undefined;
    const movement =
      climb ??
      stepSurface(
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
    const mineButton = takePulse("mine") || controls.mine;
    const mouse = this.surfaceMouse;
    const tap = this.surfaceTap;
    this.surfaceTap = undefined;
    if (this.building.enabled) {
      if (tap) {
        this.building.apply(tap.x, tap.y);
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
    if (tap && this.mineTime > 0) {
      this.surfaceTap = tap;
      return;
    }
    const aim =
      tap ??
      (mouse && mouse.buttons & 1 ? this.surfacePoint(mouse) : undefined);
    const mobileMine = !aim && mineButton;
    if ((aim || mobileMine) && this.mineTime <= 0 && p.energy >= 1) {
      const trees = treesInRange(
        g.planet,
        t,
        Math.floor(p.x / 16) - 8,
        Math.floor(p.x / 16) + 8,
        this.building.settlement.cutTrees,
      );
      const wx = aim?.wx ?? p.x,
        wy = aim?.wy ?? p.y;
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
      let { x: tx, y: ty } = terrainTargetAt(t, wx, wy);
      if (mobileMine) {
        tx = Math.floor((p.x + this.facing * 24) / 16);
        ty = Math.floor((p.y + 14) / 16);
        if (!t.get(tx, ty)) ty++;
      }
      const tile = t.get(tx, ty);
      const distance = Math.hypot(tx * 16 + 8 - p.x, ty * 16 + 8 - p.y);
      if (tap && tile && distance >= 77)
        g.notify("Aproxime-se do bloco para minerar.");
      if (tile && ty < 63 && distance < 77) {
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
  private takeoffLift(elapsed: number) {
    return (
      Phaser.Math.Clamp((elapsed - 0.35) / (ATMOSPHERE_EXIT - 0.35), 0, 1) ** 2
    );
  }
  private takeoffInSpace(elapsed: number) {
    const planet = planetPosition(this.store.state.planetIndex);
    const progress = Phaser.Math.Clamp(
      (elapsed - ATMOSPHERE_EXIT) /
        (SURFACE_SEQUENCE_DURATION.takeoff - ATMOSPHERE_EXIT),
      0,
      1,
    );
    const remaining = (1 - progress) ** 2;
    return {
      x: planet.x - 210 + 75 * remaining,
      y: planet.y + 92 * remaining,
      remaining,
    };
  }
  private draw(dt: number) {
    const g = this.store,
      s = g.state,
      f = this.gfx;
    f.clear();
    const launch =
      g.surfaceSequence?.kind === "takeoff"
        ? g.surfaceSequence.elapsed
        : undefined;
    const surface =
      s.mode === "surface" ||
      (Boolean(g.surfaceSequence) &&
        (launch === undefined || launch < ATMOSPHERE_EXIT));
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
    const backdrop = this.backdrop;
    if (!surface) {
      if (
        this.spaceDust.width !== this.viewWidth ||
        this.spaceDust.height !== this.viewHeight
      )
        this.spaceDust.setSize(this.viewWidth, this.viewHeight);
      this.spaceDust.setTilePosition(
        this.camX * 0.065 + 32,
        this.camY * 0.065 + 24,
      );
      this.spaceDust.setVisible(true);
    } else {
      backdrop.fillStyle(sky).fillRect(0, 0, this.viewWidth, this.viewHeight);
      for (let layer = 0; layer < 3; layer++) {
        backdrop.fillStyle(
          [0x15213a, 0x18283c, 0x1b2540][layer]!,
          0.13 * (1 - light),
        );
        backdrop.fillEllipse(
          100 + layer * 170 - Math.sin(this.elapsed * 0.02) * 10,
          70 + layer * 35,
          300,
          100,
        );
      }
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
      if (surface) {
        backdrop
          .fillStyle(
            0xc7daeb,
            (0.3 + Math.sin(this.elapsed * 0.6 + star.phase) * 0.25) *
              (1 - light),
          )
          .fillRect(Math.floor(x), Math.floor(y), star.r, star.r);
      } else {
        drawSpaceStar(
          backdrop,
          Math.floor(x),
          Math.floor(y),
          star.r,
          star.phase,
          this.elapsed,
        );
      }
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
        this.surfaceSky.fillStyle(0xffd98d, light * 0.16);
        this.surfaceSky.fillCircle(sunX, sunY, radius * 1.9);
        this.surfaceSky.fillStyle(0xffe5a8, light * 0.24);
        this.surfaceSky.fillCircle(sunX, sunY, radius * 1.4);
        this.surfaceSky.fillStyle(0xffedb6, Math.min(1, light * 4));
        this.surfaceSky.fillCircle(sunX, sunY, radius);
      }
      this.drawSurface(light);
      if (storm) this.drawWeather(storm);
    } else this.drawSpace(launch);
    if (launch !== undefined) {
      const fade = Math.max(0, 1 - Math.abs(launch - ATMOSPHERE_EXIT) / 0.48);
      if (fade > 0) {
        const veil = this.atmosphereGfx;
        veil
          .fillStyle(0x080f20, fade)
          .fillRect(0, 0, this.viewWidth, this.viewHeight);
        veil
          .fillStyle(0x73bdd5, Math.sin(Math.PI * fade) * 0.24)
          .fillRect(0, 0, this.viewWidth, this.viewHeight);
      }
    }
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
  private drawSpace(launch?: number) {
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
      this.backdrop.fillStyle(0x26374c, 0.55);
      this.backdrop.fillTriangle(
        x - radius,
        y,
        x + radius * 0.45,
        y - radius,
        x + radius,
        y + radius * 0.7,
      );
    }
    const inOrbit = g.state.mode === "orbit";
    if (!inOrbit) {
      for (const star of g.system.stars) {
        const data = starClasses[star.kind];
        const x = Math.round(star.x - this.camX + this.centerX);
        const y = Math.round(star.y - this.camY + this.centerY);
        const margin = data.danger;
        if (
          x < -margin ||
          y < -margin ||
          x > this.viewWidth + margin ||
          y > this.viewHeight + margin
        )
          continue;
        const color = Number.parseInt(data.color.slice(1), 16);
        this.backdrop.lineStyle(1, color, 0.36).strokeCircle(x, y, data.danger);
        if (star.kind === "neutron") {
          this.backdrop
            .lineStyle(5, color, 0.22)
            .lineBetween(x - 32, y + 82, x + 32, y - 82);
          this.backdrop
            .lineStyle(1, 0xf3dfff, 0.75)
            .lineBetween(x - 28, y + 75, x + 28, y - 75);
        }
        this.stellarTextures.draw(this, star, x, y);
      }
    }
    const hole = g.system.blackHole;
    if (hole && !inOrbit) {
      const x = Math.round(hole.x - this.camX + this.centerX);
      const y = Math.round(hole.y - this.camY + this.centerY);
      if (
        x > -300 &&
        y > -300 &&
        x < this.viewWidth + 300 &&
        y < this.viewHeight + 300
      )
        drawBlackHole(this.backdrop, x, y, this.elapsed);
    }
    const station = inOrbit ? undefined : g.system.station;
    const docking = g.dockingSequence;
    const t = docking ? Math.min(1, docking.elapsed / DOCKING_DURATION) : 0;
    const eased = t * t * (3 - 2 * t);
    if (station) {
      const x = Math.round(station.x - this.camX + this.centerX);
      const y = Math.round(station.y - this.camY + this.centerY);
      if (
        x > -65 &&
        x < this.viewWidth + 65 &&
        y > -35 &&
        y < this.viewHeight + 35
      ) {
        const beacon = g.dockingSequence
          ? Math.floor(g.dockingSequence.elapsed * 9) % 2 === 0
          : Math.floor(this.elapsed * 2) % 4 === 0;
        const scale = 1 + eased * 0.65;
        drawStationHull(f, x, y, beacon, scale);
        if (docking)
          drawDockingLane(
            f,
            x,
            y,
            Math.atan2(s.y - station.y, s.x - station.x),
            t,
            scale,
          );
        if (docking && t > 0.78) {
          const glow = (t - 0.78) / 0.22;
          f.fillStyle(0x7af0cb, glow * 0.28).fillEllipse(
            x,
            y,
            35 * scale,
            13 * scale,
          );
        }
      }
    }
    g.system.planets.forEach((p, i) => {
      if (inOrbit && i !== g.state.planetIndex) return;
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
      const radius = inOrbit
        ? Math.round(Math.min(this.viewWidth * 0.16, this.viewHeight * 0.215))
        : 57 + (i % 3) * 8;
      this.planetTextures.draw(this, p, x, y, radius);
      if (
        g.started &&
        g.state.mode === "space" &&
        !g.panel &&
        !g.paused &&
        g.state.progression.cataloguedPlanets[p.id]
      )
        this.drawPlanetLabel(p, x, y, radius);
    });
    if (inOrbit) return;
    if (g.routeIndex !== undefined && launch === undefined) {
      const destination = planetPosition(g.routeIndex);
      const x = destination.x - this.camX + this.centerX;
      const y = destination.y - this.camY + this.centerY;
      const sx = s.x - this.camX + this.centerX;
      const sy = s.y - this.camY + this.centerY;
      f.lineStyle(1, 0x88ded8, 0.48).lineBetween(sx, sy, x, y);
      f.lineStyle(1, 0x88ded8, 0.75).strokeCircle(x, y, 9);
    }
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
      drawAsteroid(f, x, y, rock.r, rock.id, rock.ore);
    }
    if (g.started && g.state.mode === "space") {
      for (const npc of this.combat.npcs) {
        if (npc.hull <= 0) continue;
        const x = npc.x - this.camX + this.centerX;
        const y = npc.y - this.camY + this.centerY;
        const { width, height } = this.shipVisualSize(npc.model);
        const margin = Math.hypot(width, height) / 2 + 12;
        if (
          x < -margin ||
          x > this.viewWidth + margin ||
          y < -margin ||
          y > this.viewHeight + margin
        )
          continue;
        this.drawShip(x, y, npc.angle, npc.engaged, npc.model);
        const top =
          y -
          (Math.abs(Math.sin(npc.angle)) * width +
            Math.abs(Math.cos(npc.angle)) * height) /
            2;
        f.fillStyle(npc.engaged || npc.role === "pirate" ? 0xff8c78 : 0xe5bb77);
        f.fillRect(x - 11, top - 6, (22 * npc.hull) / npc.maxHull, 2);
        if (npc.shield > 0) {
          f.fillStyle(0x8ad7ff);
          f.fillRect(x - 11, top - 10, npc.shield * 0.7, 2);
        }
      }
      for (const wreck of this.nearbyWrecks()) {
        const x = Math.round(wreck.x - this.camX + this.centerX);
        const y = Math.round(wreck.y - this.camY + this.centerY);
        if (
          x >= -24 &&
          x <= this.viewWidth + 24 &&
          y >= -16 &&
          y <= this.viewHeight + 16
        )
          drawSpaceWreck(f, x, y);
      }
      for (const bolt of this.combat.bolts) {
        f.fillStyle(bolt.hostile ? 0xff8874 : (bolt.color ?? 0xe0f8be));
        f.fillCircle(
          bolt.x - this.camX + this.centerX,
          bolt.y - this.camY + this.centerY,
          2.5,
        );
      }
    }
    if (launch !== undefined) {
      const ship = this.takeoffInSpace(launch);
      this.drawShip(
        this.centerX,
        this.centerY,
        s.angle - 0.8 * ship.remaining,
        ship.remaining > 0.02,
        undefined,
        this.flightShipGfx,
        1 - 0.42 * ship.remaining,
        4,
      );
      return;
    }
    if (g.started && g.panel !== "route") {
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
        docking
          ? t < 0.78
          : this.down("W") ||
              controls.up ||
              (g.routeIndex !== undefined && g.speed > 5),
        undefined,
        this.flightShipGfx,
        1 - 0.36 * eased,
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

  private shipVisualSize(
    model: ShipModelId,
    onSurface = false,
    pirate = false,
  ) {
    const family = shipModels[model].hullFamily;
    const wide =
      !pirate &&
      (family === "atlas" || family === "mammoth" || family === "bastion");
    const widths = onSurface
      ? { light: 92, wide: 110 }
      : { light: 42, wide: 52 };
    const width = wide ? widths.wide : widths.light;
    const frame = this.textures.getFrame("hull:" + (pirate ? "raider" : model));
    const height = frame ? (frame.height / frame.width) * width : width * 0.6;
    return { width, height };
  }

  private drawShip(
    x: number,
    y: number,
    angle: number,
    thrust = false,
    model: ShipModelId = this.store.state.activeShip.model,
    f = this.gfx,
    scale = 1,
    depth = this.store.state.mode === "space" ? 4 : 0,
    pirate = false,
  ) {
    const cosine = Math.cos(angle),
      sine = Math.sin(angle);
    const point = (px: number, py: number, factor = scale) => ({
      x: Math.round(x + factor * (px * cosine - py * sine)),
      y: Math.round(y + factor * (px * sine + py * cosine)),
    });
    const family = pirate ? "raider" : shipModels[model].hullFamily;
    const texture = "hull:" + (pirate ? "raider" : model);
    const onSurface =
      f !== this.flightShipGfx && this.store.state.mode !== "space";
    const { width, height } = this.shipVisualSize(model, onSurface, pirate);
    if (this.textures.exists(texture)) {
      const i = this.usedShipSprites++;
      const sprite = (this.shipSprites[i] ??= this.add.image(0, 0, texture));
      sprite.setTexture(texture);
      sprite
        .setPosition(Math.round(x), Math.round(y))
        .setRotation(angle)
        .setDisplaySize(width * scale, height * scale)
        .setDepth(f === this.flightShipGfx ? 2.1 : onSurface ? -0.03 : 0.5)
        .setVisible(true);
      if (thrust) {
        const tail = -width * 0.47;
        const amber = family === "atlas" || family === "bastion";
        const cinematic = this.store.inSequence;
        const length = (cinematic ? 23 : 11) + Math.sin(this.elapsed * 55) * 4;
        if (cinematic) {
          f.fillStyle(amber ? 0xf9a95e : 0x59dbc9, 0.14).fillPoints(
            [
              point(tail + 5, -7),
              point(tail - length * 1.4, 0),
              point(tail + 5, 8),
            ],
            true,
          );
          for (let i = 1; i <= 3; i++) {
            const spark = point(
              tail - length * (0.55 + i * 0.25),
              Math.sin(this.elapsed * 36 + i) * i,
            );
            f.fillStyle(0xaef8e8, 0.36).fillRect(spark.x, spark.y, 2, 1);
          }
        }
        f.fillStyle(amber ? 0xf9a95e : 0x59dbc9, 0.48).fillPoints(
          [point(tail + 1, -4), point(tail - length, 1), point(tail + 1, 5)],
          true,
        );
        f.fillStyle(amber ? 0xffedb5 : 0xc8fff0, 0.9).fillPoints(
          [
            point(tail + 2, -2),
            point(tail - length * 0.68, 1),
            point(tail + 2, 3),
          ],
          true,
        );
      }
      return;
    }
    const { hull, details } = shipArt(model);
    const fallbackScale = (scale * width) / 44;
    const drawPlates = (plates: typeof hull, offset: number) => {
      for (const plate of plates) {
        const left = plate.x - 22,
          right = left + plate.w;
        const top = plate.y * (5 / 6) - 14,
          bottom = top + plate.h * (5 / 6);
        const points = [
          point(left, top, fallbackScale),
          point(right, top, fallbackScale),
          point(right, bottom, fallbackScale),
          point(left, bottom, fallbackScale),
        ];
        if (offset)
          for (const vertex of points) {
            vertex.x += offset * 0.5;
            vertex.y += offset;
          }
        f.fillStyle(offset ? 0x162d43 : plate.color).fillPoints(points, true);
      }
    };
    if (depth > 0) {
      drawPlates(hull, depth);
      drawPlates(hull, depth / 2);
    }
    drawPlates(hull, 0);
    drawPlates(details, 0);
    if (thrust) {
      f.fillStyle(0x7de3ee, 0.8);
      f.fillPoints(
        [
          point(-22, -3, fallbackScale),
          point(-34 - Math.random() * 10, 0, fallbackScale),
          point(-22, 3, fallbackScale),
        ],
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
    const material = surfaceMaterials[g.planet.kind]!;
    const sequence = g.surfaceSequence;
    const descent =
      sequence?.kind === "landing"
        ? Math.min(1, sequence.elapsed / SURFACE_SEQUENCE_DURATION.landing)
        : undefined;
    const startX = Math.floor((this.camX - this.centerX - 16) / 16),
      startY = Math.max(0, Math.floor((this.camY - this.centerY - 16) / 16));
    const endX = startX + Math.ceil(this.viewWidth / 16) + 2;
    const endY = Math.min(64, startY + Math.ceil(this.viewHeight / 16) + 2);
    const offsetX = this.centerX - this.camX;
    const offsetY = this.centerY - this.camY;
    const settlement = this.building.settlement;
    if (
      !this.surfaceArt.drawHorizon(
        this,
        g.planet.kind,
        this.viewWidth,
        this.viewHeight,
        this.camX,
        light,
      )
    )
      drawSurfaceRidges(
        this.surfaceBase,
        this.viewWidth,
        this.viewHeight,
        this.camX,
        this.camY,
        material,
        light,
      );
    // Render the projected faces behind the playable grid so blocks keep their hit areas.
    for (let x = endX - 1; x >= startX; x--)
      for (let y = startY; y < endY; y++) {
        if (t.get(x, y))
          drawTerrainDepth(
            this.surfaceBase,
            t,
            x,
            y,
            Math.floor(x * 16 + offsetX),
            Math.floor(y * 16 + offsetY),
            material.cap,
            light,
          );
      }
    const contactShadow = (x: number, feet: number, width: number) => {
      const column = Math.floor(x / 16);
      const row = Math.floor((feet - 1) / 16);
      for (let y = row; y <= row + 4; y++) {
        const floor =
          stairFloor(settlement, x, y) ??
          (solidCell(t, settlement, column, y) ? y * 16 : undefined);
        if (floor === undefined || floor < feet - 2) continue;
        const separation = Math.max(0, floor - feet);
        const opacity = 0.38 * Math.max(0, 1 - separation / 72);
        f.fillStyle(0x111b2a, opacity).fillEllipse(
          Math.round(x + offsetX + 2),
          Math.round(floor + offsetY - 1),
          width + separation * 0.12,
          4,
        );
        break;
      }
    };
    for (const tree of treesInRange(
      g.planet,
      t,
      startX,
      endX,
      settlement.cutTrees,
    )) {
      const x = tree.x * 16 + 8 + offsetX;
      const y = tree.ground * 16 + offsetY;
      const height = tree.height * 16;
      const damage = this.treeHits.get(tree.id) ?? 0;
      if (
        !this.surfaceArt.sprite(
          this,
          "tree-" + tree.kind,
          x + Math.sin(this.elapsed * 0.6 + tree.x),
          y,
          tree.crown * 35,
          height + 12,
          tree.variant === 1,
          damage ? 0.85 : 1,
          -0.6,
        )
      )
        drawAlienTree(f, tree, x, y, this.elapsed, damage);
    }
    drawSettlement(
      this.surfaceBase,
      settlement,
      this.camX,
      this.camY,
      this.viewWidth,
      this.viewHeight,
      "walls",
      material,
      (kind, x, y) => this.surfaceArt.prop(this, kind, x, y, 1),
    );
    for (let x = startX; x < endX; x++)
      for (let y = startY; y < endY; y++) {
        const tile = t.get(x, y);
        if (!tile) continue;
        const sx = Math.floor(x * 16 + offsetX);
        const sy = Math.floor(y * 16 + offsetY);
        const textured = this.surfaceArt.tile(this, sx, sy, x, y);
        drawTerrainTile(
          f,
          material,
          g.planet.kind,
          x,
          y,
          sx,
          sy,
          tile,
          !t.get(x, y - 1),
          textured,
          this.surfaceArt.deposit(this, tile, sx, sy, x, y),
        );
      }
    drawSettlement(
      f,
      this.building.settlement,
      this.camX,
      this.camY,
      this.viewWidth,
      this.viewHeight,
      "pieces",
      material,
      (kind, x, y, state) => this.surfaceArt.prop(this, kind, x, y, 1, state),
    );
    const ruin = ruinAt(g.planet, t);
    if (ruin) this.drawScienceSignal(ruin.x, ruin.y, 0xc3a2e6);
    for (const fruit of this.fruit) {
      const x = Math.round(fruit.x + offsetX);
      const y = Math.round(fruit.y + offsetY);
      if (
        !this.surfaceArt.sprite(
          this,
          "fruit-" + g.planet.kind,
          x,
          y + 8,
          24,
          20,
        )
      )
        drawFruit(f, fruit, x, y);
    }
    for (const animal of this.wildlife.animals.values()) {
      contactShadow(animal.x, animal.y + 12, animal.hostile ? 23 : 17);
      const x = Math.round(animal.x + offsetX);
      const y = Math.round(animal.y + offsetY);
      const stride = Math.sin(this.elapsed * 10 + animal.home);
      const textured = this.surfaceArt.sprite(
        this,
        (animal.hostile ? "hostile-" : "peaceful-") + animal.kind,
        x,
        y + 12 - (animal.grounded ? Math.abs(stride) * 1.5 : 0),
        animal.hostile ? 37 : 30,
        animal.hostile ? 32 : 29,
        animal.facing < 0,
      );
      if (!textured) drawAnimal(f, animal, x, y, this.elapsed);
      else if (animal.health < animal.maxHealth) {
        f.fillStyle(0x233442).fillRect(x - 10, y - 21, 20, 2);
        f.fillStyle(0xf19b82).fillRect(
          x - 10,
          y - 21,
          (20 * animal.health) / animal.maxHealth,
          2,
        );
      }
    }
    const landingX = sequence?.landingX ?? g.state.landingX;
    const shipX = landingX * 16 - this.camX + this.centerX;
    const groundY = t.height(landingX) * 16 + offsetY;
    const { width: shipWidth, height: shipHeight } = this.shipVisualSize(
      g.state.activeShip.model,
      true,
    );
    const gearOffset = shipHeight / 2 - 7;
    const shipY = groundY - (shipHeight / 2 + 5);
    if (sequence?.kind === "takeoff") {
      const elapsed = sequence.elapsed;
      const lift = this.takeoffLift(elapsed);
      const x = shipX + 68 * lift;
      const y = shipY - 158 * lift;
      const scale = 1 - 0.36 * lift;
      f.fillStyle(0x101a29, 0.38 * (1 - lift)).fillEllipse(
        shipX,
        groundY - 1,
        shipWidth * 0.64 + 24 * lift,
        4,
      );
      drawGroundWake(
        f,
        shipX,
        groundY,
        Math.min(1, elapsed / 1.65),
        biome.ground,
      );
      drawLandingGear(
        f,
        x,
        y + gearOffset * scale,
        scale,
        Phaser.Math.Clamp((0.9 - elapsed) / 0.42, 0, 1),
      );
      this.drawShip(
        x,
        y,
        -0.7 * Math.min(1, lift * 2),
        elapsed > 0.1,
        undefined,
        f,
        scale,
        3 + lift,
      );
    } else if (descent !== undefined) {
      const altitude = Math.max(0, 1 - descent / 0.84) ** 2;
      const flare = Math.sin(Math.PI * Math.min(1, descent / 0.84));
      const scale = 1 - 0.48 * altitude;
      const x = shipX - 112 * altitude + 13 * flare;
      const y = shipY - 145 * altitude;
      const depth = 3 + 2 * altitude;
      f.fillStyle(
        0x101a29,
        (0.12 + (1 - altitude) * 0.45) * Math.min(1, (1 - descent) * 8),
      );
      f.fillEllipse(
        shipX - 47 * altitude,
        groundY - 1,
        shipWidth * 0.64 + altitude * 24,
        5 + altitude * 6,
      );
      drawLandingGear(
        f,
        x,
        y + gearOffset * scale,
        scale,
        Phaser.Math.Clamp((descent - 0.58) / 0.24, 0, 1),
      );
      this.drawShip(
        x,
        y,
        -0.28 * altitude + 0.09 * flare,
        descent < 0.82,
        undefined,
        f,
        scale,
        depth,
      );
      drawGroundWake(
        f,
        shipX,
        groundY,
        Math.max(0, (descent - 0.77) / 0.23),
        biome.ground,
      );
    } else {
      contactShadow(landingX * 16, groundY - offsetY, shipWidth * 0.64);
      drawLandingGear(f, shipX, shipY + gearOffset, 1, 1);
      this.drawShip(shipX, shipY, 0, false, undefined, f, 1, 3);
      if (sequence?.kind === "disembark") {
        const progress = Math.min(
          1,
          sequence.elapsed / SURFACE_SEQUENCE_DURATION.disembark,
        );
        const step = Math.max(0, (progress - 0.18) / 0.82);
        const worldX = landingX * 16 + 12 + 28 * step;
        const ground = t.height(Math.floor(worldX / 16)) * 16;
        const ramp = Math.min(1, progress / 0.18);
        f.fillStyle(0x71e3c7, ramp * 0.26).fillTriangle(
          shipX + 11,
          groundY - 12,
          shipX + 21,
          groundY + 1,
          shipX + 37,
          groundY + 1,
        );
        drawBoardingRamp(f, shipX + 11, groundY - 8, ramp);
        if (progress >= 0.18)
          this.drawAstronaut(
            Math.round(worldX - this.camX + this.centerX),
            Math.round(ground - 13 - (1 - step) * 4 - this.camY + this.centerY),
            Math.sin(step * Math.PI * 6) * 2,
            1,
          );
      } else if (g.state.mode === "surface") {
        contactShadow(p.x, p.y + 12, 13);
        this.drawAstronaut(
          Math.round(p.x - this.camX + this.centerX),
          Math.round(p.y - this.camY + this.centerY),
          this.grounded || this.building.climbingColumn !== undefined
            ? Math.sin(this.elapsed * 13) * 2
            : 0,
          this.facing,
        );
      }
    }
    // Slow, deterministic day/night tint.
    f.fillStyle(0x050c25, (1 - light) * 0.35);
    f.fillRect(0, 0, this.viewWidth, this.viewHeight);
    f.fillStyle(0xffda9a, light * 0.1);
    f.fillRect(0, 0, this.viewWidth, this.viewHeight);
    const cursor = this.building.cursor;
    if (this.building.enabled && cursor && !g.panel && !sequence) {
      const sx = Math.round(cursor.x * 16 - this.camX + this.centerX),
        sy = Math.round(cursor.y * 16 - this.camY + this.centerY);
      if (
        !this.building.removing &&
        !this.surfaceArt.prop(this, this.building.selected, sx, sy, 0.45)
      )
        drawPiece(
          f,
          this.building.selected,
          sx,
          sy,
          material,
          this.building.facing,
          0.45,
        );
      const valid =
        this.building.removing || !this.building.errorAt(cursor.x, cursor.y);
      f.lineStyle(1, valid ? 0x9cf0cf : 0xf09d86, 0.9);
      const kind = this.building.selected;
      const door = kind === "woodDoor";
      f.strokeRect(
        sx,
        sy - (door ? 16 : 0),
        16 * (isCabinet(kind) ? cabinetWidths[kind] : 1),
        door ? 32 : 16,
      );
    }
  }
  private drawAstronaut(x: number, y: number, walk: number, facing: number) {
    const f = this.gfx;
    for (const pixel of astronautArt(
      this.store.state.wardrobe?.equipped,
      walk,
    )) {
      const dx = facing < 0 ? -pixel.x - pixel.w : pixel.x;
      f.fillStyle(pixel.color).fillRect(x + dx, y + pixel.y, pixel.w, pixel.h);
    }
  }
}
