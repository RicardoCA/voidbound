import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const names = [
  "refinaria-planetaria",
  "observatorio-planetario",
  "sonda-geologica",
  "coletor-climatico",
  "estacao-meteorologica",
  "laboratorio-amostras",
];
for (const name of names) {
  const bytes = readFileSync(
    new URL(`../public/models/equipamentos-base/${name}.glb`, import.meta.url),
  );
  assert.equal(bytes.toString("utf8", 0, 4), "glTF");
  const json = JSON.parse(
    bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)),
  );
  const primitives = json.meshes.flatMap((m) => m.primitives);
  const triangles = primitives.reduce(
    (n, p) => n + json.accessors[p.indices].count / 3,
    0,
  );
  assert.ok(json.meshes.length <= 12, `${name}: meshes`);
  assert.ok(
    triangles > 1000 && triangles < 40000,
    `${name}: triângulos ${triangles}`,
  );
  assert.ok(
    json.images.length >= 4 &&
      json.images.every((i) => i.bufferView !== undefined && !i.uri),
    `${name}: texturas incorporadas`,
  );
  assert.ok(
    primitives.every((p) => p.attributes.NORMAL !== undefined),
    `${name}: normais`,
  );
  console.log(
    name,
    `${json.meshes.length} meshes`,
    `${triangles} triângulos`,
    `${json.images.length} texturas`,
  );
}
