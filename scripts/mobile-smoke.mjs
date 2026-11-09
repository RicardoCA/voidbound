import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 280 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const artifacts = process.env.VOIDBOUND_ARTIFACTS || "/tmp/voidbound-mobile-qa";
await mkdir(artifacts, { recursive: true });
const url = process.env.VOIDBOUND_URL || "http://127.0.0.1:5173";
async function attach() {
  await page.evaluate(() => {
    const p = document.querySelector("#app").__vue_app__._context.provides;
    window.__game =
      p[Reflect.ownKeys(p).find((k) => String(k) === "Symbol(pinia)")]._s.get(
        "game",
      );
  });
}
const state = () =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.__game.state)));
const center = async (locator) => {
  const box = await locator.boundingBox();
  assert.ok(box);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
};
const client = await context.newCDPSession(page);
const touch = async (type, points) =>
  client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
async function layout(label) {
  await page.waitForTimeout(250);
  const result = await page.evaluate(() => {
    const canvas = document.querySelector("canvas"),
      host = canvas.parentElement.getBoundingClientRect(),
      box = canvas.getBoundingClientRect(),
      view = { width: innerWidth, height: innerHeight };
    const controls = [
      ...document.querySelectorAll(
        ".mobile-tools button,.touch-actions button,.touch-stick,.build-toolbar>button",
      ),
    ].filter((e) => e.getBoundingClientRect().width);
    return {
      view,
      canvas: { width: box.width, height: box.height },
      host: { width: host.width, height: host.height },
      scroll:
        document.documentElement.scrollWidth > innerWidth ||
        document.documentElement.scrollHeight > innerHeight + 1,
      centerClear:
        document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        ) === canvas,
      reachable: controls.every((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.width >= 44 &&
          r.height >= 44 &&
          r.left >= 0 &&
          r.top >= 0 &&
          r.right <= innerWidth + 1 &&
          r.bottom <= innerHeight + 1 &&
          e.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          )
        );
      }),
    };
  });
  await page.screenshot({ path: `${artifacts}/${label}.png` });
  assert.ok(
    !result.scroll,
    `No page scrolling: ${label} ${JSON.stringify(result)}`,
  );
  assert.ok(result.centerClear, `Player view unobstructed: ${label}`);
  assert.ok(
    result.reachable,
    `All touch controls >=44px and reachable: ${label}`,
  );
  assert.ok(
    Math.abs(result.canvas.width - result.host.width) < 3 &&
      Math.abs(result.canvas.height - result.host.height) < 3,
    `Canvas fills available game area: ${label} ${JSON.stringify(result)}`,
  );
  assert.ok(
    !(await page.locator(".mission-card").isVisible()),
    "Mission collapsed by default",
  );
  await page.screenshot({ path: `${artifacts}/${label}.png` });
  console.log("LAYOUT PASS", label, JSON.stringify(result.canvas));
}
try {
  await page.goto(url);
  await page.getByRole("button", { name: "INICIAR EXPEDIÇÃO" }).tap();
  await attach();
  await page.locator(".touch-stick").waitFor();
  await layout("landscape-844x280");
  // Joystick propulsion + independent second finger on the laser.
  let stick = await center(page.locator(".touch-stick"));
  stick.y -= 28;
  await touch("touchStart", [stick]);
  await page.waitForFunction(() => window.__game.state.ship.x > 210);
  const mine = {
    ...(await center(
      page.getByRole("button", { name: "Minerar asteroides", exact: true }),
    )),
    id: 2,
  };
  await touch("touchStart", [stick, mine]);
  await page.waitForTimeout(120);
  assert.ok(
    await page.evaluate(async () => {
      const { controls } = await import("/src/game/input.ts");
      return controls.up && controls.mine;
    }),
    "Multitouch propulsion + laser",
  );
  await touch("touchEnd", [mine]);
  await page.waitForTimeout(100);
  assert.ok(
    await page.evaluate(async () => {
      const { controls } = await import("/src/game/input.ts");
      return controls.up && !controls.mine;
    }),
    "Releasing laser does not stop the joystick",
  );
  await page.waitForFunction(() => window.__game.state.ship.x > 340, null, {
    timeout: 15000,
  });
  await touch("touchEnd", []);
  const brake = await page
    .getByRole("button", { name: "Frear nave" })
    .boundingBox();
  assert.ok(brake);
  await touch("touchStart", [
    { x: brake.x + brake.width / 2, y: brake.y + brake.height / 2, id: 3 },
  ]);
  await page.waitForTimeout(2400);
  await touch("touchEnd", []);
  await page.getByRole("button", { name: "Escanear planeta" }).tap();
  await page.waitForFunction(
    () => window.__game.flightTarget.action === "orbit",
  );
  await page
    .getByRole("button", { name: "Entrar em órbita", exact: true })
    .tap();
  await page.getByText("ÓRBITA ESTÁVEL / ESCANEAMENTO CONCLUÍDO").waitFor();
  await page.getByRole("button", { name: /Planície de Aurora/ }).tap();
  await page.getByRole("button", { name: "EXPLORAR SUPERFÍCIE" }).tap();
  await page.waitForFunction(
    () =>
      window.__game.state.mode === "surface" &&
      window.__game.state.player.y > 0,
  );
  await layout("surface-844x280");
  const initialX = (await state()).player.x;
  stick = await center(page.locator(".touch-stick"));
  stick.x += 28;
  await touch("touchStart", [stick]);
  await page.waitForFunction(
    (x) => window.__game.state.player.x > x + 5,
    initialX,
  );
  await touch("touchEnd", []);
  const miningTouch = {
    ...(await center(
      page.getByRole("button", { name: "Minerar blocos", exact: true }),
    )),
    id: 2,
  };
  await touch("touchStart", [miningTouch]);
  await page.waitForFunction(
    () =>
      Object.keys(window.__game.state.changes[window.__game.planet.id]).length >
        0 && (window.__game.state.inventory.wood ?? 0) > 0,
    null,
    { timeout: 15000 },
  );
  await touch("touchEnd", []);

  await page.waitForFunction(
    () =>
      Object.keys(window.__game.state.changes[window.__game.planet.id]).length >
      0,
  );
  assert.ok(
    Object.values((await state()).inventory).some((n) => n > 0),
    "Touch mining awards actual resources",
  );
  await page.getByRole("button", { name: "Abrir construção" }).tap();
  const blockRecipe = page.locator(".build-card").filter({
    has: page.getByRole("heading", { name: "Bloco de madeira", exact: true }),
  });
  await blockRecipe
    .getByRole("button", { name: "FABRICAR 4", exact: true })
    .tap();
  await blockRecipe.getByRole("button", { name: "EQUIPAR", exact: true }).tap();
  await page.waitForTimeout(500);
  const buildPoint = await page.evaluate(() => {
    const game = window.__game,
      p = game.state.player,
      c = document.querySelector("canvas"),
      box = c.getBoundingClientRect();
    const providers =
      document.querySelector("#app").__vue_app__._context.provides;
    const builder =
      providers[
        Reflect.ownKeys(providers).find((k) => String(k) === "Symbol(pinia)")
      ]._s.get("construction");
    for (let dy = 0; dy <= 3; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const tx = Math.floor(p.x / 16) + dx,
          ty = Math.floor((p.y + 12) / 16) - dy;
        if (builder.errorAt(tx, ty)) continue;
        return {
          key: `${tx},${ty}`,
          x: box.x + ((tx * 16 + 8 - p.x + c.width / 2) * box.width) / c.width,
          y:
            box.y +
            ((ty * 16 + 8 - (p.y - 32) + c.height / 2) * box.height) / c.height,
        };
      }
    return null;
  });
  assert.ok(buildPoint, "A legal building target is available");
  await page.touchscreen.tap(buildPoint.x, buildPoint.y);
  await page.waitForFunction(
    (key) =>
      window.__game.state.settlements[window.__game.planet.id]?.pieces[key]
        ?.kind === "woodBlock",
    buildPoint.key,
  );
  await layout("mobile-building-844x280");
  for (const [width, height] of [
    [390, 664],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await layout(`mobile-building-${width}x${height}`);
  }
  await page.setViewportSize({ width: 844, height: 280 });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Sair da construção" }).tap();
  await page.waitForTimeout(500);
  const initialY = (await state()).player.y;
  await page.getByRole("button", { name: "Pular", exact: true }).tap();
  await page.waitForFunction(
    (y) => window.__game.state.player.y < y - 5,
    initialY,
  );
  await page.getByRole("button", { name: "Abrir diário de expedição" }).tap();
  await page.getByRole("button", { name: "Fechar diário" }).tap();
  for (const [width, height] of [
    [390, 664],
    [320, 568],
    [667, 280],
    [844, 390],
  ]) {
    const before = await state();
    await page.setViewportSize({ width, height });
    await layout(`surface-${width}x${height}`);
    assert.equal((await state()).seed, before.seed);
    assert.deepEqual((await state()).inventory, before.inventory);
  }
  await page.getByRole("button", { name: "Abrir carga" }).tap();
  await page.getByRole("button", { name: "Fechar inventário" }).tap();
  await page.getByRole("button", { name: "Abrir construção" }).tap();
  await page.getByRole("button", { name: "Fechar construção" }).tap();
  assert.equal(
    await page.getByRole("button", { name: "Abrir mapa galáctico" }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Abrir fabricação" }).count(),
    0,
  );
  await page.getByRole("button", { name: "Pausar jogo", exact: true }).tap();
  await page.getByRole("button", { name: "SALVAR PARTIDA", exact: true }).tap();
  await page.getByRole("status").waitFor();
  await page.getByRole("button", { name: "RETOMAR EXPEDIÇÃO" }).tap();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile pilotagem, multitouch, órbita, pouso, caminhada, mineração, pulo, construção por toque, painéis, rotação e salvamento.",
  );
} finally {
  await browser.close();
}
