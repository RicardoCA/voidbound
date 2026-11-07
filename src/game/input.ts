export const controls = {
  left: false,
  right: false,
  up: false,
  down: false,
  mine: false,
  fire: false,
  jump: false,
  interact: false,
};
export type Control = keyof typeof controls;
const pulses = new Set<Control>();
export function queuePulse(id: Control) {
  pulses.add(id);
}
export function pressControl(id: Control) {
  controls[id] = true;
  queuePulse(id);
}
export function takePulse(id: Control) {
  const pending = pulses.has(id);
  pulses.delete(id);
  return pending;
}
export function releaseControls() {
  for (const key of Object.keys(controls) as Control[]) controls[key] = false;
  pulses.clear();
}

export function isEditing(target: EventTarget | null) {
  return (
    typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    (target.isContentEditable || !!target.closest("input, textarea, select"))
  );
}

/** Retain a jump briefly so a press just before floor contact is not lost. */
export class JumpBuffer {
  private remaining = 0;
  constructor(private readonly duration = 0.12) {}
  take(requested: boolean, grounded: boolean, dt: number) {
    this.remaining = requested
      ? this.duration
      : Math.max(0, this.remaining - dt);
    if (grounded && this.remaining > 0) {
      this.remaining = 0;
      return true;
    }
    return false;
  }
  clear() {
    this.remaining = 0;
  }
}
