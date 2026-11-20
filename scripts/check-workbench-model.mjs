import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const bytes = readFileSync(
  new URL(
    "../public/models/equipamentos-base/bancada-planetaria.glb",
    import.meta.url,
  ),
);
assert.equal(bytes.toString("utf8", 0, 4), "glTF");
const length = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + length));
assert.ok(gltf.meshes.length <= 12);
assert.ok(gltf.images.length > 3);
assert.ok(
  gltf.images.every((image) => image.bufferView !== undefined && !image.uri),
);
const triangles = gltf.meshes
  .flatMap((mesh) => mesh.primitives)
  .reduce((n, primitive) => n + gltf.accessors[primitive.indices].count / 3, 0);
assert.ok(triangles < 40_000);
console.log(
  `PASS bancada: ${gltf.meshes.length} meshes, ${gltf.images.length} texturas incorporadas, ${triangles} triângulos`,
);
