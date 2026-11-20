import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const artifacts = "/tmp/voidbound-transfer-qa";
await mkdir(artifacts, { recursive: true });
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
    // Inventory UI only: avoid rendering the 3D world in software during this check.
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 1;
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
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
      g.newGame("transfer-qa");
      g.state.mode = "interior";
      g.state.backpack = { wood: 30 };
      g.state.inventory = { wood: 5, iron: 4 };
      g.panel = "inventory";
    });
    const columns = page.locator(".transfer-column");
    await columns
      .nth(0)
      .getByRole("button", { name: /Madeira alienígena, 30/ })
      .click(mobile ? {} : { modifiers: ["Shift"] });
    if (mobile)
      await columns
        .nth(0)
        .getByRole("button", { name: "→ Todos", exact: true })
        .click();
    assert.equal(await page.evaluate(() => g.state.inventory.wood), 35);
    await columns
      .nth(1)
      .getByRole("button", { name: /Madeira alienígena, 35/ })
      .click();
    await columns
      .nth(1)
      .getByRole("button", { name: "← 1", exact: true })
      .click();
    assert.equal(await page.evaluate(() => g.state.backpack.wood), 1);
    if (!mobile) {
      await columns
        .nth(1)
        .getByRole("button", { name: /Ferro, 4/ })
        .dragTo(columns.nth(0));
      assert.equal(await page.evaluate(() => g.state.backpack.iron), 4);
    }
    await page.getByPlaceholder("Nome do item").fill("Madeira");
    assert.equal(await page.locator(".transfer-item").count(), 2);
    await page.screenshot({
      path: `${artifacts}/cargo-${mobile ? "mobile" : "desktop"}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    for (const kind of [
      "cabinet",
      "cabinetDouble",
      "cabinetTriple",
      "fridge",
    ]) {
      await page.evaluate((kind) => {
        g.panel = "";
        g.state.mode = "surface";
        g.state.player.x = 40;
        g.state.player.y = 452;
        g.state.player.surfaceZ = 0;
        g.state.settlements[g.planet.id] = {
          pieces: { "2,28": { kind, facing: 1 } },
          walls: {},
          cabinets: { "2,28": {} },
          cutTrees: [],
        };
        g.state.backpack = { wood: 12, iron: 8 };
        b.openCabinet("2,28");
      }, kind);
      await page.getByPlaceholder("Nome do item").fill("");
      if (kind === "fridge") {
        await page.getByRole("button", { name: "Guardar tudo →" }).click();
        assert.equal(await page.evaluate(() => g.state.backpack.wood), 12);
      } else {
        await page.getByRole("button", { name: "Guardar tudo →" }).click();
        assert.equal(await page.evaluate(() => b.container.wood), 12);
        await page.getByRole("button", { name: "← Retirar tudo" }).click();
        assert.equal(await page.evaluate(() => g.state.backpack.iron), 8);
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await page.evaluate(() => {
      g.panel = "inventory";
      g.state.mode = "surface";
      g.state.backpack = { iron: 12, cookedMeat: 2, rawMeat: 1, woodWall: 4 };
      g.state.player.hunger = 50;
    });
    const backpack = page.locator(".backpack-browser");
    await backpack
      .getByRole("button", { name: "Carne assada, 2 unidades", exact: true })
      .click();
    assert.equal(await page.evaluate(() => g.state.backpack.cookedMeat), 2);
    await backpack
      .getByRole("button", { name: "Comer 1 unidade", exact: true })
      .click();
    assert.equal(await page.evaluate(() => g.state.backpack.cookedMeat), 1);
    assert.equal(await page.evaluate(() => g.state.player.hunger), 85);
    await backpack
      .getByRole("button", { name: "Materiais", exact: true })
      .click();
    assert.equal(await backpack.locator(".backpack-item").count(), 1);
    await backpack.getByRole("button", { name: "Todos", exact: true }).click();
    await page.getByPlaceholder("Buscar na mochila").fill("carne");
    assert.equal(await backpack.locator(".backpack-item").count(), 2);
    await backpack
      .getByRole("button", { name: "Carne crua, 1 unidades", exact: true })
      .click();
    await page.screenshot({
      path: `${artifacts}/backpack-${mobile ? "mobile" : "desktop"}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "Transferências PC/mobile: seleção, quantidades, Shift, arrastar, filtros, baús, geladeira e largura OK.",
  );
} finally {
  await browser.close();
}
