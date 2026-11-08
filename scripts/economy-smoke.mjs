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
      async function talk(label, direction) {
        if (direction) {
          const stick = mobile
            ? await page
                .getByRole("group", { name: "Joystick de movimento" })
                .boundingBox()
            : null;
          if (stick) {
            const x = stick.x + stick.width * (direction === "d" ? 0.85 : 0.15);
            await page.mouse.move(x, stick.y + stick.height / 2);
            await page.mouse.down();
          } else {
            await page.keyboard.down(direction);
          }
          try {
            await page.waitForFunction(
              (target) => window.game.stationContact === target,
              label,
            );
          } finally {
            if (stick) await page.mouse.up();
            else await page.keyboard.up(direction);
          }
        }
        if (mobile) await click("Conversar com atendente");
        else await page.keyboard.press("e");
        await station
          .getByRole("heading", { name: label, exact: true })
          .first()
          .waitFor();
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
      await page
        .locator(".surface-sequence-caption")
        .filter({ hasText: "Acoplando" })
        .waitFor();
      assert.equal((await snapshot()).mode, "space");
      assert.equal(await station.count(), 0);
      await page.waitForFunction(
        () => window.game.stationContact === "Embarque",
      );
      assert.equal(await station.count(), 0);
      // Leave before walking through the hall, while some labels are uncreated.
      await talk("Embarque");
      await click("Sim", station);
      await page.waitForFunction(
        () =>
          window.game.state.mode === "space" &&
          window.game.stationContact === undefined,
        null,
        { timeout: 5000 },
      );
      assert.deepEqual(errors, []);
      if (mobile) await click("Acoplar à estação");
      else await page.keyboard.press("e");
      await page.waitForFunction(
        () => window.game.stationContact === "Embarque",
      );
      await talk("Mercado", "d");
      await station
        .getByText("Ei, amigo! Quer comprar ou vender seus itens?")
        .waitFor();
      await click("Não", station);
      await station.waitFor({ state: "detached" });
      await talk("Mercado");
      await click("Sim", station);
      assert.equal((await snapshot()).credits, 500);
      await page.getByLabel("Quantidade", { exact: true }).fill("50");
      await click("Vender · 450 CR", station);
      await station.getByText("950 CR", { exact: true }).waitFor();
      await page.getByLabel("Recurso", { exact: true }).selectOption("copper");
      await page.getByLabel("Quantidade", { exact: true }).fill("30");
      await click("Vender · 360 CR", station);
      await station.getByText("1.310 CR", { exact: true }).waitFor();
      await click("Encerrar conversa", station);
      await talk("Concessionária", "d");
      await click("Sim", station);
      const atlas = station.locator(".dealer-card").filter({
        has: page.getByRole("heading", { name: "Atlas C-2", exact: true }),
      });
      await click("Comprar · 1.100 CR", atlas);
      await click("Confirmar · 1.100 CR", atlas);
      await station.getByText("210 CR", { exact: true }).waitFor();
      await click("Encerrar conversa", station);
      await talk("Hangar", "d");
      await click("Sim", station);
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
      await page.waitForFunction(
        () => window.game.stationContact === "Embarque",
      );
      state = await snapshot();
      assert.equal(state.credits, 210);
      assert.equal(state.activeShip.model, "atlas");
      assert.equal(state.parkedShips[0].model, "sparrow");
      await talk("Hangar", "d");
      await click("Sim", station);
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
      await click("Encerrar conversa", station);
      await talk("Embarque", "a");
      await click("Sim", station);
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
