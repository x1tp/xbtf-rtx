import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { useGameStore } from '../store/gameStore';

/**
 * Projects the player's forward vector into screen space so we can show
 * a crosshair aligned with the current ship direction (useful in follow cam).
 */
export const ShipCrosshair: React.FC = () => {
  const { camera, scene } = useThree();
  const shipRef = useRef<Group | null>(null);
  const shipPosRef = useRef(new Vector3());
  const forwardRef = useRef(new Vector3());
  const targetPosRef = useRef(new Vector3());
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const sectorMapOpen = useGameStore((s) => s.sectorMapOpen);
  const universeMapOpen = useGameStore((s) => s.universeMapOpen);
  const isDocked = useGameStore((s) => s.isDocked);

  useEffect(() => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: '1400',
      display: 'none',
    });

    const inner = document.createElement('div');
    Object.assign(inner.style, {
      width: '46px',
      height: '46px',
      position: 'relative',
      filter: 'drop-shadow(0 0 8px rgba(90, 210, 255, 0.65))',
    });

    const addDiv = (style: Record<string, string>) => {
      const d = document.createElement('div');
      Object.assign(d.style, style);
      inner.appendChild(d);
    };

    // Outer ticks
    addDiv({ position: 'absolute', left: '50%', top: '2px', width: '1px', height: '8px', background: 'rgba(140, 230, 255, 0.6)' });
    addDiv({ position: 'absolute', left: '50%', bottom: '2px', width: '1px', height: '8px', background: 'rgba(140, 230, 255, 0.6)' });
    addDiv({ position: 'absolute', top: '50%', left: '2px', width: '8px', height: '1px', background: 'rgba(140, 230, 255, 0.6)' });
    addDiv({ position: 'absolute', top: '50%', right: '2px', width: '8px', height: '1px', background: 'rgba(140, 230, 255, 0.6)' });

    // Crosshair lines
    addDiv({ position: 'absolute', left: '50%', top: '12px', bottom: '12px', width: '1px', background: 'rgba(140, 230, 255, 0.8)' });
    addDiv({ position: 'absolute', top: '50%', left: '12px', right: '12px', height: '1px', background: 'rgba(140, 230, 255, 0.8)' });

    // Center ring
    addDiv({
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '12px',
      height: '12px',
      marginLeft: '-6px',
      marginTop: '-6px',
      border: '2px solid rgba(140, 230, 255, 0.9)',
      borderRadius: '50%',
      boxShadow: '0 0 6px rgba(140, 230, 255, 0.6)',
    });

    el.appendChild(inner);
    document.body.appendChild(el);
    overlayRef.current = el;
    return () => {
      document.body.removeChild(el);
      overlayRef.current = null;
    };
  }, []);

  useFrame(() => {
    const el = overlayRef.current;
    if (!el) return;

    // Hide when we are not actively flying
    if (sectorMapOpen || universeMapOpen || isDocked) {
      el.style.display = 'none';
      return;
    }

    if (!shipRef.current) {
      shipRef.current = scene.getObjectByName('PlayerShip') as Group | null;
    }
    const ship = shipRef.current;
    if (!ship) {
      el.style.display = 'none';
      return;
    }

    ship.getWorldPosition(shipPosRef.current);
    ship.getWorldDirection(forwardRef.current).normalize();

    // Project ship center and a forward point to screen space
    const camDist = Math.max(50, camera.position.distanceTo(shipPosRef.current));
    targetPosRef.current
      .copy(forwardRef.current)
      .multiplyScalar(camDist * 1.2)
      .add(shipPosRef.current);

    const shipProjected = shipPosRef.current.clone().project(camera);
    const fwdProjected = targetPosRef.current.clone().project(camera);

    const w = window.innerWidth;
    const h = window.innerHeight;

    const sx = (shipProjected.x * 0.5 + 0.5) * w;
    const sy = (1 - (shipProjected.y * 0.5 + 0.5)) * h;
    const fx = (fwdProjected.x * 0.5 + 0.5) * w;
    const fy = (1 - (fwdProjected.y * 0.5 + 0.5)) * h;

    const dx = fx - sx;
    const dy = fy - sy;
    const len = Math.max(1, Math.hypot(dx, dy));
    const screenOffset = 140; // pixels ahead of nose on screen
    const cx = sx + (dx / len) * screenOffset;
    const cy = sy + (dy / len) * screenOffset;

    el.style.display = 'block';
    el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
  });

  return null;
};
