import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { clothing, type Outfit } from "../../wardrobe/clothing";
import { items } from "../types";
import type { SurfaceFrame } from "./SurfaceWorld3D";

export class SurfaceHeldTool {
  readonly grip = new T.Group();
  readonly muzzle = new T.Object3D();
  private readonly scene = new T.Scene();
  private readonly camera = new T.PerspectiveCamera();
  private readonly pistol = new T.Group();
  private readonly box = new RoundedBoxGeometry(1, 1, 1, 2, .16);
  private readonly cylinder = new T.CylinderGeometry(.5, .5, 1, 12);
  private readonly bucketBody = new T.CylinderGeometry(.81, .62, 1.3, 16, 1, true);
  private readonly bucketHandle = new T.TorusGeometry(.77, .065, 6, 16, Math.PI);
  private readonly sleeve = new T.MeshStandardMaterial({ roughness: .85 });
  private readonly armor = new T.MeshStandardMaterial({ roughness: .55 });
  private readonly rubber = new T.MeshStandardMaterial({ color: 0x252c37, roughness: .8 });
  private readonly shell = new T.MeshStandardMaterial({ color: 0xa0b9be, roughness: .43, metalness: .2 });
  private readonly bucketMetal = new T.MeshStandardMaterial({
    color: 0x849eaa, metalness: .28, roughness: .38, side: T.DoubleSide,
  });
  private readonly safety = new T.MeshStandardMaterial({ color: 0xe29b39, roughness: .49 });
  private readonly lens = new T.MeshStandardMaterial({
    color: 0x227e8e, emissive: 0x44e5ff, emissiveIntensity: .65, roughness: .34,
  });
  private readonly blockMaterial = new T.MeshStandardMaterial({ roughness: .94 });
  private readonly block = new T.Mesh(this.box, this.blockMaterial);
  private readonly bucket = new T.Group();
  private readonly fill = new T.HemisphereLight(0xdaf0ff, 0x556075, 1.5);

  constructor() {
    this.scene.add(this.grip, this.fill);
    const key = new T.DirectionalLight(0xffead7, 2);
    key.position.set(-4, 7, 2);
    this.scene.add(key);

    const hand = new T.Group();
    this.grip.add(hand, this.pistol, this.block, this.bucket);
    this.block.position.set(-.38, .57, -.45);
    this.block.scale.setScalar(1.93);
    this.block.rotation.set(.12, .22, -.08);
    this.part(this.bucket, this.bucketBody, this.bucketMetal, [-.76, -.88, -.38], [1, 1, 1]);
    this.part(this.bucket, this.cylinder, this.bucketMetal, [-.76, -1.51, -.38], [1.25, .11, 1.25]);
    this.part(this.bucket, this.bucketHandle, this.bucketMetal, [-.76, -.24, -.38], [1, 1, 1]);
    this.part(hand, this.box, this.rubber, [.60, -.04, .32], [.85, 1.72, 1.07]).rotation.z = -.13;
    this.part(hand, this.box, this.armor, [.78, .05, .77], [.56, 1.09, .26]).rotation.z = -.12;
    for (let finger = 0; finger < 4; finger++) {
      const y = .56 - finger * .34;
      const width = 1.38 - finger * .09;
      this.part(hand, this.box, this.rubber, [.015 + finger * .025, y, .66],
        [width, .31, .43]).rotation.z = -.10;
      this.part(hand, this.box, this.armor, [.27, y, .87], [.42, .23, .10]).rotation.z = -.10;
      this.part(hand, this.box, this.rubber, [-width / 2 + .11, y + .05, .45],
        [.27, .29, .45]).rotation.y = .24;
    }
    this.part(hand, this.box, this.rubber, [.38, .77, .05], [.44, 1.02, .48]).rotation.z = -.64;
    this.part(hand, this.box, this.armor, [1.01, -.83, .57], [1.28, .60, 1.26]).rotation.z = .62;
    this.part(hand, this.box, this.rubber, [1.21, -1.15, .77], [1.36, .44, 1.34]).rotation.z = .62;

    const wrist = new T.Vector3(1.22, -1.13, .75);
    const forearm = new T.Vector3(5.8, -9.2, 6.1);
    const direction = forearm.clone().sub(wrist);
    const center = wrist.clone().lerp(forearm, .5);
    const arm = this.part(hand, this.box, this.sleeve, [center.x, center.y, center.z],
      [1.71, direction.length(), 1.59]);
    arm.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
    const bracer = this.part(hand, this.box, this.armor, [2.14, -2.67, 2.12], [1.58, 2.85, .48]);
    bracer.quaternion.copy(arm.quaternion);

    this.part(this.pistol, this.box, this.rubber, [0, .06, 0], [1.06, 2.14, .98]).rotation.x = -.12;
    this.part(this.pistol, this.box, this.rubber, [0, 1.39, -1.27], [1.32, .73, 3.33]);
    this.part(this.pistol, this.box, this.shell, [0, 2.04, -1.64], [1.79, 1.16, 3.8]);
    this.part(this.pistol, this.box, this.rubber, [0, 2.62, -1.18], [1.23, .34, 1.57]);
    this.part(this.pistol, this.box, this.lens, [0, 2.81, -1.10], [.75, .10, .87]);
    this.part(this.pistol, this.box, this.safety, [0, 2.06, -3.47], [1.9, 1.22, .57]);
    for (const side of [-1, 1]) {
      this.part(this.pistol, this.box, this.rubber, [side * .84, 2.04, -1.72], [.23, .61, 2.48]);
      for (let vent = 0; vent < 3; vent++)
        this.part(this.pistol, this.box, this.lens, [side * .97, 2.04, -2.42 + vent * .37], [.07, .26, .13]);
    }
    this.part(this.pistol, this.cylinder, this.rubber, [0, 2.04, -3.89], [1.28, .7, 1.28]).rotation.x = Math.PI / 2;
    this.part(this.pistol, this.cylinder, this.lens, [0, 2.04, -4.25], [.82, .12, .82]).rotation.x = Math.PI / 2;
    this.part(this.pistol, this.cylinder, this.rubber, [0, 2.04, -4.32], [.37, .045, .37]).rotation.x = Math.PI / 2;
    this.muzzle.position.set(0, 2.04, -4.36);
    this.pistol.add(this.muzzle);
  }

