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
  play(frequency = 220, duration = 0.07) {
    if (!this.enabled || this.volume <= 0) return;
    this.unlock();
    if (!context) return;
    try {
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.type = "square";
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
