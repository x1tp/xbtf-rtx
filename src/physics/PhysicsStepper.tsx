import type { FC } from 'react';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getWorld, stepWorld } from './RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';

export const PhysicsStepper: FC = () => {
  const worldRef = useRef<RAPIERType.World | null>(null);
  useEffect(() => {
    void getWorld().then((w) => {
      worldRef.current = w;
    });
  }, []);

  useFrame(() => {
    void stepWorld();
  }, 1000);

  return null;
};
