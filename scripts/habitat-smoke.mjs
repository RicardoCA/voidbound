import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const artifacts =
  process.env.VOIDBOUND_ARTIFACTS || "/tmp/voidbound-habitat-qa";
await mkdir(artifacts, { recursive: true });
const url = process.env.VOIDBOUND_URL || "http://127.0.0.1:5173";
async function attach() {
  await page.evaluate(() => {
    const p = document.querySelector("#app").__vue_app__._context.provides;
    window.__game = Reflect.ownKeys(p)
      .map((k) => p[k])
      .find((v) => v?._s instanceof Map)
      ._s.get("game");
  });
}
const state = () =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.__game.state)));
async function point(wx, wy) {
  const actor = await page.evaluate(() => ({
      x: window.__game.state.player.x,
      y: window.__game.state.player.y,
      w: document.querySelector("canvas").width,
      h: document.querySelector("canvas").height,
    })),
    box = await page.locator("canvas").boundingBox();
  return {
    x: box.x + ((wx - actor.x + actor.w / 2) * box.width) / actor.w,
    y: box.y + ((wy - (actor.y - 32) + actor.h / 2) * box.height) / actor.h,
  };
}
async function tapWorld(wx, wy) {
  const p = await point(wx, wy);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(220);
}
async function equip(name, first = false) {
  if (!first)
    await page
      .getByRole("button", { name: "Escolher peça de construção" })
      .tap();
  await page
    .locator(".build-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "EQUIPAR", exact: true })
    .tap();
}
async function manualSave() {
  await page.getByRole("button", { name: "Pausar jogo", exact: true }).tap();
  const before = await page.evaluate(() => window.__game.saveRevision);
  await page.getByRole("button", { name: "SALVAR PARTIDA", exact: true }).tap();
  await page.waitForFunction((n) => window.__game.saveRevision > n, before);
}
async function reload() {
  await page.reload();
  await page.getByRole("button", { name: "CONTINUAR EXPEDIÇÃO" }).tap();
  await attach();
  await page.waitForTimeout(850);
}
const client = await context.newCDPSession(page);
async function startRight() {
  const box = await page.locator(".touch-stick").boundingBox();
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: box.x + box.width / 2 + 28, y: box.y + box.height / 2, id: 1 },
    ],
  });
}
async function release() {
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}
try {
  await page.goto(url);
  await page.getByRole("button", { name: "INICIAR EXPEDIÇÃO" }).tap();
  await attach();
  // Saved house shell and ingredients are a fixture; craft, placement and all interactions use the real UI.
  await page.evaluate(() => {
    const g = window.__game;
    g.orbit(0);
    g.land(0);
    g.exit();
    g.state.player = { x: 40, y: 452, health: 100, oxygen: 30, energy: 100 };
    g.state.time = 0;
    g.state.backpack = {
      wood: 4,
      iron: 1,
      plate: 6,
      copper: 2,
      silicon: 3,
      circuit: 3,
      cell: 3,
    };
    const data = {
      pieces: {},
      walls: {},
      cabinets: {},
      cutTrees: ["tree:0"],
      utilityTime: 0,
    };
    for (let x = 3; x <= 8; x++)
      data.pieces[`${x},25`] = { kind: "woodBlock", facing: 1 };
    data.pieces["3,26"] = { kind: "woodBlock", facing: 1 };
    for (let y = 26; y <= 28; y++)
      data.pieces[`8,${y}`] = { kind: "woodBlock", facing: 1 };
    for (let x = 4; x <= 7; x++)
      for (let y = 26; y <= 28; y++) data.walls[`${x},${y}`] = true;
    g.state.settlements[g.planet.id] = data;
    g.worldChanged();
  });
  await page.waitForTimeout(850);
  await page.getByRole("button", { name: "Abrir construção" }).tap();
  for (const name of [
    "Porta de madeira",
    "Placa solar",
    "Bateria estacionária",
    "Gerador de oxigênio",
  ])
    await page
      .locator(".build-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "FABRICAR 1", exact: true })
      .tap();
  await equip("Porta de madeira", true);
  await tapWorld(56, 456);
  await page.waitForFunction(
    () =>
      window.__game.state.settlements[window.__game.planet.id].pieces["3,28"]
        ?.kind === "woodDoor",
  );
  await equip("Placa solar");
  await tapWorld(104, 392);
  await equip("Bateria estacionária");
  await tapWorld(120, 456);
  await equip("Gerador de oxigênio");
  await tapWorld(104, 456);
  await page.getByRole("button", { name: "Sair da construção" }).tap();
  await page.waitForFunction(
    () =>
      window.__game.state.settlements[window.__game.planet.id].pieces["6,28"]
        ?.oxygen > 2,
  );
  await startRight();
  await page.waitForTimeout(600);
  await release();
  assert.ok((await state()).player.x < 48, "Closed door blocks movement");
  await page
    .getByRole("button", {
      name: "Interagir com porta, nave ou armário",
      exact: true,
    })
    .tap();
  await page.waitForFunction(
    () =>
      window.__game.state.settlements[window.__game.planet.id].pieces["3,28"]
        .open === true,
  );
  await startRight();
  await page.waitForFunction(() => window.__game.state.player.x > 72);
  await release();
  await page.waitForTimeout(850);
  const outside = (await state()).player.oxygen;
  await page.waitForTimeout(400);
  assert.ok(
    (await state()).player.oxygen < outside,
    "Open door does not refill the suit",
  );
  await tapWorld(56, 440);
  await page.waitForFunction(() => window.__game.habitat.supplied);
  const low = (await state()).player.oxygen;
  await page.waitForFunction(
    (n) => window.__game.state.player.oxygen > n + 3,
    low,
  );
  await page.waitForTimeout(4100);
  await page.screenshot({ path: `${artifacts}/pressurized-house.png` });
  await page.evaluate(() => {
    const g = window.__game,
      data = g.state.settlements[g.planet.id];
    g.state.time = 450;
    data.utilityTime = 450;
    data.pieces["6,28"].oxygen = 0;
  });
  const nightCharge = await page.evaluate(
    () =>
      window.__game.state.settlements[window.__game.planet.id].pieces["7,28"]
        .energy,
  );
  await page.waitForTimeout(600);
  assert.ok(
    await page.evaluate(() => window.__game.habitat.supplied),
    "Battery supplies oxygen at night",
  );
  assert.ok(
    await page.evaluate(
      (before) =>
        window.__game.state.settlements[window.__game.planet.id].pieces["7,28"]
          .energy < before,
      nightCharge,
    ),
    "Battery discharges at night",
  );
  await manualSave();
  const snapshot = await state();
  await reload();
  let saved = await state(),
    pieces = saved.settlements[Object.keys(saved.settlements)[0]].pieces;
  assert.equal(saved.version, 4);
  assert.equal(pieces["3,28"].open, false);
  assert.ok(pieces["7,28"].energy > 0);
  assert.ok(
    pieces["7,28"].energy <=
      snapshot.settlements[Object.keys(snapshot.settlements)[0]].pieces["7,28"]
        .energy,
  );
  assert.ok(saved.player.oxygen >= snapshot.player.oxygen);
  await tapWorld(56, 440);
  await page.waitForFunction(
    () =>
      window.__game.state.settlements[window.__game.planet.id].pieces["3,28"]
        .open,
  );
  await manualSave();
  await reload();
  saved = await state();
  pieces = saved.settlements[Object.keys(saved.settlements)[0]].pieces;
  assert.equal(pieces["3,28"].open, true);
  assert.ok(!(await page.evaluate(() => window.__game.habitat.supplied)));
  await tapWorld(56, 440);
  await page.waitForFunction(() => window.__game.habitat.supplied);
  await page.setViewportSize({ width: 390, height: 664 });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Abrir construção" }).tap();
  assert.equal(await page.locator(".build-card").count(), 9);
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  );
  await page.screenshot({ path: `${artifacts}/utilities-mobile.png` });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: fabricar/instalar porta, placa, bateria e gerador → colisão → abrir, entrar, fechar → recarregar O₂ → bateria alimenta O₂ à noite → salvar/load porta e carga → menu móvel.",
  );
} finally {
  await browser.close();
}
