import type { FC } from 'react';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getWorld } from './RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';

export const PhysicsStepper: FC = () => {
  const worldRef = useRef<RAPIERType.World | null>(null);
  useEffect(() => {
    void getWorld().then((w) => {
      worldRef.current = w;
    });
  }, []);

  useFrame(() => {
    const w = worldRef.current;
    if (!w) return;
    w.step();
    // Log every 60 frames (approx 1 sec)
    if (performance.now() % 1000 < 20) {
      console.log('Physics step. Bodies:', w.bodies.len());
    }
  }, 1000);

  return null;
};
