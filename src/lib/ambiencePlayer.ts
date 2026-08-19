// Organic Natural Procedural Acoustic Sound Synthesizer for High-Immersion White Noise

export type AmbienceType = 'fire' | 'rain' | 'wind';

export interface AmbienceState {
  activeSound: AmbienceType | null;
  volume: number;
}

const STORAGE_KEY_VOL = '__rp_engine_ambience_volume';
const STORAGE_KEY_ACTIVE = '__rp_engine_ambience_active';

class AmbiencePlayer {
  private activeSound: AmbienceType | null = null;
  private volume: number = 0.65;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Active audio nodes and timers for ongoing organic synthesis
  private activeNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];
  private timers: number[] = [];
  private listeners = new Set<(state: AmbienceState) => void>();

  constructor() {
    try {
      const savedVol = localStorage.getItem(STORAGE_KEY_VOL);
      if (savedVol !== null) {
        const v = parseFloat(savedVol);
        if (!isNaN(v)) {
          this.volume = Math.max(0, Math.min(1, v));
        }
      }
    } catch {
      // ignore
    }
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public getState(): AmbienceState {
    return {
      activeSound: this.activeSound,
      volume: this.volume,
    };
  }

  public subscribe(listener: (state: AmbienceState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem(STORAGE_KEY_VOL, String(this.volume));
    } catch {
      // ignore
    }

    if (this.masterGain && this.audioCtx) {
      try {
        this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      } catch {
        // ignore
      }
    }
    this.notify();
  }

  public toggle(type: AmbienceType) {
    if (this.activeSound === type) {
      this.stop();
    } else {
      this.start(type);
    }
  }

  public async start(type: AmbienceType) {
    this.stop();

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const master = ctx.createGain();
      master.gain.setValueAtTime(this.volume, ctx.currentTime);
      master.connect(ctx.destination);
      this.masterGain = master;

      if (type === 'fire') {
        this.setupNaturalFire(ctx, master);
      } else if (type === 'rain') {
        this.setupNaturalRain(ctx, master);
      } else if (type === 'wind') {
        this.setupNaturalWind(ctx, master);
      }

      this.activeSound = type;
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE, type);
      } catch {
        // ignore
      }
      this.notify();
    } catch (e) {
      console.warn('Ambience sound start error:', e);
    }
  }

  // -------------------------------------------------------------
  // Helper: Generate Pure Natural Pink / Brownian Noise Buffer
  // -------------------------------------------------------------
  private createBrownianNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brownian integration with smooth high-pass leak
      lastOut = (lastOut + 0.04 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    return buffer;
  }

  private createPinkNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Paul Kellet's refined filter for true organic pink spectrum
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  // -------------------------------------------------------------
  // 1. Natural Wood Fire Hearth (Warm Brownian Roar + Soft Organic Snaps)
  // -------------------------------------------------------------
  private setupNaturalFire(ctx: AudioContext, destination: AudioNode) {
    // 1) Warm Low Roar (Combustion bass)
    const brownBuffer = this.createBrownianNoiseBuffer(ctx, 4);
    const roarSource = ctx.createBufferSource();
    roarSource.buffer = brownBuffer;
    roarSource.loop = true;

    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.setValueAtTime(240, ctx.currentTime);

    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0.7, ctx.currentTime);

    roarSource.connect(lowFilter);
    lowFilter.connect(roarGain);
    roarGain.connect(destination);
    roarSource.start(0);

    // 2) Sizzling Mid Embers (Soft air hiss of burning wood)
    const pinkBuffer = this.createPinkNoiseBuffer(ctx, 4);
    const sizzleSource = ctx.createBufferSource();
    sizzleSource.buffer = pinkBuffer;
    sizzleSource.loop = true;

    const bandFilter = ctx.createBiquadFilter();
    bandFilter.type = 'bandpass';
    bandFilter.frequency.setValueAtTime(950, ctx.currentTime);
    bandFilter.Q.setValueAtTime(1.0, ctx.currentTime);

    const sizzleGain = ctx.createGain();
    sizzleGain.gain.setValueAtTime(0.28, ctx.currentTime);

    sizzleSource.connect(bandFilter);
    bandFilter.connect(sizzleGain);
    sizzleGain.connect(destination);
    sizzleSource.start(0);

    this.activeNodes.push({
      stop: () => {
        try { roarSource.stop(); } catch {}
        try { sizzleSource.stop(); } catch {}
      },
      disconnect: () => {
        roarSource.disconnect();
        lowFilter.disconnect();
        roarGain.disconnect();
        sizzleSource.disconnect();
        bandFilter.disconnect();
        sizzleGain.disconnect();
      }
    });

    // 3) Realistic Organic Wood Crackles (Noise bursts through resonant bandpass filters)
    const crackleInterval = window.setInterval(() => {
      if (this.activeSound !== 'fire' || !this.audioCtx || this.audioCtx.state !== 'running') return;
      try {
        const cCtx = this.audioCtx;
        const now = cCtx.currentTime;

        // 1 to 3 tiny pops
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const startTime = now + Math.random() * 0.12;
          const duration = 0.015 + Math.random() * 0.025; // 15~40ms crisp snap

          const snapBuffer = cCtx.createBuffer(1, Math.floor(cCtx.sampleRate * duration), cCtx.sampleRate);
          const data = snapBuffer.getChannelData(0);
          for (let s = 0; s < data.length; s++) {
            data[s] = (Math.random() * 2 - 1) * Math.exp(-s / (data.length * 0.3));
          }

          const snapSource = cCtx.createBufferSource();
          snapSource.buffer = snapBuffer;

          const snapFilter = cCtx.createBiquadFilter();
          snapFilter.type = 'bandpass';
          snapFilter.frequency.setValueAtTime(1800 + Math.random() * 3200, startTime);
          snapFilter.Q.setValueAtTime(3.0 + Math.random() * 2.0, startTime);

          const snapGain = cCtx.createGain();
          snapGain.gain.setValueAtTime(0.001, startTime);
          snapGain.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.3, startTime + 0.002);
          snapGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

          snapSource.connect(snapFilter);
          snapFilter.connect(snapGain);
          snapGain.connect(destination);

          snapSource.start(startTime);
          snapSource.stop(startTime + duration + 0.01);
        }
      } catch {}
    }, 140);

    this.timers.push(crackleInterval);
  }

  // -------------------------------------------------------------
  // 2. Natural Cozy Rain (Deep Atmospheric Rainfall + Soft Window Patter)
  // -------------------------------------------------------------
  private setupNaturalRain(ctx: AudioContext, destination: AudioNode) {
    const pinkBuffer = this.createPinkNoiseBuffer(ctx, 4);

    // 1) Main body of continuous rainfall
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = pinkBuffer;
    rainSource.loop = true;

    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.setValueAtTime(900, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.75, ctx.currentTime);

    rainSource.connect(lowFilter);
    lowFilter.connect(rainGain);
    rainGain.connect(destination);
    rainSource.start(0);

    // 2) Subtle high-frequency drizzle spray
    const drizzleSource = ctx.createBufferSource();
    drizzleSource.buffer = pinkBuffer;
    drizzleSource.loop = true;

    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'bandpass';
    highFilter.frequency.setValueAtTime(3200, ctx.currentTime);
    highFilter.Q.setValueAtTime(0.7, ctx.currentTime);

    const drizzleGain = ctx.createGain();
    drizzleGain.gain.setValueAtTime(0.22, ctx.currentTime);

    drizzleSource.connect(highFilter);
    highFilter.connect(drizzleGain);
    drizzleGain.connect(destination);
    drizzleSource.start(0);

    this.activeNodes.push({
      stop: () => {
        try { rainSource.stop(); } catch {}
        try { drizzleSource.stop(); } catch {}
      },
      disconnect: () => {
        rainSource.disconnect();
        lowFilter.disconnect();
        rainGain.disconnect();
        drizzleSource.disconnect();
        highFilter.disconnect();
        drizzleGain.disconnect();
      }
    });

    // 3) Soft organic raindrop taps on glass
    const dropInterval = window.setInterval(() => {
      if (this.activeSound !== 'rain' || !this.audioCtx || this.audioCtx.state !== 'running') return;
      try {
        const cCtx = this.audioCtx;
        const now = cCtx.currentTime;
        const startTime = now + Math.random() * 0.15;
        const dur = 0.02 + Math.random() * 0.03;

        const dropBuffer = cCtx.createBuffer(1, Math.floor(cCtx.sampleRate * dur), cCtx.sampleRate);
        const data = dropBuffer.getChannelData(0);
        for (let s = 0; s < data.length; s++) {
          data[s] = (Math.random() * 2 - 1) * Math.exp(-s / (data.length * 0.4));
        }

        const dropSource = cCtx.createBufferSource();
        dropSource.buffer = dropBuffer;

        const dropFilter = cCtx.createBiquadFilter();
        dropFilter.type = 'bandpass';
        dropFilter.frequency.setValueAtTime(1600 + Math.random() * 1200, startTime);
        dropFilter.Q.setValueAtTime(2.2, startTime);

        const dropGain = cCtx.createGain();
        dropGain.gain.setValueAtTime(0.001, startTime);
        dropGain.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.1, startTime + 0.004);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

        dropSource.connect(dropFilter);
        dropFilter.connect(dropGain);
        dropGain.connect(destination);

        dropSource.start(startTime);
        dropSource.stop(startTime + dur + 0.01);
      } catch {}
    }, 220);

    this.timers.push(dropInterval);
  }

  // -------------------------------------------------------------
  // 3. Natural Forest Wind (Organic Sweeping Breeze with Smooth Dual LFO)
  // -------------------------------------------------------------
  private setupNaturalWind(ctx: AudioContext, destination: AudioNode) {
    const pinkBuffer = this.createPinkNoiseBuffer(ctx, 4);

    const windSource = ctx.createBufferSource();
    windSource.buffer = pinkBuffer;
    windSource.loop = true;

    // Organic low-pass sweep
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(420, ctx.currentTime);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.65, ctx.currentTime);

    // Smooth Dual LFO for natural, unpredictable breeze swelling
    const lfo1 = ctx.createOscillator();
    lfo1.type = 'sine';
    lfo1.frequency.setValueAtTime(0.11, ctx.currentTime); // ~9 sec cycle
    const lfoGain1 = ctx.createGain();
    lfoGain1.gain.setValueAtTime(0.25, ctx.currentTime);

    const lfo2 = ctx.createOscillator();
    lfo2.type = 'sine';
    lfo2.frequency.setValueAtTime(0.06, ctx.currentTime); // ~16 sec cycle
    const lfoGain2 = ctx.createGain();
    lfoGain2.gain.setValueAtTime(140, ctx.currentTime); // frequency modulation

    lfo1.connect(lfoGain1);
    lfoGain1.connect(windGain.gain);

    lfo2.connect(lfoGain2);
    lfoGain2.connect(windFilter.frequency);

    lfo1.start(0);
    lfo2.start(0);

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(destination);
    windSource.start(0);

    this.activeNodes.push({
      stop: () => {
        try { windSource.stop(); } catch {}
        try { lfo1.stop(); } catch {}
        try { lfo2.stop(); } catch {}
      },
      disconnect: () => {
        windSource.disconnect();
        windFilter.disconnect();
        windGain.disconnect();
        lfo1.disconnect();
        lfoGain1.disconnect();
        lfo2.disconnect();
        lfoGain2.disconnect();
      }
    });
  }

  public stop() {
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];

    this.activeNodes.forEach((node) => {
      try { node.stop?.(); } catch {}
      try { node.disconnect?.(); } catch {}
    });
    this.activeNodes = [];

    if (this.masterGain) {
      try { this.masterGain.disconnect(); } catch {}
      this.masterGain = null;
    }

    this.activeSound = null;
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    } catch {
      // ignore
    }
    this.notify();
  }
}

export const ambiencePlayer = new AmbiencePlayer();
