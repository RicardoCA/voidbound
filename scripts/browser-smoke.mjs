import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const artifactDir = process.env.VOIDBOUND_ARTIFACTS || "/tmp/voidbound-qa";
await mkdir(artifactDir, { recursive: true });
const state = () =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.__game.state)));
async function attach() {
  await page.evaluate(() => {
    const p = document.querySelector("#app").__vue_app__._context.provides;
    window.__game =
      p[Reflect.ownKeys(p).find((k) => String(k) === "Symbol(pinia)")]._s.get(
        "game",
      );
  });
}
try {
  await page.goto(process.env.VOIDBOUND_URL || "http://127.0.0.1:5173");
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(500);
  await attach();
  await page.screenshot({ path: `${artifactDir}/menu.png` });
  await page.getByRole("button", { name: "INICIAR EXPEDIÇÃO" }).click();
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.__game.state.ship.x > 340, null, {
    timeout: 15000,
  });
  await page.keyboard.up("w");
  await page.keyboard.press("e", { delay: 100 });
  await page.getByText("ÓRBITA ESTÁVEL / ESCANEAMENTO CONCLUÍDO").waitFor();
  await page.getByRole("button", { name: /Planície de Aurora/ }).click();
  await page.getByRole("button", { name: "EXPLORAR SUPERFÍCIE" }).click();
  await page.waitForFunction(
    () =>
      window.__game.state.mode === "surface" &&
      window.__game.state.player.y > 0,
  );
  assert.equal((await state()).mode, "surface");
  // Remove actual generated terrain with mouse input. No inventory grants.
  for (let attempt = 0; attempt < 80; attempt++) {
    const inv = (await state()).inventory;
    if (
      (inv.iron ?? 0) >= 6 &&
      (inv.copper ?? 0) >= 4 &&
      (inv.silicon ?? 0) >= 2
    )
      break;
    const target = await page.evaluate(async () => {
      const { Terrain, tileItems } =
        await import("/src/game/procedural/terrain.ts");
      const g = window.__game,
        p = g.state.player,
        t = new Terrain(g.planet, g.state.changes[g.planet.id]);
      const wanted = (id) =>
        id === "iron"
          ? (g.state.inventory.iron ?? 0) < 6
          : id === "copper"
            ? (g.state.inventory.copper ?? 0) < 4
            : id === "silicon"
              ? (g.state.inventory.silicon ?? 0) < 2
              : false;
      for (let y = Math.floor(p.y / 16); y < Math.floor(p.y / 16) + 5; y++)
        for (
          let x = Math.floor(p.x / 16) - 4;
          x <= Math.floor(p.x / 16) + 4;
          x++
        ) {
          if (Math.abs(x * 16 + 8 - p.x) < 12) continue;
          const tile = t.get(x, y);
          if (
            !tile ||
            Math.hypot(x * 16 + 8 - p.x, y * 16 + 8 - p.y) >= 73 ||
            !wanted(tileItems[tile] ?? "iron")
          )
            continue;
          return {
            x: x * 16 + 8 - p.x + 240,
            y: y * 16 + 8 - (p.y - 32) + 135,
          };
        }
      return null;
    });
    if (!target) {
      await page.keyboard.down("d");
      await page.waitForTimeout(350);
      await page.keyboard.up("d");
      await page.waitForTimeout(500);
      continue;
    }
    const box = await page.locator("canvas").boundingBox();
    await page.mouse.click(
      box.x + (target.x * box.width) / 480,
      box.y + (target.y * box.height) / 270,
      { delay: 100 },
    );
    await page.waitForTimeout(300);
  }
  let s = await state();
  assert.ok(
    s.inventory.iron >= 6 &&
      s.inventory.copper >= 4 &&
      s.inventory.silicon >= 2,
    `Collected ${JSON.stringify(s.inventory)}`,
  );
  await page.screenshot({ path: `${artifactDir}/surface.png` });
  // Walk back to the actual landing zone if the mineral search took us away.
  if (Math.abs(s.player.x - s.landingX * 16) > 70) {
    await page.keyboard.down("a");
    await page.waitForFunction(
      () =>
        window.__game.state.player.x - window.__game.state.landingX * 16 < 65,
      null,
      { timeout: 15000 },
    );
    await page.keyboard.up("a");
  }
  await page.keyboard.press("e", { delay: 100 });
  await page.getByRole("button", { name: /FABRICAÇÃO & REFINARIA/ }).waitFor();
  await page.getByRole("button", { name: /FABRICAÇÃO & REFINARIA/ }).click();
  const make = async (name, n = 1) => {
    for (let i = 0; i < n; i++)
      await page
        .locator(".recipe")
        .filter({ has: page.getByRole("heading", { name, exact: true }) })
        .getByRole("button")
        .click();
  };
  await make("Placa metálica", 2);
  await make("Circuito básico", 2);
  await make("Kit de reparo");
  await page.getByRole("button", { name: "Fechar fabricação" }).click();
  await page.getByRole("button", { name: /CARGA & MELHORIAS/ }).click();
  await page.getByRole("button", { name: /Kit de reparo/ }).click();
  await page.getByRole("button", { name: "Fechar inventário" }).click();
  await page.getByRole("button", { name: /DECOLAR ·/ }).click();
  s = await state();
  assert.equal(s.mode, "space");
  assert.equal(s.ship.hull, 100);
  assert.equal(s.mission, 4);
  await page.getByRole("button", { name: /Salvo às|Sem salvamento/ }).click();
  await page.waitForTimeout(400);
  const snapshot = await state();
  await page.reload();
  await page.getByRole("button", { name: "CONTINUAR EXPEDIÇÃO" }).click();
  await attach();
  s = await state();
  assert.equal(s.seed, snapshot.seed);
  assert.deepEqual(s.changes, snapshot.changes);
  assert.deepEqual(s.inventory, snapshot.inventory);
  assert.equal(s.mission, 4);
  await page.screenshot({ path: `${artifactDir}/flight.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.screenshot({ path: `${artifactDir}/mobile.png` });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: pilotar → órbita → pousar → minerar recursos reais → fabricar → reparar → decolar → recarregar salvamento. Layout 390 px sem overflow.",
  );
} finally {
  await browser.close();
}
