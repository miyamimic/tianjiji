import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Flame, CloudRain, Wind, Sparkles } from 'lucide-react';
import { ambiencePlayer, type AmbienceType } from '../../lib/ambiencePlayer';

export default function AmbienceApp() {
  const [activeSound, setActiveSound] = useState<AmbienceType | null>(() => ambiencePlayer.getState().activeSound);
  const [soundVolume, setSoundVolume] = useState<number>(() => ambiencePlayer.getState().volume);

  useEffect(() => {
    const unsubscribe = ambiencePlayer.subscribe((state) => {
      setActiveSound(state.activeSound);
      setSoundVolume(state.volume);
    });
    return unsubscribe;
  }, []);

  const handleToggle = (type: AmbienceType) => {
    ambiencePlayer.toggle(type);
  };

  const handleVolumeChange = (v: number) => {
    setSoundVolume(v);
    ambiencePlayer.setVolume(v);
  };

  const handleStop = () => {
    ambiencePlayer.stop();
  };

  return (
    <div className="space-y-4 text-xs text-white/90 pb-6 animate-in fade-in-0 duration-200">
      <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4">
        <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
          <Sparkles className="size-3.5 text-[hsl(28_85%_62%)]" />
          白噪音环境音效合成器 (持久后台播放)
        </span>
        <p className="text-[10px] text-white/40 leading-relaxed">
          纯本地算法实时合成环境白噪音。开启后即使退出风铃手机也会在后台静默相伴，营造极具沉浸感的深夜心境。
        </p>

        {/* Ambient Mode Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleToggle('fire')}
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
            onClick={() => handleToggle('rain')}
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
            onClick={() => handleToggle('wind')}
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
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-full accent-[hsl(28_85%_62%)] h-1.5 bg-white/10 rounded-lg cursor-pointer"
          />
        </div>

        {activeSound && (
          <div className="flex justify-center pt-1">
            <button
              onClick={handleStop}
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
