import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
await mkdir("/tmp/voidbound-build-menu-qa", { recursive: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 1;
    });
    await page.goto(process.env.VOIDBOUND_URL || "http://127.0.0.1:4173/");
    await page.waitForFunction(
      () => document.querySelector("#app")?.__vue_app__,
    );
    await page.evaluate(() => {
      const p = document.querySelector("#app").__vue_app__._context.provides;
      const pinia =
        p[Reflect.ownKeys(p).find((k) => String(k) === "Symbol(pinia)")];
      window.g = pinia._s.get("game");
      window.b = pinia._s.get("construction");
      g.newGame("VOIDBOUND");
      g.state.mode = "surface";
      g.state.backpack = { wood: 2, cabinetDouble: 1 };
      g.panel = "build";
    });
    const search = page.getByPlaceholder("Nome, função ou material");
    await search.fill("meteorologica");
    assert.equal(await page.locator(".build-pick").count(), 1);
    await search.fill("");
    await page.getByRole("button", { name: "Ciência", exact: true }).click();
    assert.equal(await page.locator(".build-pick").count(), 4);
    await page.getByLabel("Só fabricáveis", { exact: true }).check();
    assert.equal(await page.locator(".build-pick").count(), 0);
    await page
      .getByRole("button", { name: "Limpar filtros", exact: true })
      .click();
    await page.getByLabel("Só na mochila", { exact: true }).check();
    assert.equal(await page.locator(".build-pick").count(), 1);
    await page.getByLabel("Só na mochila", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Selecionar Bloco de madeira", exact: true })
      .click();
    assert.equal(await page.evaluate(() => g.state.backpack.wood), 2);
    assert.equal(await page.evaluate(() => b.enabled), false);
    await page
      .locator(".build-detail")
      .getByRole("button", { name: "Fabricar 4", exact: true })
      .click();
    assert.equal(await page.evaluate(() => g.state.backpack.woodBlock), 4);
    assert.equal(await page.evaluate(() => g.state.backpack.wood ?? 0), 0);
    await page.screenshot({
      path: `/tmp/voidbound-build-menu-qa/build-${mobile ? "mobile" : "desktop"}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page
      .locator(".build-detail")
      .getByRole("button", { name: "Equipar", exact: true })
      .click();
    assert.equal(await page.evaluate(() => b.selected), "woodBlock");
    assert.equal(await page.evaluate(() => b.enabled), true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "Catálogo PC/mobile: busca, categorias, filtros combinados, limpeza, seleção, fabricação, equipamento e largura OK.",
  );
} finally {
  await browser.close();
}
