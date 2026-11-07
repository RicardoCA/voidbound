import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const artifacts =
  process.env.VOIDBOUND_ARTIFACTS || "/tmp/voidbound-construction-qa";
await mkdir(artifacts, { recursive: true });
const url = process.env.VOIDBOUND_URL || "http://127.0.0.1:5173";
async function attach() {
  await page.evaluate(() => {
    const p = document.querySelector("#app").__vue_app__._context.provides;
    const pinia =
      p[Reflect.ownKeys(p).find((k) => String(k) === "Symbol(pinia)")];
    window.__game = pinia._s.get("game");
    window.__building = pinia._s.get("construction");
  });
}
const state = () =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.__game.state)));
async function worldPoint(x, y) {
  const data = await page.evaluate(() => ({
      x: window.__game.state.player.x,
      y: window.__game.state.player.y,
      w: document.querySelector("canvas").width,
      h: document.querySelector("canvas").height,
    })),
    box = await page.locator("canvas").boundingBox();
  return {
    x: box.x + ((x - data.x + data.w / 2) * box.width) / data.w,
    y: box.y + ((y - (data.y - 32) + data.h / 2) * box.height) / data.h,
  };
}
async function clickTile(x, y) {
  const p = await worldPoint(x * 16 + 8, y * 16 + 8);
  await page.mouse.click(p.x, p.y, { delay: 80 });
  await page.waitForTimeout(280);
}
async function equip(name) {
  await page.keyboard.press("b", { delay: 80 });
  await page
    .locator(".build-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "EQUIPAR" })
    .click();
}
async function exitBuild() {
  await page.getByRole("button", { name: "Sair da construção" }).click();
}
async function save() {
  await page.getByRole("button", { name: /Salvo às|Sem salvamento/ }).click();
  await page.waitForTimeout(350);
}
try {
  await page.goto(url);
  await page.getByRole("button", { name: "INICIAR EXPEDIÇÃO" }).click();
  await attach();
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.__game.state.ship.x > 340);
  await page.keyboard.up("w");
  await page.keyboard.press("e", { delay: 100 });
  await page.getByRole("button", { name: /Planície de Aurora/ }).click();
  await page.getByRole("button", { name: "EXPLORAR SUPERFÍCIE" }).click();
  await page.waitForTimeout(900);
  const trunk = await worldPoint(88, 416);
  await page.mouse.move(trunk.x, trunk.y);
  await page.mouse.down();
  await page.waitForFunction(
    () => window.__game.state.inventory.wood >= 13,
    null,
    { timeout: 15000 },
  );
  await page.mouse.up();
  await page.waitForFunction(() => window.__game.state.inventory.wood >= 13);
  await clickTile(1, 29);
  await clickTile(4, 29);
  assert.ok((await state()).inventory.iron >= 2, "Mined iron for cabinet");
  await page.keyboard.press("b", { delay: 80 });
  for (const name of [
    "Bloco de madeira",
    "Parede de madeira",
    "Escada de madeira",
    "Armário planetário",
  ])
    await page
      .locator(".build-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: /FABRICAR/ })
      .click();
  await page
    .locator(".build-card")
    .filter({
      has: page.getByRole("heading", { name: "Bloco de madeira", exact: true }),
    })
    .getByRole("button", { name: "EQUIPAR" })
    .click();
  await clickTile(4, 29);
  await clickTile(5, 28);
  await exitBuild();
  await equip("Parede de madeira");
  for (const [x, y] of [
    [3, 28],
    [5, 27],
    [5, 26],
    [5, 25],
  ])
    await clickTile(x, y);
  await exitBuild();
  await equip("Bloco de madeira");
  await clickTile(6, 25);
  await clickTile(7, 25);
  await exitBuild();
  await equip("Escada de madeira");
  await clickTile(4, 28);
  await exitBuild();
  await equip("Armário planetário");
  await clickTile(3, 28);
  await exitBuild();
  let s = await state(),
    data = s.settlements[Object.keys(s.settlements)[0]];
  assert.equal(Object.keys(data.pieces).length, 6, JSON.stringify(data));
  assert.equal(Object.keys(data.walls).length, 4);
  assert.ok(data.cutTrees.includes("tree:0"));
  await clickTile(3, 28);
  await page
    .getByRole("heading", { name: "Armário planetário", exact: true })
    .waitFor();
  const beforeStairs = (await state()).inventory.woodStairs;
  await page
    .getByRole("button", { name: "Guardar Escada de madeira", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar Escada de madeira", exact: true })
    .click();
  await page.getByRole("button", { name: "Fechar armário" }).click();
  // Traverse the built stair to the raised floor with normal movement.
  await page.keyboard.down("d");
  await page.waitForFunction(() => window.__game.state.player.x > 84, null, {
    timeout: 10000,
  });
  await page.keyboard.up("d");
  assert.ok(
    (await state()).player.y + 12 < 453,
    "Walked up the real staircase",
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${artifacts}/home.png` });
  await save();
  const snapshot = await state();
  await page.reload();
  await page.getByRole("button", { name: "CONTINUAR EXPEDIÇÃO" }).click();
  await attach();
  const restored = await state();
  assert.deepEqual(restored.settlements, snapshot.settlements);
  assert.deepEqual(restored.inventory, snapshot.inventory);
  assert.equal(restored.version, 3);
  await page.waitForTimeout(700);
  await clickTile(3, 28);
  await page
    .getByRole("button", { name: "Retirar Escada de madeira", exact: true })
    .click();
  assert.equal((await state()).inventory.woodStairs, beforeStairs - 1);
  await page.getByRole("button", { name: "Fechar armário" }).click();
  await page.keyboard.press("m", { delay: 80 });
  await page.getByRole("tab", { name: /Bases e depósitos/ }).click();
  assert.equal(await page.locator(".base-card").count(), 1);
  assert.ok(
    (await page.locator(".base-card").innerText()).includes("1 unidade"),
  );
  assert.ok(
    (await page.locator(".base-card > .base-items").innerText()).includes(
      "Escada de madeira",
    ),
  );
  await page.getByRole("button", { name: "Fechar mapa" }).click();
  await page.screenshot({ path: `${artifacts}/restored.png` });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: coletar madeira/ferro reais → fabricar → construir pisos, paredes, escada e armário → guardar → subir escada → reload → recuperar itens.",
  );
} finally {
  await browser.close();
}
