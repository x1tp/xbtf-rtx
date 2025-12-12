import type { FC } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Group, MathUtils, Quaternion, Vector3, type Object3D } from 'three';
import { ShipModel } from './ShipModel';
import { findPath } from '../ai/navigation';
import type { NavGraph, NavObstacle } from '../ai/navigation';
import { useGameStore, type GameState } from '../store/gameStore';
import { getShipStats } from '../config/ships';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import { ShieldWrapEffect, type ShieldWrapEffectHandle } from './ShieldWrapEffect';

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
const tmpMove = new Vector3();

export const AIShip: FC<AIShipProps> = ({ name, modelPath, position, navGraph, obstacles, maxSpeed, size = 24 }) => {
  const shipRef = useRef<Group | null>(null);
  const velocityRef = useRef(new Vector3());
  const pathRef = useRef<Vector3[]>([]);
  const targetRef = useRef<Vector3 | null>(null);
  const nextRepathAtRef = useRef(0);
  const lastNavSyncRef = useRef(0);
  const lastProgressSampleRef = useRef({ time: 0, pos: new Vector3(), stuckTime: 0 });
  const timeScale = useGameStore((s: GameState) => s.timeScale);
  const bodyRef = useRef<RAPIERType.RigidBody | null>(null);
  const colliderRef = useRef<RAPIERType.Collider | null>(null);
  const controllerRef = useRef<RAPIERType.KinematicCharacterController | null>(null);
  const colliderHalfExtentsRef = useRef(new Vector3(8, 3, 12));
  const shieldRef = useRef<ShieldWrapEffectHandle | null>(null);
  const [shieldThickness, setShieldThickness] = useState(MathUtils.clamp(size * 0.0035, 0.12, 0.35));
  const lastShieldAtRef = useRef(0);
  const [shieldTarget, setShieldTarget] = useState<Object3D | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    const refreshColliderSize = () => {
      if (!shipRef.current) return;
      if (!shieldTarget) setShieldTarget(shipRef.current);
      const box = new Box3().setFromObject(shipRef.current);
      const s = box.getSize(new Vector3());
      const he = colliderHalfExtentsRef.current;
      he.set(
        Math.max(4, s.x * 0.45, size * 0.35),
        Math.max(2, s.y * 0.45, size * 0.2),
        Math.max(6, s.z * 0.45, size * 0.5),
      );
      const r = Math.max(s.x, s.y, s.z);
      if (r > 1) setShieldThickness(MathUtils.clamp(r * 0.0035, 0.12, 0.35));
    };

    const cleanup = () => {
      const w = getWorldSync();
      if (w && bodyRef.current) {
        try {
          if (w.bodies.contains(bodyRef.current.handle)) {
            w.removeRigidBody(bodyRef.current);
          }
        } catch (err) {
          console.warn('[AIShip] Cleanup failed:', err);
        }
      }
      bodyRef.current = null;
      colliderRef.current = null;
      controllerRef.current = null;
    };

    const initPhysics = async () => {
      try {
        const RAPIER = await ensureRapier();
        if (cancelled) return;
        const world = await getWorld();
        if (cancelled) return;

        refreshColliderSize();
        const he = colliderHalfExtentsRef.current;

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicVelocityBased().setCcdEnabled(true);
        const body = world.createRigidBody(bodyDesc);
        if (shipRef.current) {
          const p = shipRef.current.position;
          body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
        }
        const colliderDesc = RAPIER.ColliderDesc.cuboid(he.x, he.y, he.z)
          .setFriction(0.5)
          .setRestitution(0.05);
        const collider = world.createCollider(colliderDesc, body);
        const controller = world.createCharacterController(0.4);
        controller.setApplyImpulsesToDynamicBodies(true);
        controller.setSlideEnabled(true);

        if (cancelled) {
          world.removeRigidBody(body);
          return;
        }

        bodyRef.current = body;
        colliderRef.current = collider;
        controllerRef.current = controller;
      } catch (err) {
        console.warn('[AIShip] Physics init failed:', err);
      }
    };

    initPhysics();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [modelPath, size]);

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
    const moveStep = tmpMove.copy(vel).multiplyScalar(delta);

    let collided = false;
    if (controllerRef.current && colliderRef.current) {
      if (bodyRef.current) {
        const q = ship.quaternion;
        bodyRef.current.setTranslation({ x: ship.position.x, y: ship.position.y, z: ship.position.z }, true);
        bodyRef.current.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      }
      if (moveStep.lengthSq() > 0) {
        controllerRef.current.computeColliderMovement(colliderRef.current, { x: moveStep.x, y: moveStep.y, z: moveStep.z });
        const res = controllerRef.current.computedMovement();
        const actualMove = new Vector3(res.x, res.y, res.z);
        collided = actualMove.distanceTo(moveStep) > 1e-4;
        if (collided && delta > 0) {
          vel.copy(actualMove.clone().divideScalar(delta));
        }
        moveStep.copy(actualMove);
      }
    }

    ship.position.add(moveStep);

    if (collided && shieldRef.current) {
      const nowMs = performance.now();
      if (nowMs - lastShieldAtRef.current > 180) {
        lastShieldAtRef.current = nowMs;
        const hitDirWorld = moveStep.lengthSq() > 1e-6 ? moveStep.clone().normalize().negate() : new Vector3(0, 0, 1);
        const invQ = ship.quaternion.clone().invert();
        const hitDirLocal = hitDirWorld.applyQuaternion(invQ).normalize();
        shieldRef.current.trigger(hitDirLocal, 0.9);
      }
    }

    if (bodyRef.current) {
      const p = ship.position;
      const q = ship.quaternion;
      bodyRef.current.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
      bodyRef.current.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

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
    <group ref={shipRef} name={name} userData={{ navRadius: size * 1.4 }}>
      <ShipModel name={name} modelPath={modelPath} enableLights={false} throttle={1.0} />
      <ShieldWrapEffect ref={shieldRef} target={shieldTarget} thickness={shieldThickness} />
    </group>
  );
};
