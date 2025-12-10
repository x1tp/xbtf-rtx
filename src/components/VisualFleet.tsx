import type { FC } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Group, Vector3, Quaternion } from 'three';
import { ShipModel } from './ShipModel';
import type { NPCFleet } from '../types/simulation';
import { FleetSimulator } from '../simulation/FleetSimulator';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import { getShipStats } from '../config/ships';

interface VisualFleetProps {
    fleet: NPCFleet;
}

const tmpVec = new Vector3();
const tmpQuat = new Quaternion();
const UP = new Vector3(0, 0, 1);

export const VisualFleet: FC<VisualFleetProps> = ({ fleet }) => {
    const groupRef = useRef<Group | null>(null);
    const bodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const colliderRef = useRef<RAPIERType.Collider | null>(null);
    const halfExtentsRef = useRef(new Vector3(12, 6, 24));
    const [navRadius, setNavRadius] = useState(26);

    const colliderRadius = useMemo(() => {
        const stats = getShipStats(fleet.modelPath || fleet.name);
        const map: Record<string, number> = {
            'M5': 8,
            'M4': 10,
            'M3': 12,
            'TS': 18,
            'TP': 18,
            'M6': 22,
            'TL': 45,
            'M2': 55,
            'M1': 65,
            'GO': 14,
            'UNKNOWN': 16
        };
        return map[stats.class] ?? 16;
    }, [fleet.modelPath, fleet.name]);

    useEffect(() => {
        let cancelled = false;

        const cleanup = () => {
            const w = getWorldSync();
            if (w && bodyRef.current) {
                try {
                    if (w.bodies.contains(bodyRef.current.handle)) {
                        w.removeRigidBody(bodyRef.current);
                    }
                } catch (err) {
                    console.warn('[VisualFleet] cleanup failed:', err);
                }
            }
            bodyRef.current = null;
            colliderRef.current = null;
        };

        const computeBounds = () => {
            if (!groupRef.current) return null;
            const box = new Box3().setFromObject(groupRef.current);
            const size = box.getSize(new Vector3());
            if (!isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z)) return null;
            if (size.lengthSq() < 1e-3) return null;
            return size;
        };

        const initPhysics = async () => {
            try {
                const RAPIER = await ensureRapier();
                if (cancelled) return;
                const world = await getWorld();
                if (cancelled) return;

                const size = computeBounds();
                if (size) {
                    const he = size.clone().multiplyScalar(0.5);
                    he.set(
                        Math.max(2, he.x),
                        Math.max(2, he.y),
                        Math.max(4, he.z),
                    );
                    halfExtentsRef.current.copy(he);
                    setNavRadius(Math.max(he.length() * 0.9, colliderRadius * 1.4));
                } else {
                    const r = colliderRadius;
                    halfExtentsRef.current.set(r, r, r);
                    setNavRadius(r * 1.6);
                }
                const he = halfExtentsRef.current;

                const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
                    .setTranslation(fleet.position[0], fleet.position[1], fleet.position[2]);
                const body = world.createRigidBody(bodyDesc);
                const collDesc = RAPIER.ColliderDesc.cuboid(he.x, he.y, he.z)
                    .setFriction(0.6)
                    .setRestitution(0.05);
                const collider = world.createCollider(collDesc, body);

                if (cancelled) {
                    world.removeRigidBody(body);
                    return;
                }

                bodyRef.current = body;
                colliderRef.current = collider;
            } catch (err) {
                console.warn('[VisualFleet] physics init failed:', err);
            }
        };

        initPhysics();
        return () => {
            cancelled = true;
            cleanup();
        };
    }, [fleet.id, colliderRadius]);

    // We use a ref to track the last seen fleet ID to handle pooling/swapping if needed, 
    // though generally key={fleet.id} prevents this.

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        // Direct read from Simulator state first (most up to date)
        const simState = FleetSimulator.getInstance().getFleetState(fleet.id);

        if (simState && simState.localState !== 'gone') {
            const vel = simState.velocity;

            // Interpolate position? 
            // Logic: The simulator updates fleet.position every frame. 
            // We can just read fleet.position. 
            // Note: fleet object might be stale if store updated and we haven't re-rendered.
            // But fleet is passed as prop?

            // Best approach: Read from simState if available, fall back to fleet prop.
            // simState has NO position, only velocity? 
            // No, FleetRuntimeState uses fleet.position for storage? 
            // FleetSimulator updates fleet.position in place.

            // Actually, let's trust the fleet object passed in props IS the object being mutated 
            // OR the simulator is mutating the store's object.

            // Wait, if Zustand re-creates the fleet object on store update, the 'fleet' prop here might be new,
            // but Simulator might be holding the OLD fleet object ref if we aren't careful?
            // Simulator iterates `useGameStore.getState().fleets`. So it always gets the LATEST array.
            // So it mutates the LATEST object.
            // The `fleet` prop here might be older if React hasn't re-rendered yet.
            // But we want to render the LATEST position.

            // So: Find the fleet in the Sim's view of the world?
            // Or just trust that Sim operates on the same memory?

            // Safest: Sim updates `fleet.position`. We read `fleet.position`.
            // If Sim and React have diverged, we might see jitter.
            // Better: Sim maintains its own "authoritative" position in `FleetRuntimeState`? 
            // No, `FleetRuntimeState` relies on `fleet.position` in `updateFleetPhysics`.

            // Let's modify `FleetRuntimeState` to hold `position: Vector3` and sync it to fleet object.
            // I'll update FleetSimulator.ts to do that.

            // For now, let's assume fleet.position is updated.
            groupRef.current.position.set(fleet.position[0], fleet.position[1], fleet.position[2]);
            if (bodyRef.current) {
                bodyRef.current.setNextKinematicTranslation({
                    x: fleet.position[0],
                    y: fleet.position[1],
                    z: fleet.position[2],
                });
            }

            // Orientation
            if (vel.lengthSq() > 1) {
                tmpVec.copy(vel).normalize();
                tmpQuat.setFromUnitVectors(UP, tmpVec);
                groupRef.current.quaternion.slerp(tmpQuat, delta * 2.0);
            }
        } else {
            // If logic says gone, hide it
            groupRef.current.visible = false;
            // Or render based on fleet prop if sim is missing (static?)
            if (!simState) {
                groupRef.current.position.set(fleet.position[0], fleet.position[1], fleet.position[2]);
                if (bodyRef.current) {
                    bodyRef.current.setNextKinematicTranslation({
                        x: fleet.position[0],
                        y: fleet.position[1],
                        z: fleet.position[2],
                    });
                }
            }
        }
    });

    return (
        <group ref={groupRef} userData={{ navRadius }}>
            <group rotation={[0, Math.PI, 0]}>
                <ShipModel
                    modelPath={fleet.modelPath}
                    name={fleet.name}
                    enableLights={false}
                />
            </group>
        </group>
    );
};
