import React, { useEffect, useRef, useState } from 'react';

type CursorState = { active: boolean; x: number; y: number };

/**
 * Shows a custom cursor while the player is holding LMB to steer.
 * We hide the default cursor and render a circle with inward-pointing arrows.
 */
export const ShipControlCursor: React.FC = () => {
  const [state, setState] = useState<CursorState>({ active: false, x: 0, y: 0 });
  const stateRef = useRef(state);
  const previousCursorRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const activate = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const isCanvas = (e.target as HTMLElement | null)?.tagName?.toLowerCase() === 'canvas';
      if (!isCanvas) return;
      const next = { active: true, x: e.clientX, y: e.clientY };
      stateRef.current = next;
      setState(next);
      previousCursorRef.current = document.body.style.cursor;
      document.body.style.cursor = 'none';
    };

    const deactivate = () => {
      if (!stateRef.current.active) return;
      const next = { ...stateRef.current, active: false };
      stateRef.current = next;
      setState(next);
      document.body.style.cursor = previousCursorRef.current ?? '';
    };

    const updatePos = (e: MouseEvent) => {
      if (!stateRef.current.active) return;
      const next = { ...stateRef.current, x: e.clientX, y: e.clientY };
      stateRef.current = next;
      setState(next);
    };

    window.addEventListener('mousedown', activate);
    window.addEventListener('mouseup', deactivate);
    window.addEventListener('mouseleave', deactivate);
    window.addEventListener('blur', deactivate);
    window.addEventListener('mousemove', updatePos);

    return () => {
      window.removeEventListener('mousedown', activate);
      window.removeEventListener('mouseup', deactivate);
      window.removeEventListener('mouseleave', deactivate);
      window.removeEventListener('blur', deactivate);
      window.removeEventListener('mousemove', updatePos);
      document.body.style.cursor = previousCursorRef.current ?? '';
    };
  }, []);

  if (!state.active) return null;

  const arrowBase = {
    position: 'absolute' as const,
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderBottom: '12px solid rgba(120, 230, 255, 0.9)',
    filter: 'drop-shadow(0 0 6px rgba(90, 210, 255, 0.8))',
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
        zIndex: 1200,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: '2px solid rgba(140, 230, 255, 0.9)',
          borderRadius: '50%',
          boxShadow: '0 0 10px rgba(90, 210, 255, 0.7)',
          position: 'relative',
          background: 'rgba(10, 20, 30, 0.25)',
        }}
      />
      <div style={{ ...arrowBase, left: '50%', top: -18, transform: 'translateX(-50%) rotate(0deg)' }} />
      <div style={{ ...arrowBase, left: '50%', bottom: -18, transform: 'translateX(-50%) rotate(180deg)' }} />
      <div style={{ ...arrowBase, top: '50%', right: -18, transform: 'translateY(-50%) rotate(90deg)' }} />
      <div style={{ ...arrowBase, top: '50%', left: -18, transform: 'translateY(-50%) rotate(-90deg)' }} />
    </div>
  );
};
