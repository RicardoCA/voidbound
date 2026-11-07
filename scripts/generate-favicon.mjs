import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const publicDir = new URL("../public/", import.meta.url),
  svg = await readFile(new URL("favicon.svg", publicDir), "utf8");
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 180, height: 180 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`,
  );
  for (const [size, file] of [
    [32, "favicon-32x32.png"],
    [180, "apple-touch-icon.png"],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    const png = await page.screenshot({ omitBackground: true });
    await writeFile(new URL(file, publicDir), png);
    if (size === 32) {
      const header = Buffer.alloc(22);
      header.writeUInt16LE(1, 2);
      header.writeUInt16LE(1, 4);
      header[6] = 32;
      header[7] = 32;
      header.writeUInt16LE(1, 10);
      header.writeUInt16LE(32, 12);
      header.writeUInt32LE(png.length, 14);
      header.writeUInt32LE(22, 18);
      await writeFile(
        new URL("favicon.ico", publicDir),
        Buffer.concat([header, png]),
      );
    }
  }
} finally {
  await browser.close();
}
console.log("Favicons SVG, PNG, ICO e Apple Touch prontos.");
