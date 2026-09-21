import React from 'react';
import { Move } from '../types/game';

interface JoystickProps {
  onMove: (move: Move) => void;
  size?: number;
}

// A thumb joystick that maps analog drag onto the game's discrete moves:
// hold left/right to step that way (repeats while held), push up to jump.
export default function Joystick({ onMove, size = 128 }: JoystickProps) {
  const baseRef = React.useRef<HTMLDivElement>(null);
  const [knob, setKnob] = React.useState({ x: 0, y: 0 });
  const [active, setActive] = React.useState(false);

  const dragging = React.useRef(false);
  const dir = React.useRef<'left' | 'right' | null>(null);
  const repeat = React.useRef<ReturnType<typeof setInterval>>();
  const jumped = React.useRef(false);

  const knobMax = size * 0.32; // how far the knob can travel from center
  const dead = knobMax * 0.4; // deadzone before a direction registers

  const stopRepeat = () => {
    if (repeat.current) {
      clearInterval(repeat.current);
      repeat.current = undefined;
    }
    dir.current = null;
  };

  const setDir = (next: 'left' | 'right' | null) => {
    if (next === dir.current) return;
    stopRepeat();
    dir.current = next;
    if (next) {
      onMove(next);
      repeat.current = setInterval(() => onMove(next), 110);
    }
  };

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
        onMove('jump');
        jumped.current = true;
      }
      setDir(null);
    } else {
      jumped.current = false;
      if (dx < -dead) setDir('left');
      else if (dx > dead) setDir('right');
      else setDir(null);
    }
  };

  const reset = () => {
    dragging.current = false;
    jumped.current = false;
    stopRepeat();
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

  React.useEffect(() => () => stopRepeat(), []);

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
