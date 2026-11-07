import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const url = process.env.VOIDBOUND_URL || "http://localhost:4173";
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 780 }
        : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(url);
      async function click(name, scope = page) {
        const button = scope.getByRole("button", {
          name,
          exact: typeof name === "string",
        });
        if (mobile) await button.tap();
        else await button.click();
      }
      const snapshot = () =>
        page.evaluate(() => JSON.parse(JSON.stringify(window.game.state)));
      async function attach() {
        await page.evaluate(() => {
          const providers =
            document.querySelector("#app").__vue_app__._context.provides;
          window.game = Reflect.ownKeys(providers)
            .map((key) => providers[key])
            .find((value) => value?._s instanceof Map)
            ._s.get("game");
        });
      }
      await click(/INICIAR EXPEDIÇÃO/);
      await attach();
      await page.evaluate(() => {
        // Simulate arrival with a mined cargo, keeping the initial 500 CR.
        const g = window.game,
          station = g.system.station;
        Object.assign(g.state.ship, {
          x: station.x,
          y: station.y - 80,
          vx: 0,
          vy: 0,
        });
        g.state.inventory = { iron: 50, copper: 30, wood: 6 };
      });
      if (mobile) await click("Acoplar à estação");
      else await page.keyboard.press("e", { delay: 80 });
      const station = page.getByRole("region", { name: "Estação espacial" });
      await station.waitFor();
      assert.equal((await snapshot()).credits, 500);
      await page.getByLabel("Quantidade", { exact: true }).fill("50");
      await click("Vender · 450 CR", station);
      await station.getByText("950 CR", { exact: true }).waitFor();
      await page.getByLabel("Recurso", { exact: true }).selectOption("copper");
      await page.getByLabel("Quantidade", { exact: true }).fill("30");
      await click("Vender · 360 CR", station);
      await station.getByText("1.310 CR", { exact: true }).waitFor();
      await click("Concessionária", station);
      const atlas = station.locator(".dealer-card").filter({
        has: page.getByRole("heading", { name: "Atlas C-2", exact: true }),
      });
      await click("Comprar · 1.100 CR", atlas);
      await click("Confirmar · 1.100 CR", atlas);
      await station.getByText("210 CR", { exact: true }).waitFor();
      await click("Hangar", station);
      await page.getByLabel("Quantidade a transferir").fill("4");
      await click("Transferir carga", station);
      await station.getByText("Carga transferida.", { exact: true }).waitFor();
      await click("Trocar para esta nave", station);
      await station
        .getByRole("heading", { name: "Atlas C-2 · Ativa", exact: true })
        .waitFor();
      let state = await snapshot();
      assert.equal(state.inventory.wood, 4);
      assert.equal(state.parkedShips[0].inventory.wood, 2);
      assert.equal(state.ship.hull, 150);
      await page.reload();
      await click(/CONTINUAR EXPEDIÇÃO/);
      await attach();
      await station.waitFor();
      state = await snapshot();
      assert.equal(state.credits, 210);
      assert.equal(state.activeShip.model, "atlas");
      assert.equal(state.parkedShips[0].model, "sparrow");
      await click("Hangar", station);
      if (mobile) {
        for (const [width, height] of [
          [390, 780],
          [844, 390],
          [320, 568],
        ]) {
          await page.setViewportSize({ width, height });
          assert.ok(
            await station.evaluate(
              (el) => el.scrollWidth <= el.clientWidth + 1,
            ),
            `Hangar sem overflow em ${width} × ${height}`,
          );
        }
      }
      await click("Desacoplar", station);
      await station.waitFor({ state: "detached" });
      assert.equal((await snapshot()).mode, "space");
      if (!mobile) {
        await page.keyboard.down("w");
        try {
          await page.waitForFunction(() => window.game.speed > 25);
        } finally {
          await page.keyboard.up("w");
        }
        assert.equal((await snapshot()).activeShip.model, "atlas");
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${mobile ? "mobile" : "desktop"}: acoplar, vender, comprar Atlas, transferir carga, trocar, recarregar e desacoplar.`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
