import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const out = "/tmp/voidbound-commerce-qa";
await mkdir(out, { recursive: true });
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
    // Interface/transactions run isolated from the graphical loop; actual models are rendered below.
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 1;
    });
    await page.goto(process.env.VOIDBOUND_URL || "http://127.0.0.1:4173/");
    await page.waitForFunction(
      () => document.querySelector("#app")?.__vue_app__,
    );
    await page.evaluate(() => {
      const provides =
        document.querySelector("#app").__vue_app__._context.provides;
      const pinia =
        provides[
          Reflect.ownKeys(provides).find((k) => String(k) === "Symbol(pinia)")
        ];
      window.g = pinia._s.get("game");
      window.b = pinia._s.get("construction");
      g.newGame("VOIDBOUND");
      g.state.mode = "surface";
      g.state.player.x = 16;
      g.state.player.y = 440;
      g.state.player.surfaceZ = 0;
      g.state.credits = 100000;
      g.state.settlements[g.planet.id] = {
        pieces: {
          "0,28": { kind: "tradingPost", facing: 1 },
          "4,28": { kind: "battery", facing: 1, energy: 1200 },
        },
        walls: {},
        cabinets: {},
        cutTrees: [],
        utilityTime: g.state.time,
      };
      const cuts = g.state.settlements[g.planet.id].cutTrees;
      for (let x = -14; x <= 14; x++)
        for (let z = -14; z <= 14; z++) cuts.push(`grove:${x}:${z}`);
      for (let x = -10; x <= 10; x++) cuts.push(`tree:${x}`);
      g.state.backpack = { iron: 10 };
      b.interactAt(0, 28);
    });
    await page
      .getByRole("heading", { name: "Entreposto comercial", exact: true })
      .waitFor();
    await page
      .locator(".sale-items label")
      .filter({ hasText: "Ferro" })
      .getByRole("checkbox")
      .check();
    await page
      .locator(".transfer-column")
      .first()
      .getByRole("button", { name: /Ferro, 10 unidades/ })
      .click();
    await page.getByRole("button", { name: "→ Todos", exact: true }).click();
    await page.screenshot({
      path: `${out}/trade-${mobile ? "mobile" : "desktop"}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const result = await page.evaluate(() => {
      g.panel = "";
      for (let i = 0; i < 193; i++) {
        g.state.activePlayTime = (g.state.activePlayTime ?? 0) + 1;
        g.tick(1);
      }
      const m = g.state.settlements[g.planet.id].machines["0,28"];
      return {
        phase: m.trade.visitor?.phase,
        credits: g.state.credits,
        input: m.input,
        visitor: m.trade.visitor,
      };
    });
    assert.equal(result.phase, "landed");
    assert.equal(result.credits, 100090);
    assert.equal(result.input.iron, undefined);
    await page.evaluate(() => {
      const v = g.state.settlements[g.planet.id].machines["0,28"].trade.visitor;
      g.state.player.x = v.x;
      g.state.player.y = v.y - 12;
      g.state.player.surfaceZ = v.z + 110;
      if (!b.openCargoVisitor()) throw Error("Cargueiro não interagível");
    });
    await page
      .getByRole("button", { name: "Comprar cargueiro", exact: true })
      .click();
    assert.equal(await page.evaluate(() => g.state.parkedShips.length), 1);
    assert.ok(await page.evaluate(() => g.state.credits < 100090));
    await page.evaluate(() => {
      g.newGame("VOIDBOUND");
      g.state.planetIndex = 1;
      g.state.mode = "surface";
      g.state.player.x = 16;
      g.state.player.y = 440;
      g.state.player.surfaceZ = 0;
      g.state.settlements[g.planet.id] = {
        pieces: {
          "0,28": { kind: "communicationsPost", facing: 1 },
          "4,28": { kind: "battery", facing: 1, energy: 1200 },
        },
        walls: {},
        cabinets: {},
        cutTrees: [],
        utilityTime: g.state.time,
      };
      g.state.backpack = { iron: 12, copper: 6 };
      g.tick(1);
      b.interactAt(0, 28);
    });
    await page
      .getByRole("heading", {
        name: "Posto de atendimento e comunicações",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Aceitar pedido", exact: true })
      .click();
    await page.screenshot({
      path: `${out}/communications-${mobile ? "mobile" : "desktop"}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page
      .getByRole("button", { name: "Entregar suprimentos", exact: true })
      .click();
    assert.ok(await page.evaluate(() => g.state.credits > 500));
    assert.equal(
      await page.evaluate(() => g.state.governments[g.planet.id].aid[0]),
      "supplies",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Entregar suprimentos", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "Entreposto e comunicações: PC/celular, depósito, autorização, chegada, venda, compra e entrega ao conselho OK.",
  );
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
  });
  await page.goto(process.env.VOIDBOUND_URL || "http://127.0.0.1:4173/");
  await page.evaluate(async () => {
    window.requestAnimationFrame = () => 1;
    const T = await import("/node_modules/.vite/deps/three.js");
    const { GLTFLoader } =
      await import("/node_modules/.vite/deps/three_addons_loaders_GLTFLoader__js.js");
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    const renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(1400, 900);
    renderer.setClearColor(0x101c29);
    document.body.append(renderer.domElement);
    const scene = new T.Scene(),
      loader = new GLTFLoader();
    for (const [i, name] of [
      "entreposto-comercial",
      "posto-comunicacoes",
    ].entries()) {
      const { scene: model } = await loader.loadAsync(
        `/models/equipamentos-base/${name}.glb`,
      );
      model.position.x = (i - 0.5) * 3.6;
      scene.add(model);
    }
    scene.add(new T.HemisphereLight(0xcfe7ff, 0x334255, 2.5));
    const light = new T.DirectionalLight(0xffe1bb, 3);
    light.position.set(3, 8, 5);
    scene.add(light);
    const camera = new T.PerspectiveCamera(39, 1400 / 900, 0.1, 100);
    camera.position.set(5, 6, 10);
    camera.lookAt(0, 1, 0);
    renderer.render(scene, camera);
  });
  await page.screenshot({
    path: "assets/blender/comercio-planetario-previa.png",
  });
  console.log("Prévia real dos dois GLBs renderizada.");
  await page.evaluate(async () => {
    const { Space3D } = await import("/src/game/rendering/Space3D.ts");
    const moduleText = await (
      await fetch("/src/game/rendering/Space3D.ts")
    ).text();
    const flightImport = moduleText.match(
      /from "([^"\n]*flight3D\.ts[^"\n]*)"/,
    )[1];
    const { flight3D } = await import(flightImport);
    const { Terrain } = await import("/src/game/procedural/terrain.ts");
    const { systemAt } = await import("/src/universe/generator.ts");
    const { emptySettlement } = await import("/src/construction/building.ts");
    document.body.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:1400px;height:900px;display:block";
    document.body.append(canvas);
    const planet = systemAt("VOIDBOUND", 0, 0).planets[0];
    const terrain = new Terrain(planet, {}),
      settlement = emptySettlement();
    const y = terrain.height(0) * 16;
    for (let x = -20; x <= 20; x++)
      for (let z = -20; z <= 20; z++)
        settlement.cutTrees.push(`grove:${x}:${z}`);
    for (let x = -15; x <= 15; x++) settlement.cutTrees.push(`tree:${x}`);
    settlement.pieces["0,28"] = { kind: "tradingPost", facing: 1 };
    settlement.machines = {
      "0,28": {
        input: {},
        output: {},
        queue: [],
        trade: {
          enabled: {},
          wait: 0,
          serial: 1,
          history: [],
          visitor: {
            id: "render-visit",
            model: "atlas",
            phase: "landed",
            elapsed: 0,
            x: 0,
            y,
            z: 0,
            traded: true,
          },
        },
      },
    };
    const g = {
      state: {
        activeShip: { model: "sparrow" },
        landingX: 48,
        settlements: { [planet.id]: settlement },
      },
      planet,
    };
    flight3D.surface = {
      terrain,
      settlement,
      camera: { x: 0, y: y - 80, z: 100, yaw: 0, pitch: -0.5 },
      revision: 0,
      light: 1,
      elapsed: 0,
      gameTime: 0,
      sunPhase: 0.5,
      facing: 1,
      stride: 0,
      animals: [],
      fruit: [],
      drops: [],
    };
    window.qaSpace = new Space3D(canvas);
    window.qaGame = g;
    qaSpace.drawSurfaceExploration(g);
    await Promise.all([...qaSpace.environmentAssets.values()]);
    qaSpace.drawSurfaceExploration(g);
    if (!qaSpace.cargoModels.has("render-visit"))
      throw Error(
        "Cargueiro não foi incluído: " +
          JSON.stringify({
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            frame: !!flight3D.surface,
            planet: planet.id,
            exploration: !!qaSpace.exploration,
            keys: [...qaSpace.cargoModels.keys()],
          }),
      );
  });
  await page.screenshot({ path: `${out}/cargo-landed.png` });
  await page.evaluate(() => {
    const visit =
      qaGame.state.settlements[qaGame.planet.id].machines["0,28"].trade.visitor;
    visit.phase = "arriving";
    visit.elapsed = 7;
    qaSpace.drawSurfaceExploration(qaGame);
  });
  await page.screenshot({ path: `${out}/cargo-arriving.png` });
  console.log(
    "Cargueiro Blender renderizado na cena real da superfície, pousado e em aproximação.",
  );
} finally {
  await browser.close();
}
