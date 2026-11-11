let context: AudioContext | undefined;
export const audio = {
  enabled: true,
  volume: 1,
  unlock() {
    try {
      context ??= new AudioContext();
      if (context.state !== "running") {
        void context.resume().catch(() => {
          // A later user interaction can retry if playback is blocked.
        });
      }
    } catch {
      // Audio is optional on unsupported devices.
    }
  },
  playJump(duration: number) {
    if (!this.enabled || this.volume <= 0) return;
    this.unlock();
    if (!context) return;
    try {
      const start = context.currentTime;
      const reachLightSpeed = start + duration * 0.28;
      const cruise = start + duration * 0.68;
      const end = start + duration;
      const engine = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      engine.type = "sawtooth";
      engine.frequency.setValueAtTime(42, start);
      engine.frequency.exponentialRampToValueAtTime(190, reachLightSpeed);
      engine.frequency.linearRampToValueAtTime(210, cruise);
      engine.frequency.exponentialRampToValueAtTime(65, end);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(110, start);
      filter.frequency.exponentialRampToValueAtTime(940, reachLightSpeed);
      filter.frequency.exponentialRampToValueAtTime(160, end);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.095 * this.volume, reachLightSpeed);
      gain.gain.linearRampToValueAtTime(0.045 * this.volume, cruise);
      gain.gain.linearRampToValueAtTime(0, end);
      engine.connect(filter).connect(gain).connect(context.destination);
      engine.start(start);
      engine.stop(end);
      engine.onended = () => {
        engine.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    } catch {
      // Audio is optional on unsupported devices.
    }
  },
  play(frequency = 220, duration = 0.07, waveform: OscillatorType = "square") {
    if (!this.enabled || this.volume <= 0) return;
    this.unlock();
    if (!context) return;
    try {
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.type = waveform;
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      gain.gain.setValueAtTime(0.025 * this.volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001 * this.volume,
        context.currentTime + duration,
      );
      osc.connect(gain).connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch {
      /* Audio is optional on unsupported devices. */
    }
  },
};
