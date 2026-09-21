import React from 'react';

interface JoystickProps {
  // Continuous horizontal input, -1 (full left) .. 1 (full right), 0 = centered.
  onMoveDir: (dir: number) => void;
  onJump: () => void;
  size?: number;
}

// A thumb joystick: tilt left/right to move (further = faster, fed into the
// physics loop), push up to jump. Reports a continuous direction and zeroes it
// on release so the fighter coasts to a stop.
export default function Joystick({ onMoveDir, onJump, size = 128 }: JoystickProps) {
  const baseRef = React.useRef<HTMLDivElement>(null);
  const [knob, setKnob] = React.useState({ x: 0, y: 0 });
  const [active, setActive] = React.useState(false);

  const dragging = React.useRef(false);
  const jumped = React.useRef(false);

  const knobMax = size * 0.32; // how far the knob can travel from center
  const dead = knobMax * 0.32; // deadzone before input registers

  const handle = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist > knobMax) {
      dx = (dx / dist) * knobMax;
      dy = (dy / dist) * knobMax;
    }
    setKnob({ x: dx, y: dy });

    // Up (dominant) = jump, once per push.
    if (dy < -dead && Math.abs(dy) >= Math.abs(dx)) {
      if (!jumped.current) {
        onJump();
        jumped.current = true;
      }
      onMoveDir(0);
      return;
    }
    jumped.current = false;

    const nx = dx / knobMax; // -1 .. 1
    onMoveDir(Math.abs(nx) > 0.22 ? Math.max(-1, Math.min(1, nx)) : 0);
  };

  const reset = () => {
    dragging.current = false;
    jumped.current = false;
    onMoveDir(0);
    setKnob({ x: 0, y: 0 });
    setActive(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    setActive(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    handle(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) handle(e.clientX, e.clientY);
  };

  // Stop moving if the joystick ever goes away mid-input.
  React.useEffect(() => () => onMoveDir(0), [onMoveDir]);

  return (
    <div
      ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={reset}
      onPointerCancel={reset}
      onLostPointerCapture={reset}
      className="relative rounded-full bg-gray-800/40 border border-white/10 backdrop-blur-sm touch-none select-none"
      style={{ width: size, height: size }}
      aria-label="Movement joystick"
    >
      {/* subtle directional hints */}
      <span className="absolute inset-x-0 top-1 text-center text-white/25 text-xs pointer-events-none">↑</span>
      <span className="absolute inset-y-0 left-1.5 flex items-center text-white/25 text-xs pointer-events-none">←</span>
      <span className="absolute inset-y-0 right-1.5 flex items-center text-white/25 text-xs pointer-events-none">→</span>
      <div
        className="absolute rounded-full bg-gray-200/90 shadow-lg shadow-black/40"
        style={{
          width: size * 0.46,
          height: size * 0.46,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          transition: active ? 'none' : 'transform 0.14s ease-out',
        }}
      />
    </div>
  );
}
