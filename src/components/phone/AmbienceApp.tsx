import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Flame, CloudRain, Wind, Sparkles } from 'lucide-react';

export default function AmbienceApp() {
  const [activeSound, setActiveSound] = useState<'fire' | 'rain' | 'wind' | null>(null);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodesRef = useRef<{ source?: AudioNode; gain?: GainNode; timer?: number } | null>(null);

  const startAmbience = (type: 'fire' | 'rain' | 'wind') => {
    stopAmbience();
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);

      // Pink/brown noise generation
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(soundVolume * 0.4, ctx.currentTime);

      if (type === 'fire') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, ctx.currentTime);
      } else if (type === 'rain') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, ctx.currentTime);
        filter.Q.setValueAtTime(1.2, ctx.currentTime);
      } else if (type === 'wind') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, ctx.currentTime);
      }

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      whiteNoise.start(0);

      soundNodesRef.current = { source: whiteNoise, gain: gainNode };
      setActiveSound(type);
    } catch {
      // Audio not supported
    }
  };

  const stopAmbience = () => {
    try {
      if (soundNodesRef.current?.source) {
        (soundNodesRef.current.source as any).stop?.();
      }
      if (soundNodesRef.current?.timer) {
        clearInterval(soundNodesRef.current.timer);
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    } catch {
      // ignore
    }
    soundNodesRef.current = null;
    audioCtxRef.current = null;
    setActiveSound(null);
  };

  useEffect(() => {
    if (soundNodesRef.current?.gain && audioCtxRef.current) {
      soundNodesRef.current.gain.gain.setValueAtTime(
        soundVolume * 0.4,
        audioCtxRef.current.currentTime
      );
    }
  }, [soundVolume]);

  useEffect(() => {
    return () => {
      stopAmbience();
    };
  }, []);

  return (
    <div className="space-y-4 text-xs text-white/90 pb-6 animate-in fade-in-0 duration-200">
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4">
        <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
          <Sparkles className="size-3.5 text-[hsl(28_85%_62%)]" />
          白噪音环境音效合成器 (Web Audio)
        </span>
        <p className="text-[10px] text-white/40 leading-relaxed">
          纯本地算法实时合成环境白噪音，搭配耳边私语与壁炉火光，营造极具沉浸感的深夜心境。
        </p>

        {/* Ambient Mode Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => (activeSound === 'fire' ? stopAmbience() : startAmbience('fire'))}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
              activeSound === 'fire'
                ? 'border-amber-500/80 bg-amber-500/15 text-amber-300 ring-2 ring-amber-500/30'
                : 'border-white/10 bg-black/40 hover:bg-white/5 text-white/70'
            }`}
          >
            <Flame className="size-5 text-amber-400 animate-pulse" />
            <span className="text-[11px] font-medium">壁炉篝火</span>
          </button>

          <button
            onClick={() => (activeSound === 'rain' ? stopAmbience() : startAmbience('rain'))}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
              activeSound === 'rain'
                ? 'border-cyan-500/80 bg-cyan-500/15 text-cyan-300 ring-2 ring-cyan-500/30'
                : 'border-white/10 bg-black/40 hover:bg-white/5 text-white/70'
            }`}
          >
            <CloudRain className="size-5 text-cyan-400" />
            <span className="text-[11px] font-medium">夜雨微澜</span>
          </button>

          <button
            onClick={() => (activeSound === 'wind' ? stopAmbience() : startAmbience('wind'))}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
              activeSound === 'wind'
                ? 'border-emerald-500/80 bg-emerald-500/15 text-emerald-300 ring-2 ring-emerald-500/30'
                : 'border-white/10 bg-black/40 hover:bg-white/5 text-white/70'
            }`}
          >
            <Wind className="size-5 text-emerald-400" />
            <span className="text-[11px] font-medium">林间清风</span>
          </button>
        </div>

        {/* Volume Slider */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-[10px] text-white/50">
            <span className="flex items-center gap-1">
              {soundVolume === 0 ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
              音量调节
            </span>
            <span>{Math.round(soundVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={soundVolume}
            onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
            className="w-full accent-[hsl(28_85%_62%)] h-1.5 bg-white/10 rounded-lg cursor-pointer"
          />
        </div>

        {activeSound && (
          <div className="flex justify-center pt-1">
            <button
              onClick={stopAmbience}
              className="text-[10px] text-red-400 hover:text-red-300 bg-red-400/10 border border-red-400/20 px-3 py-1 rounded-full transition-colors"
            >
              关闭环境音效
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
