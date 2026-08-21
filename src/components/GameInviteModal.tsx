import { 
  Sparkles, 
  Gamepad2, 
  X, 
  Play, 
  Clock, 
  Ban 
} from 'lucide-react';
import type { GameInvitation } from '../lib/gameStore';
import { loadCharAvatar } from '../lib/customStore';

interface Props {
  invite: GameInvitation | null;
  onStart: (invite: GameInvitation) => void;
  onReject: (invite: GameInvitation) => void;
  onLater: (invite: GameInvitation) => void;
}

export default function GameInviteModal({
  invite,
  onStart,
  onReject,
  onLater,
}: Props) {
  if (!invite) return null;

  const charAvatar = loadCharAvatar(invite.characterId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in-0 duration-200">
      {/* Click backdrop to treat as "稍后" */}
      <div className="absolute inset-0" onClick={() => onLater(invite)} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-[360px] rounded-3xl bg-gradient-to-b from-[hsl(222_30%_14%)] via-[hsl(222_35%_9%)] to-[hsl(222_40%_6%)] border border-amber-400/40 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(245,158,11,0.2)] space-y-4 z-10 animate-in zoom-in-95 duration-200 select-none">
        
        {/* Top Header Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400">
              <Gamepad2 className="size-4 animate-bounce" />
            </div>
            <span className="text-xs font-bold text-amber-300 tracking-wide uppercase">
              角色主动邀约
            </span>
          </div>

          <button
            onClick={() => onLater(invite)}
            className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition"
            title="稍后处理"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Character Card & Invitation Quote */}
        <div className="flex flex-col items-center text-center space-y-2.5 pt-1">
          {/* Avatar with glowing ring */}
          <div className="relative size-16 rounded-full overflow-hidden bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] flex items-center justify-center text-lg font-bold text-[hsl(28_30%_10%)] ring-4 ring-[hsl(28_85%_62%/0.4)] shadow-xl shadow-[hsl(28_85%_62%/0.25)]">
            {charAvatar ? (
              <img src={charAvatar} alt={invite.characterName} className="w-full h-full object-cover" />
            ) : (
              invite.characterName.charAt(0)
            )}
            <div className="absolute inset-0 ring-1 ring-white/30 rounded-full" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
              <span>{invite.characterName}</span>
              <Sparkles className="size-3.5 text-amber-400" />
            </h3>
            <p className="text-xs text-white/50">向你发起了一局「五子棋」对弈邀请</p>
          </div>

          {/* Invitation Speech Bubble */}
          <div className="w-full p-3 rounded-2xl bg-black/40 border border-white/10 text-xs text-amber-100/90 italic leading-relaxed text-left">
            {invite.inviteText || `“棋盘已经备妥，可有兴致同我下一盘五子棋？”`}
          </div>
        </div>

        {/* Action Buttons: 开始 / 拒绝 / 稍后 */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {/* 1. 拒绝 */}
          <button
            onClick={() => onReject(invite)}
            className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-2xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-xs font-semibold text-white/70 hover:text-red-200 transition active:scale-95 cursor-pointer"
          >
            <Ban className="size-3.5" />
            <span>拒绝</span>
          </button>

          {/* 2. 稍后 */}
          <button
            onClick={() => onLater(invite)}
            className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
          >
            <Clock className="size-3.5 text-blue-400" />
            <span>稍后</span>
          </button>

          {/* 3. 开始 */}
          <button
            onClick={() => onStart(invite)}
            className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-2xl bg-gradient-to-r from-[hsl(28_85%_62%)] to-[hsl(28_95%_55%)] hover:brightness-110 text-amber-950 font-bold text-xs shadow-lg shadow-[hsl(28_85%_62%/0.3)] transition active:scale-95 cursor-pointer"
          >
            <Play className="size-3.5 fill-current" />
            <span>开始</span>
          </button>
        </div>

        <p className="text-[10px] text-center text-white/40 pt-0.5">
          选择“稍后”可随时在左上角风铃手机的「对弈游戏」中赴约
        </p>
      </div>
    </div>
  );
}
