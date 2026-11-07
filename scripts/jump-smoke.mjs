import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function attach() {
  await page.evaluate(() => {
    const p = document.querySelector("#app").__vue_app__._context.provides;
    window.__game = Reflect.ownKeys(p)
      .map((k) => p[k])
      .find((v) => v?._s instanceof Map)
      ._s.get("game");
  });
}
async function jump(delay) {
  const y = await page.evaluate(() => window.__game.state.player.y);
  await page.keyboard.press("Space", { delay });
  await page.waitForFunction((y) => window.__game.state.player.y < y - 5, y, {
    timeout: 2500,
  });
  await page.waitForFunction(
    (y) => Math.abs(window.__game.state.player.y - y) < 0.5,
    y,
    { timeout: 5000 },
  );
}
try {
  await page.goto(process.env.VOIDBOUND_URL || "http://127.0.0.1:5173");
  await page.getByRole("button", { name: "INICIAR EXPEDIÇÃO" }).click();
  await attach();
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.__game.state.ship.x > 340);
  await page.keyboard.up("w");
  await page.keyboard.press("e", { delay: 100 });
  await page.getByRole("button", { name: /Planície de Aurora/ }).click();
  await page.getByRole("button", { name: "EXPLORAR SUPERFÍCIE" }).click();
  await page.waitForFunction(
    () =>
      window.__game.state.mode === "surface" &&
      window.__game.state.player.y > 0,
  );
  await jump(120);
  await jump(0);
  await jump(20);
  // Keyboard focus on a HUD button must not cause Space to activate that button.
  await page.locator(".bottom-hud nav button").first().focus();
  await jump(80);
  assert.equal(await page.evaluate(() => window.__game.panel), "");
  await page.getByRole("button", { name: /Salvo às|Sem salvamento/ }).click();
  await page.waitForTimeout(250);
  await page.reload();
  await page.getByRole("button", { name: "CONTINUAR EXPEDIÇÃO" }).click();
  await attach();
  await page.waitForTimeout(400);
  await jump(0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Espaço no desktop, toque rápido, pulos consecutivos, foco no HUD e pulo após carregar a partida.",
  );
} finally {
  await browser.close();
}
