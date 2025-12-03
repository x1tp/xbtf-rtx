import type { FC } from 'react';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getWorld, stepWorld } from './RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';

import { useGameStore } from '../store/gameStore';

export const PhysicsStepper: FC = () => {
  const worldRef = useRef<RAPIERType.World | null>(null);
  const timeScale = useGameStore((state) => state.timeScale);

  useEffect(() => {
    void getWorld().then((w) => {
      worldRef.current = w;
    });
  }, []);

  useFrame(() => {
    const steps = Math.max(1, Math.floor(timeScale));
    for (let i = 0; i < steps; i++) {
      void stepWorld();
    }
  }, 1000);

  return null;
};
