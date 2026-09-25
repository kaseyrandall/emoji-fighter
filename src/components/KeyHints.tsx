// Keyboard controls, shown only on devices without touch (desktop): as a
// strip along the bottom of the arena and inside the pause menu.

const KEYS: { keys: string[]; label: string }[] = [
  { keys: ['A', 'D'], label: 'Move' },
  { keys: ['W'], label: 'Jump' },
  { keys: ['J'], label: 'Jab' },
  { keys: ['K'], label: 'Heavy' },
  { keys: ['L'], label: 'Special' },
  { keys: ['Space'], label: 'Pause' },
];

function Key({ k }: { k: string }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-md border border-white/25 bg-white/10
                 text-[10px] text-white shadow-[0_2px_0_rgba(255,255,255,0.18)] font-arcade"
    >
      {k}
    </kbd>
  );
}

export default function KeyHints({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 ${className}`}>
      {KEYS.map(({ keys, label }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          {keys.map((k) => <Key key={k} k={k} />)}
          <span className="text-[10px] text-gray-300 ml-0.5">{label}</span>
        </span>
      ))}
      <span className="text-[10px] text-gray-400">Hold away to block</span>
    </div>
  );
}
