import type { FC } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils, Quaternion, Vector3 } from 'three';
import { ShipModel } from './ShipModel';
import { findPath } from '../ai/navigation';
import type { NavGraph, NavObstacle } from '../ai/navigation';
import { useGameStore } from '../store/gameStore';
import { getShipStats } from '../config/ships';

interface AIShipProps {
  name: string;
  modelPath: string;
  position: [number, number, number];
  navGraph: NavGraph | null;
  obstacles: NavObstacle[];
  maxSpeed?: number;
  size?: number;
}

const tmpVec = new Vector3();

export const AIShip: FC<AIShipProps> = ({ name, modelPath, position, navGraph, obstacles, maxSpeed, size = 24 }) => {
  const shipRef = useRef<Group | null>(null);
  const velocityRef = useRef(new Vector3());
  const pathRef = useRef<Vector3[]>([]);
  const targetRef = useRef<Vector3 | null>(null);
  const nextRepathAtRef = useRef(0);
  const lastNavSyncRef = useRef(0);
  const lastProgressSampleRef = useRef({ time: 0, pos: new Vector3(), stuckTime: 0 });
  const timeScale = useGameStore((s) => s.timeScale);

  const stats = useMemo(() => getShipStats(modelPath || name), [modelPath, name]);

  const cruiseSpeed = useMemo(() => {
    if (maxSpeed) return maxSpeed;
    // Add small variance to avoid artificial sync
    return stats.maxSpeed * MathUtils.randFloat(0.9, 1.1);
  }, [maxSpeed, stats]);

  // Inertia calculations based on stats if available, otherwise fallback to size
  const velocityDampingK = useMemo(() => {
    if (stats.acceleration && stats.maxSpeed) {
      // Time to reach max speed approx maxSpeed / acceleration
      // dampening k approx 3 / time_to_reach
      // Multiplier 2.0 to make it slightly snappier than pure physics
      return 2.0 * (3.0 * stats.acceleration / stats.maxSpeed);
    }
    const inertiaFactor = Math.max(0.2, 24 / size);
    return 3.0 * inertiaFactor;
  }, [stats, size]);

  const rotationDampingK = useMemo(() => {
    if (stats.turnRate) {
      // Base turn rate 1.0 -> k=4.0
      // Multiplier 2.0 for responsiveness
      return 2.0 * 4.0 * stats.turnRate;
    }
    const inertiaFactor = Math.max(0.2, 24 / size);
    return 4.0 * inertiaFactor;
  }, [stats, size]);

  // Store the initial spawn position in a ref so it only applies once
  const initialPositionRef = useRef<[number, number, number] | null>(null);

  useEffect(() => {
    // Only set the initial position once on mount (or if the component is remounted with a new key)
    if (shipRef.current && initialPositionRef.current === null) {
      initialPositionRef.current = [position[0], position[1], position[2]];
      shipRef.current.position.set(position[0], position[1], position[2]);
      useGameStore.getState().upsertNavObject({ name, position, type: 'ship' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickNewDestination = (forceWander = false) => {
    if (!shipRef.current) return;
    const pos = shipRef.current.position.clone();
    if (forceWander || !navGraph || navGraph.nodes.length === 0) {
      const heading = new Vector3(
        MathUtils.randFloatSpread(1),
        MathUtils.randFloatSpread(0.4),
        MathUtils.randFloatSpread(1),
      ).normalize();
      const fallbackTarget = pos.clone().add(heading.multiplyScalar(800 + Math.random() * 1200));
      pathRef.current = [fallbackTarget];
      targetRef.current = fallbackTarget;
    } else {
      const candidates = navGraph.nodes.filter((n) => n.kind !== 'waypoint');
      const pool = candidates.length > 0 ? candidates : navGraph.nodes;
      const ranked = [...pool].sort(
        (a, b) => b.position.distanceTo(pos) - a.position.distanceTo(pos),
      );
      const choice = ranked[Math.floor(Math.min(ranked.length - 1, Math.random() * 4))] ?? ranked[0];
      const path = findPath(navGraph, pos, choice.position);
      pathRef.current = path;
      targetRef.current = path[0] ?? null;
    }
    nextRepathAtRef.current = performance.now() + 12000 + Math.random() * 6000;
  };

  useFrame((_, rawDelta) => {
    const delta = rawDelta * timeScale;
    if (!shipRef.current) return;
    if (targetRef.current === null || pathRef.current.length === 0 || performance.now() > nextRepathAtRef.current) {
      pickNewDestination();
    }

    const ship = shipRef.current;
    const target = targetRef.current;
    if (!target) return;
    const pos = ship.position;
    const toTarget = tmpVec.copy(target).sub(pos);
    const dist = toTarget.length();

    if (dist < 40) {
      pathRef.current.shift();
      targetRef.current = pathRef.current[0] ?? null;
      if (!targetRef.current) nextRepathAtRef.current = 0;
      return;
    }

    let desiredDir = toTarget.normalize();

    // Simple obstacle avoidance: push away from nearby centers.
    const avoidance = new Vector3();
    for (const o of obstacles) {
      const offset = pos.clone().sub(o.center);
      const d = offset.length();
      if (d <= 1e-3) continue;
      const safe = o.radius + 120;
      if (d < safe) {
        const strength = (safe - d) / safe;
        avoidance.add(offset.normalize().multiplyScalar(strength));
      }
    }
    if (avoidance.lengthSq() > 0) {
      desiredDir = desiredDir.add(avoidance.multiplyScalar(1.4)).normalize();
    }

    const desiredVel = desiredDir.multiplyScalar(cruiseSpeed);
    const vel = velocityRef.current;

    // Apply inertia
    const damping = 1 - Math.exp(-velocityDampingK * delta);
    vel.lerp(desiredVel, damping);
    ship.position.add(vel.clone().multiplyScalar(delta));

    const now = performance.now();

    // Sync position to store for sector map (throttled to reduce overhead)
    if (now - lastNavSyncRef.current > 500) {
      lastNavSyncRef.current = now;
      // Use queueMicrotask to defer store update outside the render loop
      const x = ship.position.x;
      const y = ship.position.y;
      const z = ship.position.z;
      queueMicrotask(() => {
        useGameStore.getState().upsertNavObject({
          name,
          position: [x, y, z],
          type: 'ship',
        });
      });
    }

    // Stuck detection: if not making progress, force a wander target
    const lp = lastProgressSampleRef.current;
    if (lp.time === 0) {
      lp.time = now;
      lp.pos.copy(ship.position);
    } else {
      const moved = ship.position.distanceTo(lp.pos);
      const dt = (now - lp.time) / 1000;
      if (dt > 1.0) {
        if (moved < 5) {
          lp.stuckTime += dt;
          if (lp.stuckTime > 2.5) {
            pickNewDestination(true);
            lp.stuckTime = 0;
          }
        } else {
          lp.stuckTime = 0;
          lp.pos.copy(ship.position);
        }
        lp.time = now;
      }
    }

    const forward = new Vector3(0, 0, -1);
    const moveDir = vel.lengthSq() > 1e-4 ? vel.clone().normalize() : desiredDir;
    const targetQuat = new Quaternion().setFromUnitVectors(forward, moveDir);
    ship.quaternion.slerp(targetQuat, 1 - Math.exp(-rotationDampingK * delta));
  });

  return (
    <group ref={shipRef} name={name}>
      <ShipModel name={name} modelPath={modelPath} enableLights={false} throttle={1.0} />
    </group>
  );
};
