import * as T from "three";

const SEGMENTS = 64;
const UP = new T.Vector3(0, 1, 0);

/** Reusable scanning fan and spherical sweep, driven only by the scan's progress. */
export class PlanetScanEffect {
  readonly group = new T.Group();
  private readonly fanGeometry = new T.BufferGeometry();
  private readonly bandGeometry = new T.BufferGeometry();
  private readonly patchGeometry = new T.BufferGeometry();
  private readonly coreGeometry = new T.CylinderGeometry(1, 1, 1, 6);
  private readonly fanMaterial = new T.MeshBasicMaterial({
    color: 0x66eddf,
    transparent: true,
    opacity: 0.09,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly lineMaterial = new T.LineBasicMaterial({
    color: 0x8dffed,
    transparent: true,
    opacity: 0.8,
    blending: T.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly coreMaterial = new T.MeshBasicMaterial({
    color: 0xbafff1,
    transparent: true,
    opacity: 0.65,
    blending: T.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly core = new T.Mesh(this.coreGeometry, this.coreMaterial);
  private readonly normal = new T.Vector3();
  private readonly right = new T.Vector3();
  private readonly vertical = new T.Vector3();
  private readonly point = new T.Vector3();
  private readonly direction = new T.Vector3();
  private readonly end = new T.Vector3();

  constructor() {
    this.group.name = "planet-scan-effect";
    this.group.visible = false;
    this.fanGeometry.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3),
    );
    const indices = [];
    for (let i = 0; i < SEGMENTS; i++)
      indices.push(0, i + 1, ((i + 1) % SEGMENTS) + 1);
    this.fanGeometry.setIndex(indices);
    this.bandGeometry.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(SEGMENTS * 3), 3),
    );
    this.patchGeometry.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(SEGMENTS * 3), 3),
    );
    this.group.add(
      new T.Mesh(this.fanGeometry, this.fanMaterial),
      this.core,
      new T.LineLoop(this.bandGeometry, this.lineMaterial),
      new T.LineLoop(this.patchGeometry, this.lineMaterial),
    );
    for (const object of this.group.children) object.frustumCulled = false;
  }

  hide() {
    this.group.visible = false;
  }

  update(
    origin: T.Vector3,
    center: T.Vector3,
    radius: number,
    progress: number,
  ) {
    if (!(radius > 0) || !Number.isFinite(progress)) {
      this.hide();
      return;
    }
    const p = T.MathUtils.clamp(progress, 0, 1);
    this.group.visible = true;
    this.normal.subVectors(origin, center).normalize();
    if (this.normal.lengthSq() < 0.01) this.normal.set(0, 0, 1);
    this.right
      .crossVectors(
        Math.abs(this.normal.y) > 0.95 ? new T.Vector3(1, 0, 0) : UP,
        this.normal,
      )
      .normalize();
    this.vertical.crossVectors(this.normal, this.right).normalize();
    const shell = radius * 1.018;
    const latitude = (0.72 - 1.44 * p) * shell;
    const sweepX = Math.sin(p * Math.PI * 8) * shell * 0.48;
    const patchRadius = shell * 0.065;
    const fan = this.fanGeometry.getAttribute("position") as T.BufferAttribute;
    const band = this.bandGeometry.getAttribute(
      "position",
    ) as T.BufferAttribute;
    const patch = this.patchGeometry.getAttribute(
      "position",
    ) as T.BufferAttribute;
    fan.setXYZ(0, origin.x, origin.y, origin.z);
    const surfacePoint = (x: number, y: number, out: T.Vector3) =>
      out
        .copy(center)
        .addScaledVector(this.right, x)
        .addScaledVector(this.vertical, y)
        .addScaledVector(
          this.normal,
          Math.sqrt(Math.max(0, shell * shell - x * x - y * y)),
        );
    surfacePoint(sweepX, latitude, this.end);
    const bandRadius = Math.sqrt(shell * shell - latitude * latitude);
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      surfacePoint(
        sweepX + Math.cos(angle) * patchRadius,
        latitude + Math.sin(angle) * patchRadius,
        this.point,
      );
      fan.setXYZ(i + 1, this.point.x, this.point.y, this.point.z);
      patch.setXYZ(i, this.point.x, this.point.y, this.point.z);
      this.point
        .copy(center)
        .addScaledVector(this.vertical, latitude)
        .addScaledVector(this.normal, Math.cos(angle) * bandRadius)
        .addScaledVector(this.right, Math.sin(angle) * bandRadius);
      band.setXYZ(i, this.point.x, this.point.y, this.point.z);
    }
    for (const attribute of [fan, band, patch]) attribute.needsUpdate = true;
    this.direction.subVectors(this.end, origin);
    const length = this.direction.length();
    this.core.position.copy(origin).lerp(this.end, 0.5);
    this.core.quaternion.setFromUnitVectors(UP, this.direction.normalize());
    this.core.scale.set(0.65, length, 0.65);
    this.fanMaterial.opacity = 0.075 + Math.sin(p * Math.PI * 36) ** 2 * 0.045;
  }

  dispose() {
    this.group.removeFromParent();
    for (const geometry of [
      this.fanGeometry,
      this.bandGeometry,
      this.patchGeometry,
      this.coreGeometry,
    ])
      geometry.dispose();
    for (const material of [
      this.fanMaterial,
      this.lineMaterial,
      this.coreMaterial,
    ])
      material.dispose();
  }
}
