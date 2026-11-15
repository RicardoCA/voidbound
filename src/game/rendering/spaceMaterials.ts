import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { createNoise3D } from "simplex-noise";
import { random } from "../procedural/random";

export type SurfaceFinish = "metal" | "rock" | "planet" | "star" | "sky";

export function spaceTexture(finish: SurfaceFinish, seed = 17, biome = 0) {
  const canvas = document.createElement("canvas");
  const spherical = finish !== "metal";
  canvas.width = spherical ? 512 : 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const noise = createNoise3D(random(seed));
  const pixels = ctx.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    const lat = Math.PI * (y / canvas.height - 0.5);
    for (let x = 0; x < canvas.width; x++) {
      const lon = (2 * Math.PI * x) / canvas.width;
      const a = spherical ? Math.cos(lat) * Math.cos(lon) : x / 72;
      const b = spherical ? Math.sin(lat) : y / 72;
      const c = spherical ? Math.cos(lat) * Math.sin(lon) : 0;
      const broad = noise(a * 3, b * 3, c * 3);
      const grit = noise(a * 24, b * 24, c * 24);
      const fine = noise(a * 82, b * 82, c * 82);
      let tone = 150 + broad * 49 + grit * 37 + fine * 21;
      let rgb = [tone, tone, tone];
      switch (finish) {
        case "sky": {
          const dust = Math.max(0, broad * 0.8 + grit * 0.2) ** 2;
          rgb = [4 + dust * 40, 6 + dust * 25, 14 + dust * 82];
          break;
        }
        case "star":
          tone = 195 + grit * 37 + fine * 31;
          rgb = [255, tone, tone * 0.82];
          break;
        case "planet":
          if (biome === 0)
            tone -= 42 * Math.max(0, 1 - Math.abs(grit + 0.3) * 6);
          if (biome === 1) tone += 29 * Math.sin(b * 58 + broad * 4);
          if (biome === 2)
            tone += 50 * Math.abs(b) - 30 * (Math.abs(grit) < 0.08 ? 1 : 0);
          if (biome === 4)
            tone += Math.abs(grit + broad * 0.25) < 0.07 ? 83 : -35;
          rgb =
            biome === 3 || biome === 5
              ? broad + grit * 0.25 > 0.12
                ? [tone * 0.83, tone, tone * 0.66]
                : [tone * 0.5, tone * 0.73, tone]
              : [tone, tone, tone];
          break;
        case "rock":
          rgb = [tone, tone * 0.91, tone * 0.84];
          break;
        case "metal":
          tone = 181 + broad * 23 + grit * 12 + fine * 12;
          rgb = [tone, tone + 7, tone + 13];
          break;
      }
      const index = (y * canvas.width + x) * 4;
      pixels.data.set([...rgb, 255], index);
    }
  }
  ctx.putImageData(pixels, 0, 0);

  if (finish === "metal") {
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        const x = column * 64;
        const y = row * 64;
        ctx.fillStyle = "#202632";
        ctx.fillRect(x, y, 64, 2);
        ctx.fillRect(x, y, 2, 64);
        ctx.fillStyle = "#c7ced6";
        ctx.fillRect(x + 2, y + 2, 61, 1);
        ctx.fillRect(x + 2, y + 2, 1, 60);
        ctx.fillStyle = "#535e6f";
        for (const offset of [7, 54]) ctx.fillRect(x + offset, y + 7, 3, 3);
        if ((row + column) % 3 === 0) {
          ctx.fillStyle = "#b0783e";
          ctx.fillRect(x + 5, y + 43, 40, 5);
          ctx.fillStyle = "#303640";
          for (let vent = 0; vent < 5; vent++)
            ctx.fillRect(x + 8 + vent * 7, y + 26, 4, 11);
        }
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  if (finish === "metal") texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}
