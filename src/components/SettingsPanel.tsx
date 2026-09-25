import React from 'react';
import { Maximize, Music, Volume2 } from 'lucide-react';
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen, onFullscreenChange } from '../lib/fullscreen';
import { useSettings } from '../store/settingsStore';

function Toggle({ label, icon, on, onChange }: { label: string; icon: React.ReactNode; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
    >
      <span className={on ? 'text-yellow-400' : 'text-gray-500'}>{icon}</span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      {/* Switch track + thumb */}
      <span
        className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-gray-600'}`}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  );
}

// Audio and display settings, shown in the pause menu. Choices are
// remembered on the device.
export default function SettingsPanel() {
  const { music, sfx, setMusic, setSfx, setFullscreen } = useSettings();
  // The switch shows the real state, since the player can also leave
  // fullscreen with the system back / swipe gesture or Esc.
  const [full, setFull] = React.useState(isFullscreen);
  React.useEffect(() => onFullscreenChange(() => setFull(isFullscreen())), []);
  return (
    <div className="w-56 rounded-xl border border-white/10 bg-gray-900/80 backdrop-blur-sm p-2">
      <div className="px-3 pt-1 pb-1.5 text-[10px] tracking-[0.2em] uppercase text-gray-400 text-left">Settings</div>
      <Toggle label="Music" icon={<Music size={18} />} on={music} onChange={setMusic} />
      <Toggle label="Sound effects" icon={<Volume2 size={18} />} on={sfx} onChange={setSfx} />
      {fullscreenSupported() && (
        <Toggle
          label="Full screen"
          icon={<Maximize size={18} />}
          on={full}
          onChange={(on) => {
            setFullscreen(on);
            if (on) enterFullscreen();
            else exitFullscreen();
          }}
        />
      )}
    </div>
  );
}
