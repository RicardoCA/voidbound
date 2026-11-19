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
export const touchSteering = { target: 0, turn: 0 };

export function setTouchSteering(axis: number) {
  const magnitude = Math.max(0, (Math.min(1, Math.abs(axis)) - .2) / .8);
  touchSteering.target = Math.sign(axis) * magnitude ** 1.7;
}

export function flightSteering(keyboard: number, dt: number, response = 1) {
  if (keyboard) {
    touchSteering.turn = 0;
    return keyboard;
  }
  const blend = 1 - Math.exp(-dt * response * (touchSteering.target ? 9 : 15));
  touchSteering.turn += (touchSteering.target - touchSteering.turn) * blend;
  if (!touchSteering.target && Math.abs(touchSteering.turn) < .005)
    touchSteering.turn = 0;
  return touchSteering.turn;
}

/** Drag changes heading, with a capped, smoothed turn instead of a sudden spin. */
export const touchFlightLook = { yaw: 0, pitch: 0 };
export function dragFlightLook(dx: number, dy: number) {
  touchFlightLook.yaw = Math.max(-1.2, Math.min(1.2, touchFlightLook.yaw + dx * .004));
  touchFlightLook.pitch = Math.max(-.8, Math.min(.8, touchFlightLook.pitch - dy * .004));
}
export function stepFlightLook(dt: number, response = 1) {
  const blend = 1 - Math.exp(-Math.max(0, dt) * 12 * response);
  const yaw = Math.max(-dt * 1.3 * response, Math.min(dt * 1.3 * response, touchFlightLook.yaw * blend));
  const pitch = Math.max(-dt * response, Math.min(dt * response, touchFlightLook.pitch * blend));
  touchFlightLook.yaw -= yaw;
  touchFlightLook.pitch -= pitch;
  return { yaw, pitch };
}
export function clearFlightLook() { touchFlightLook.yaw = touchFlightLook.pitch = 0; }

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
  clearFlightLook();
  touchSteering.target = touchSteering.turn = 0;
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
