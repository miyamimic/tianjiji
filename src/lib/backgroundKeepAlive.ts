/**
 * iOS WebKit Background Keep-Alive & Audio Session Manager
 * 
 * iOS Safari / WebKit WebApp (Add to Home Screen / PWA) aggressively suspends JS execution
 * within 3-10 seconds when switching apps or locking the screen, which normally causes
 * `fetch` connections to drop with `TypeError: Load failed`.
 * 
 * This engine leverages:
 * 1. Web Audio API Silent Looping Buffer + Audio Session Keep-Alive:
 *    Keeps WebKit JS timer and network threads active in the background while generation is in flight.
 * 2. HTML5 Audio Element Heartbeat Fallback (tiny silent base64 WAV):
 *    Ensures iOS hardware audio session is active.
 * 3. Screen WakeLock API:
 *    Prevents screen dimming / sleeping while actively generating.
 * 4. Foreground / Visibility / PageShow / Online Event Auto-Synchronizer.
 */

class BackgroundKeepAliveEngine {
  private activeLocks = new Set<string>();
  private audioCtx: AudioContext | null = null;
  private silentSource: AudioBufferSourceNode | null = null;
  private silentAudioEl: HTMLAudioElement | null = null;
  private wakeLockSentinel: any = null;
  private isUnlocked = false;
  private listeners = new Set<(active: boolean, activeCount: number) => void>();

  constructor() {
    this.initUserGestureUnlock();
    this.initLifecycleListeners();
  }

  // Pre-unlock AudioContext on first user interaction so iOS permits background audio later
  private initUserGestureUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      if (this.isUnlocked) return;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          if (!this.audioCtx) {
            this.audioCtx = new AudioContextClass();
          }
          if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
          }
        }
        this.isUnlocked = true;
      } catch (e) {
        // ignore
      }
      window.removeEventListener('click', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };

    window.addEventListener('click', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  private initLifecycleListeners() {
    if (typeof window === 'undefined') return;

    // When returning from background, re-verify and re-acquire locks if generation is still active
    const handleReactivation = () => {
      if (this.activeLocks.size > 0) {
        this.startKeepAliveAudio();
        this.requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleReactivation();
      }
    });
    window.addEventListener('pageshow', handleReactivation);
    window.addEventListener('focus', handleReactivation);
    window.addEventListener('online', handleReactivation);
  }

  /**
   * Acquire a background keep-alive lease for a task (e.g. LLM generation)
   */
  public acquire(taskId: string, reason = 'generation'): void {
    this.activeLocks.add(taskId);
    this.startKeepAliveAudio();
    this.requestWakeLock();
    this.notify();
  }

  /**
   * Release background keep-alive lease when task completes or fails
   */
  public release(taskId: string): void {
    this.activeLocks.delete(taskId);
    if (this.activeLocks.size === 0) {
      this.stopKeepAliveAudio();
      this.releaseWakeLock();
    }
    this.notify();
  }

  public getActiveCount(): number {
    return this.activeLocks.size;
  }

  public isKeepAliveActive(): boolean {
    return this.activeLocks.size > 0;
  }

  public subscribe(fn: (active: boolean, activeCount: number) => void): () => void {
    this.listeners.add(fn);
    fn(this.isKeepAliveActive(), this.activeLocks.size);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const active = this.isKeepAliveActive();
    const count = this.activeLocks.size;
    this.listeners.forEach((fn) => {
      try {
        fn(active, count);
      } catch (err) {
        console.error('KeepAlive listener error', err);
      }
    });
  }

  private startKeepAliveAudio() {
    if (typeof window === 'undefined') return;

    // 1. Web Audio API silent looping buffer
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        if (!this.silentSource && this.audioCtx.state === 'running') {
          // 1 second silent stereo buffer
          const buffer = this.audioCtx.createBuffer(2, this.audioCtx.sampleRate, this.audioCtx.sampleRate);
          const source = this.audioCtx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          
          const gain = this.audioCtx.createGain();
          gain.gain.value = 0.0001; // Ultra near-zero gain, completely silent to human ear

          source.connect(gain);
          gain.connect(this.audioCtx.destination);
          source.start(0);
          this.silentSource = source;
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. HTML5 Audio Element Heartbeat Fallback (1-second silent WAV base64 loop)
    try {
      if (!this.silentAudioEl) {
        // Base64 of a minimal 1-second silent PCM WAV
        const silentWavBase64 =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP//AAD//w==';
        const audio = new Audio(silentWavBase64);
        audio.loop = true;
        audio.volume = 0.001;
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        this.silentAudioEl = audio;
      }
      this.silentAudioEl.play().catch(() => {
        // Autoplay may wait for user interaction, handled gracefully
      });
    } catch (e) {
      // ignore
    }
  }

  private stopKeepAliveAudio() {
    try {
      if (this.silentSource) {
        this.silentSource.stop();
        this.silentSource.disconnect();
        this.silentSource = null;
      }
    } catch (e) {
      // ignore
    }

    try {
      if (this.silentAudioEl) {
        this.silentAudioEl.pause();
      }
    } catch (e) {
      // ignore
    }
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
      try {
        if (!this.wakeLockSentinel) {
          this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          this.wakeLockSentinel.addEventListener('release', () => {
            this.wakeLockSentinel = null;
          });
        }
      } catch (e) {
        // WakeLock request can fail if battery is low or not allowed, ignore safely
      }
    }
  }

  private async releaseWakeLock() {
    try {
      if (this.wakeLockSentinel) {
        await this.wakeLockSentinel.release();
        this.wakeLockSentinel = null;
      }
    } catch (e) {
      // ignore
    }
  }
}

export const backgroundKeepAlive = new BackgroundKeepAliveEngine();