  private part(group: T.Group, geometry: T.BufferGeometry, material: T.Material,
    [x, y, z]: [number, number, number], [width, height, depth]: [number, number, number]) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    group.add(mesh);
    return mesh;
  }

  update(camera: T.PerspectiveCamera, frame: SurfaceFrame, outfit: Outfit | undefined, saber: boolean) {
    this.camera.projectionMatrix.copy(camera.projectionMatrix);
    this.camera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    const shirt = outfit?.shirt ? clothing[outfit.shirt] : undefined;
    this.sleeve.color.set(shirt?.color ?? 0x9daeb3);
    this.armor.color.set(shirt?.trim ?? 0x516878);
    this.fill.intensity = .80 + frame.light * .85;
    const material = frame.heldMaterial;
    this.pistol.visible = !saber && !frame.building && !frame.bucketEquipped;
    this.bucket.visible = !!frame.bucketEquipped;
    this.block.visible = !!material;
    if (material) this.blockMaterial.color.set(items[material].color);
    this.lens.emissiveIntensity = frame.beam ? 2.2 : .65;
    const step = Math.sin(frame.stride);
    const right = Math.min(7, 8.5 * camera.aspect);
    this.grip.position.set(right + step * .28, -6.55 + (1 - Math.cos(frame.stride * 2)) * .12, -18);
    const raised = saber || !!material || !!frame.bucketEquipped;
    this.grip.rotation.set(raised ? -.07 : .25, raised ? -.10 : .28,
      raised ? (frame.beam && saber ? .70 : .21) : -.12);
    if (this.pistol.visible && frame.beam) this.grip.position.z += .35;
  }

  render(renderer: T.WebGLRenderer) {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      renderer.clearDepth();
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.autoClear = autoClear;
    }
  }

  dispose() {
    this.box.dispose();
    this.cylinder.dispose();
    this.bucketBody.dispose();
    this.bucketHandle.dispose();
    for (const material of [this.sleeve, this.armor, this.rubber, this.shell, this.safety, this.lens, this.blockMaterial, this.bucketMetal])
      material.dispose();
  }
}
