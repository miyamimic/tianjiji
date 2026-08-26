import { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

export default function MobileLiveWallpaperLoader({ onComplete }: Props) {
  const [stage, setStage] = useState<'enter' | 'active' | 'leave' | 'done'>('enter');

  useEffect(() => {
    // Stage timing: fade-in immediately, stay active, then smooth fade-out
    const tEnter = setTimeout(() => setStage('active'), 30);
    const tLeave = setTimeout(() => setStage('leave'), 2500);
    const tDone = setTimeout(() => {
      setStage('done');
      onComplete();
    }, 3100);

    return () => {
      clearTimeout(tEnter);
      clearTimeout(tLeave);
      clearTimeout(tDone);
    };
  }, [onComplete]);

  if (stage === 'done') return null;

  return (
    <div
      className={`fixed inset-0 z-50 w-screen h-screen overflow-hidden bg-black transition-opacity duration-700 ease-out select-none ${
        stage === 'leave' ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      aria-label="加载中..."
    >
      {/* Fullscreen Live Wallpaper */}
      <img
        src="/animations/loading_wallpaper.gif"
        alt="Live Wallpaper"
        className={`w-full h-full object-cover object-center select-none pointer-events-none transition-transform duration-1000 ease-out ${
          stage === 'enter' ? 'scale-105 opacity-80' : stage === 'active' ? 'scale-100 opacity-100' : 'scale-102 opacity-90'
        }`}
        loading="eager"
      />
    </div>
  );
}

