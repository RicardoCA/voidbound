export const BLOCK_MINING_SECONDS = 3;
/** Progress belongs to one block and only survives while the input stays held. */
export class HeldMining {
  private key?: string;
  private elapsed = 0;
  reset() {
    this.key = undefined;
    this.elapsed = 0;
  }
  advance(key: string | undefined, held: boolean, dt: number, instant = false) {
    if (!key || !held || !Number.isFinite(dt) || dt < 0) {
      this.reset();
      return { progress: 0, complete: false };
    }
    if (key !== this.key) {
      this.key = key;
      this.elapsed = 0;
    }
    this.elapsed = instant
      ? BLOCK_MINING_SECONDS
      : Math.min(BLOCK_MINING_SECONDS, this.elapsed + dt);
    const complete = this.elapsed >= BLOCK_MINING_SECONDS - 1e-9;
    return {
      progress: complete ? 1 : this.elapsed / BLOCK_MINING_SECONDS,
      complete,
    };
  }
}
