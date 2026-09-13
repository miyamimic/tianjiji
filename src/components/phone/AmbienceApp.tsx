import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Flame, CloudRain, Wind } from 'lucide-react';
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
    <div className="space-y-4 text-xs text-black font-sans select-none">
      <fieldset className="border border-t-[#808080] border-l-[#808080] border-b-white border-r-white p-3 pt-2 bg-[#c0c0c0] space-y-3.5">
        <legend className="px-1 text-black font-bold text-xs bg-[#c0c0c0] flex items-center gap-1.5">
          <span>环境音效合成器 (Ambience Synthesizer)</span>
        </legend>

        <p className="text-[11px] text-[#333] leading-relaxed">
          纯算法实时合成白噪音环境音。开启后将在后台持久静音相伴，无需额外消耗网络流量。
        </p>

        {/* Retro 3D Push Button Sound Selector */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => handleToggle('fire')}
            className={`p-3 flex flex-col items-center gap-1.5 cursor-pointer font-bold transition-none ${
              activeSound === 'fire'
                ? 'bg-[#a0a0a0] border-2 border-t-[#404040] border-l-[#404040] border-b-white border-r-white text-[#800000]'
                : 'bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] text-black hover:bg-[#d0d0d0]'
            }`}
          >
            <Flame className={`w-5 h-5 ${activeSound === 'fire' ? 'text-amber-700' : 'text-[#555]'}`} />
            <span className="text-xs">壁炉篝火</span>
            <span className="text-[9px] font-mono font-normal">
              {activeSound === 'fire' ? '[PLAYING]' : '[STOPPED]'}
            </span>
          </button>

          <button
            onClick={() => handleToggle('rain')}
            className={`p-3 flex flex-col items-center gap-1.5 cursor-pointer font-bold transition-none ${
              activeSound === 'rain'
                ? 'bg-[#a0a0a0] border-2 border-t-[#404040] border-l-[#404040] border-b-white border-r-white text-[#000080]'
                : 'bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] text-black hover:bg-[#d0d0d0]'
            }`}
          >
            <CloudRain className={`w-5 h-5 ${activeSound === 'rain' ? 'text-blue-700' : 'text-[#555]'}`} />
            <span className="text-xs">夜雨微澜</span>
            <span className="text-[9px] font-mono font-normal">
              {activeSound === 'rain' ? '[PLAYING]' : '[STOPPED]'}
            </span>
          </button>

          <button
            onClick={() => handleToggle('wind')}
            className={`p-3 flex flex-col items-center gap-1.5 cursor-pointer font-bold transition-none ${
              activeSound === 'wind'
                ? 'bg-[#a0a0a0] border-2 border-t-[#404040] border-l-[#404040] border-b-white border-r-white text-[#006000]'
                : 'bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] text-black hover:bg-[#d0d0d0]'
            }`}
          >
            <Wind className={`w-5 h-5 ${activeSound === 'wind' ? 'text-emerald-700' : 'text-[#555]'}`} />
            <span className="text-xs">林间清风</span>
            <span className="text-[9px] font-mono font-normal">
              {activeSound === 'wind' ? '[PLAYING]' : '[STOPPED]'}
            </span>
          </button>
        </div>

        {/* Volume Slider - Retro Windows Volume Control Style */}
        <div className="space-y-1.5 pt-2 border-t border-[#808080]">
          <div className="flex items-center justify-between text-xs text-black font-bold">
            <span className="flex items-center gap-1.5">
              {soundVolume === 0 ? <VolumeX className="w-4 h-4 text-red-600" /> : <Volume2 className="w-4 h-4 text-black" />}
              主音量调节 (Volume Level)
            </span>
            <span className="font-mono">{Math.round(soundVolume * 100)}%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#555]">MIN</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full h-3 bg-white border border-[#808080] appearance-none cursor-pointer accent-[#000080]"
            />
            <span className="text-[10px] text-[#555]">MAX</span>
          </div>
        </div>

        {/* Stop Button */}
        {activeSound && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleStop}
              className="px-4 py-1.5 bg-[#c0c0c0] text-red-700 border-2 border-t-white border-l-white border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-white active:border-r-white font-bold text-xs hover:bg-[#d0d0d0] cursor-pointer flex items-center gap-1"
            >
              <span>[X] 关闭所有环境音效</span>
            </button>
          </div>
        )}
      </fieldset>
    </div>
  );
}
