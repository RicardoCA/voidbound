let context: AudioContext | undefined;
export const audio = {
  enabled: true,
  play(frequency = 220, duration = 0.07) {
    if (!this.enabled) return;
    try {
      context ??= new AudioContext();
      void context.resume();
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      gain.gain.setValueAtTime(0.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
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
