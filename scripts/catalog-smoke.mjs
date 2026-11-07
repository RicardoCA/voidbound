import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
    viewport: { width: 390, height: 664 },
    isMobile: true,
    hasTouch: true,
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const artifacts =
  process.env.VOIDBOUND_ARTIFACTS || "/tmp/voidbound-catalog-qa";
await mkdir(artifacts, { recursive: true });
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
  await page.getByRole("button", { name: "INICIAR EXPEDIÇÃO" }).tap();
  await attach();
  // Deliberate saved-world fixtures for UI tests, including a deposit far beyond jump range.
  const names = await page.evaluate(async () => {
    const { systemAt } = await import("/src/universe/generator.ts"),
      g = window.__game,
      local = g.planet,
      far = systemAt(g.state.seed, -12, 7).planets[0],
      empty = systemAt(g.state.seed, 8, -9).planets[0];
    g.state.settlements = {
      [local.id]: {
        pieces: { "30,28": { kind: "cabinet", facing: 1 } },
        walls: { "31,28": true },
        cabinets: { "30,28": { iron: 10, wood: 11 } },
        cutTrees: [],
      },
      [far.id]: {
        pieces: { "-50,28": { kind: "cabinet", facing: 1 } },
        walls: {},
        cabinets: { "-50,28": { copper: 12, wood: 100 } },
        cutTrees: [],
      },
      [empty.id]: {
        pieces: { "4,28": { kind: "cabinet", facing: 1 } },
        walls: {},
        cabinets: { "4,28": {} },
        cutTrees: [],
      },
    };
    g.orbit(0);
    await g.save();
    return { local: local.name, far: far.name, empty: empty.name };
  });
  await page.reload();
  await page.getByRole("button", { name: "CONTINUAR EXPEDIÇÃO" }).tap();
  await attach();
  assert.ok(
    (await page.locator(".orbit-base-summary").innerText()).includes(
      "21 unidades guardadas",
    ),
  );
  assert.ok(
    (
      await page
        .getByRole("button", { name: /Dorsal do Horizonte/ })
        .innerText()
    ).includes("21 unidades"),
  );
  await page
    .getByRole("button", { name: /Ver bases, conteúdo e coordenadas/ })
    .tap();
  await page.getByRole("heading", { name: "Suas bases e depósitos" }).waitFor();
  assert.equal(await page.locator(".base-card").count(), 3);
  await page.getByLabel("Só com itens").check();
  assert.equal(await page.locator(".base-card").count(), 2);
  await page.getByLabel("Só com itens").uncheck();
  assert.equal(await page.locator(".base-card").count(), 3);
  const search = page.getByRole("searchbox", {
    name: "Buscar bases e recursos",
  });
  await search.pressSequentially("madeira alienigena", { delay: 25 });
  assert.equal(await search.inputValue(), "madeira alienigena");
  assert.equal(await page.locator(".base-card").count(), 2);
  await page
    .getByRole("searchbox", { name: "Buscar bases e recursos" })
    .fill("cóbre");
  assert.equal(await page.locator(".base-card").count(), 1);
  assert.ok((await page.locator(".base-card").innerText()).includes(names.far));
  await page.locator(".cabinet-locations summary").tap();
  assert.ok(
    (await page.locator(".cabinet-location").innerText()).includes("(-50, 28)"),
  );
  await page.screenshot({ path: `${artifacts}/deposits.png` });
  const before = await page.evaluate(() => ({
    x: window.__game.state.systemX,
    y: window.__game.state.systemY,
    fuel: window.__game.state.ship.fuel,
  }));
  await page
    .getByRole("button", {
      name: `Localizar ${names.far} no mapa`,
      exact: true,
    })
    .tap();
  await page.getByRole("tab", { name: "Navegação", exact: true }).waitFor();
  assert.equal(await page.locator(".star-node.chosen.has-stock").count(), 1);
  assert.ok(
    (await page.locator(".map-toolbar").innerText()).includes("-12, 7"),
  );
  assert.deepEqual(
    await page.evaluate(() => ({
      x: window.__game.state.systemX,
      y: window.__game.state.systemY,
      fuel: window.__game.state.ship.fuel,
    })),
    before,
  );
  assert.ok(
    await page.getByRole("button", { name: "INICIAR SALTO" }).isDisabled(),
  );
  await page.screenshot({ path: `${artifacts}/map-marker.png` });
  await page.locator(".selected-system-bases button").tap();
  assert.equal(await page.locator(".base-card").count(), 1);
  await page.getByRole("button", { name: "Mostrar todos os planetas" }).tap();
  assert.equal(await page.locator(".base-card").count(), 3);
  for (const [width, height] of [
    [320, 568],
    [844, 280],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    );
    await page
      .getByRole("button", {
        name: `Localizar ${names.local} no mapa`,
        exact: true,
      })
      .tap();
    assert.equal(await page.locator(".star-node.chosen.has-stock").count(), 1);
    await page.getByRole("tab", { name: /Bases e depósitos/ }).tap();
    await page.screenshot({
      path: `${artifacts}/registry-${width}x${height}.png`,
    });
  }
  await page.getByRole("button", { name: "Fechar mapa" }).tap();
  assert.ok(await page.locator(".orbit-base-summary").isVisible());
  assert.deepEqual(errors, []);
  console.log(
    "PASS: catálogo após load, totais, busca por recurso, armários vazios, coordenadas, marcador remoto sem teleporte, órbita e tamanhos móveis.",
  );
} finally {
  await browser.close();
}
