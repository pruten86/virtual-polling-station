import React, { useRef, useState, useCallback, useEffect } from 'react';

interface VirtualJoystickProps {
  onMove: (vector: { x: number; y: number }) => void;
  onStop: () => void;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onMove, onStop }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  const radius = 50; // max knob drag distance

  const updateVector = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance > radius) {
        dx = (dx / distance) * radius;
        dy = (dy / distance) * radius;
      }

      setKnobPos({ x: dx, y: dy });

      // Normalized output (-1 to 1)
      const normX = dx / radius;
      const normY = dy / radius;
      onMove({ x: normX, y: normY });
    },
    [onMove, radius]
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsActive(true);
    updateVector(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (touchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateVector(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setIsActive(false);
        setKnobPos({ x: 0, y: 0 });
        onStop();
        break;
      }
    }
  };

  // Reset when unmounting
  useEffect(() => {
    return () => {
      onStop();
    };
  }, [onStop]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`relative w-28 h-28 rounded-full border-2 transition-all flex items-center justify-center select-none touch-none ${
        isActive
          ? 'bg-slate-900/80 border-sky-400 shadow-lg shadow-sky-500/20'
          : 'bg-slate-900/50 border-slate-600/70'
      }`}
    >
      {/* Outer directional guide crosses */}
      <div className="absolute inset-x-2 top-1/2 h-px bg-slate-700/50 -translate-y-1/2 pointer-events-none" />
      <div className="absolute inset-y-2 left-1/2 w-px bg-slate-700/50 -translate-x-1/2 pointer-events-none" />

      {/* Center Knob */}
      <div
        className={`w-12 h-12 rounded-full border shadow-md transition-transform duration-75 pointer-events-none flex items-center justify-center ${
          isActive
            ? 'bg-sky-500 border-sky-300 text-white'
            : 'bg-slate-700 border-slate-500 text-slate-400'
        }`}
        style={{
          transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
        }}
      >
        <div className="w-4 h-4 rounded-full bg-white/40" />
      </div>
    </div>
  );
};
