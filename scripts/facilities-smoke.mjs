import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
await mkdir("/tmp/voidbound-facilities-qa", { recursive: true });
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
      g.state.settlements[g.planet.id] = {
        pieces: {
          "0,28": { kind: "planetRefinery", facing: 1 },
          "4,28": { kind: "battery", facing: 1, energy: 500 },
        },
        walls: {},
        cabinets: {},
        cutTrees: [],
        utilityTime: 0,
      };
      g.state.backpack = { iron: 6 };
      b.interactAt(0, 28);
    });
    await page
      .getByRole("heading", { name: "Refinaria planetária", exact: true })
      .waitFor();
    await page
      .locator(".transfer-column")
      .first()
      .getByRole("button", { name: /Ferro, 6 unidades/ })
      .click();
    await page.getByRole("button", { name: "→ Todos", exact: true }).click();
    await page.getByLabel("Operações").fill("2");
    await page
      .getByRole("button", { name: "Adicionar à fila", exact: true })
      .click();
    assert.equal(
      await page.evaluate(() => b.facility.machine.queue[0].remaining),
      2,
    );
    await page.screenshot({
      path: `/tmp/voidbound-facilities-qa/refinery-${mobile ? "mobile" : "desktop"}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.evaluate(() => {
      g.panel = "";
      for (let i = 0; i < 24; i++) g.tick(1);
      b.interactAt(0, 28);
    });
    await page.getByRole("button", { name: "Saída", exact: true }).click();
    await page
      .getByRole("button", { name: "← Retirar tudo", exact: true })
      .click();
    assert.equal(await page.evaluate(() => g.state.backpack.plate), 2);
    for (const [kind, name] of [
      ["observatory", "Observatório planetário"],
      ["geoProbe", "Sonda geológica"],
      ["climateCollector", "Coletor climático"],
      ["weatherStation", "Estação meteorológica"],
      ["sampleLab", "Laboratório de amostras"],
    ]) {
      await page.evaluate((kind) => {
        g.panel = "";
        g.state.settlements[g.planet.id].pieces["0,28"].kind = kind;
        delete g.state.settlements[g.planet.id].machines;
        g.worldChanged();
        b.interactAt(0, 28);
      }, kind);
      await page.getByRole("heading", { name, exact: true }).waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "Instalações PC/mobile: seis painéis, depósito, fila, produção, retirada e responsividade OK.",
  );
  // Render the actual Blender GLBs together with Three.js, independent of the game loop.
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
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
    renderer.setSize(1600, 1100);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x101c29);
    document.body.append(renderer.domElement);
    const scene = new T.Scene();
    const loader = new GLTFLoader();
    const names = [
      "refinaria-planetaria",
      "observatorio-planetario",
      "sonda-geologica",
      "coletor-climatico",
      "estacao-meteorologica",
      "laboratorio-amostras",
    ];
    for (let i = 0; i < names.length; i++) {
      const { scene: model } = await loader.loadAsync(
        `/models/equipamentos-base/${names[i]}.glb`,
      );
      model.position.set(((i % 3) - 1) * 3.6, 0, Math.floor(i / 3) * 3.2);
      scene.add(model);
    }
    scene.add(new T.HemisphereLight(0xcfe7ff, 0x334255, 2.5));
    const sun = new T.DirectionalLight(0xffe1bb, 3);
    sun.position.set(3, 8, 5);
    scene.add(sun);
    const camera = new T.PerspectiveCamera(39, 1600 / 1100, 0.1, 100);
    camera.position.set(7, 8, 12);
    camera.lookAt(0, 0.8, 1.4);
    renderer.render(scene, camera);
  });
  await page.screenshot({
    path: "assets/blender/instalacoes-cientificas-previa.png",
  });
  console.log("Prévia dos seis modelos Blender renderizada.");
} finally {
  await browser.close();
}
