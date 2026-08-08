interface Props {
  characterName?: string;
}

export default function TypingIndicator({ characterName }: Props) {
  return (
    <div className="flex justify-start gap-3 px-2 msg-enter">
      <div className="size-9 shrink-0 rounded-full bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] flex items-center justify-center text-sm font-bold text-[hsl(28_30%_10%)] ring-2 ring-[hsl(28_85%_62%/0.3)] shadow-lg shadow-[hsl(28_85%_62%/0.15)]">
        {(characterName || '?').charAt(0)}
      </div>
      <div className="max-w-[75%] space-y-1">
        {characterName && (
          <div className="text-xs text-white/40 pl-1">{characterName}</div>
        )}
        <div className="rounded-2xl rounded-tl-sm px-5 py-4 bg-[hsl(220_22%_13%/0.6)] border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full bg-[hsl(28_85%_62%/0.6)] typing-dot"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="inline-block size-2 rounded-full bg-[hsl(28_85%_62%/0.6)] typing-dot"
              style={{ animationDelay: '200ms' }}
            />
            <span
              className="inline-block size-2 rounded-full bg-[hsl(28_85%_62%/0.6)] typing-dot"
              style={{ animationDelay: '400ms' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
