import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto(process.env.VOIDBOUND_URL || "http://127.0.0.1:4173");
  await page.evaluate(async () => {
    const p = document.querySelector("#app").__vue_app__._context.provides;
    window.g =
      p[Reflect.ownKeys(p).find((k) => String(k) === "Symbol(pinia)")]._s.get(
        "game",
      );
    window.g.newGame("VOIDBOUND");
    const inputUrl = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname === "/src/game/input.ts");
    window.input = await import(inputUrl || "/src/game/input.ts");
    window.flight = (await import("/src/game/rendering/flight3D.ts")).flight3D;
    window.g.state.mode = "surface";
    window.g.panel = "";
    window.g.paused = false;
  });
  const walk = page.getByRole("button", {
    name: "Segure para andar para a frente",
  });
  await walk.waitFor();
  await page.waitForFunction(() => window.flight.surfaceView && !window.g.busy);
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".touch-stick").count(), 0);
  const box = await walk.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44);
  const cdp = await context.newCDPSession(page);
  const finger = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [finger],
  });
  assert.equal(await page.evaluate(() => window.input.controls.up), true);
  const yaw = await page.evaluate(() => window.flight.surfaceLook.yaw);
  const look = { x: 210, y: 380, id: 2 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [finger, look],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [finger, { ...look, x: 270, y: 420 }],
  });
  assert.equal(await page.evaluate(() => window.input.controls.up), true);
  assert.notEqual(
    await page.evaluate(() => window.flight.surfaceLook.yaw),
    yaw,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.equal(await page.evaluate(() => window.input.controls.up), false);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [finger],
  });
  await page.evaluate(() => (window.g.paused = true));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.equal(await page.evaluate(() => window.input.controls.up), false);
  await page.evaluate(() => {
    window.g.paused = false;
    window.g.state.mode = "space";
  });
  const accelerate = page.getByRole("button", {
    name: "Segure para acelerar a nave",
  });
  async function flightControls(colossal) {
    await accelerate.waitFor();
    assert.equal(await page.locator(".touch-stick").count(), 0);
    assert.equal(
      await page.getByRole("button", { name: "Frear nave" }).isVisible(),
      true,
    );
    const button = await accelerate.boundingBox();
    const throttle = {
      x: button.x + button.width / 2,
      y: button.y + button.height / 2,
      id: 1,
    };
    const before = await page.evaluate(
      (colossal) =>
        colossal
          ? (window.g.localColossal.angle ?? 0)
          : window.g.state.ship.angle,
      colossal,
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [throttle],
    });
    assert.equal(await page.evaluate(() => window.input.controls.up), true);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [throttle, look],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [throttle, { ...look, x: 280, y: 340 }],
    });
    await page.waitForFunction(
      ({ colossal, before }) =>
        Math.abs(
          (colossal
            ? (window.g.localColossal.angle ?? 0)
            : window.g.state.ship.angle) - before,
        ) > 0.001,
      { colossal, before },
    );
    assert.equal(await page.evaluate(() => window.input.controls.up), true);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.equal(await page.evaluate(() => window.input.controls.up), false);
    assert.equal(
      await page.evaluate(() => window.input.touchFlightLook.yaw),
      0,
    );
  }
  await flightControls(false);
  await page.evaluate(() => {
    window.g.state.colossal = {
      stage: 3,
      sector: { x: 0, y: 0 },
      x: 5000,
      y: 5000,
      angle: 0,
      slots: 1,
      ships: [],
      fuel: 100,
      warp: 10,
      aboard: window.g.state.activeShip.id,
    };
    window.g.colossalHelm = true;
  });
  await flightControls(true);
  await page.evaluate(() => {
    window.g.colossalHelm = false;
    delete window.g.state.colossal;
  });
  assert.equal(await walk.count(), 0);
  await page.evaluate(() => (window.g.state.mode = "surface"));
  await page.setViewportSize({ width: 844, height: 390 });
  await walk.waitFor();
  const landscape = await walk.boundingBox();
  assert.ok(
    landscape.x >= 0 &&
      landscape.y >= 0 &&
      landscape.x + landscape.width <= 844 &&
      landscape.y + landscape.height <= 390,
  );
  console.log(
    "PASS: portrait/landscape, hold/release, multitouch look, pause reset, normal/colossal acceleration and drag steering",
  );
} finally {
  await browser.close();
}
