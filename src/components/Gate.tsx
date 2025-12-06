import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Quaternion, Euler } from 'three';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import { useGameStore } from '../store/gameStore';
import { Station } from './Station';

interface GateProps {
    position: [number, number, number];
    modelPath: string;
    rotation?: [number, number, number];
    destinationSectorId?: string;
    gateType?: 'N' | 'S' | 'W' | 'E';
    objectName?: string;
    scale?: number;
}

export const Gate: React.FC<GateProps> = ({ position, modelPath, rotation = [0, 0, 0], destinationSectorId, gateType, objectName, scale = 1 }) => {
    const bodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const colliderRef = useRef<RAPIERType.Collider | null>(null);

    // Physics & Trigger setup
    useEffect(() => {
        let body: RAPIERType.RigidBody | null = null;
        let cancelled = false;

        const initPhysics = async () => {
            try {
                const RAPIER = await ensureRapier();
                if (cancelled) return;
                const world = await getWorld();
                if (cancelled) return;

                const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(position[0], position[1], position[2]);

                const q = new Quaternion().setFromEuler(new Euler(rotation[0], rotation[1], rotation[2]));
                rigidBodyDesc.setRotation(q);

                body = world.createRigidBody(rigidBodyDesc);
                bodyRef.current = body;

                // Sensor collider in the center
                // Scale sensor with the gate. Base radius 5, base half-height 20
                // For a big gate radius needs to be large enough to trigger before passing through?
                // Actually the ring is around the center.
                // Radius 5 at scale 1.
                // At scale 300, radius 1500.
                const sensorDesc = RAPIER.ColliderDesc.cylinder(5 * 0.5 * scale, 5 * scale)
                    .setSensor(true)
                    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

                // Rotate sensor to match gate facing (cylinder is Y-up, gate hole is Z)
                sensorDesc.setRotation(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));

                const collider = world.createCollider(sensorDesc, body);
                colliderRef.current = collider;
            } catch (err) {
                console.warn("Gate physics init failed:", err);
            }
        };

        const cleanup = () => {
            const w = getWorldSync();
            if (w && bodyRef.current) {
                try {
                    if (w.bodies.contains(bodyRef.current.handle)) {
                        w.removeRigidBody(bodyRef.current);
                    }
                } catch (e) {
                    console.warn('Rapier cleanup failed:', e);
                }
            }
            bodyRef.current = null;
            colliderRef.current = null;
        };

        initPhysics();

        return () => {
            cancelled = true;
            cleanup();
        }
    }, [position, rotation, gateType, scale]);

    useFrame(() => {
        if (!destinationSectorId) return;

        try {
            const ship = useGameStore.getState().position;
            if (!ship) return;

            const dx = ship.x - position[0];
            const dy = ship.y - position[1];
            const dz = ship.z - position[2];
            const distSq = dx * dx + dy * dy + dz * dz;
            // Trigger radius squared ~ large scale
            // If scale is 300, radius is ~1500?
            // Wait, we used 900 before (30 units).
            // Now we want something substantial but not infinite.
            // If scale 300, radius 5*scale = 1500.
            // Let's use 1000^2 = 1,000,000.
            const trigR = 5 * scale;
            if (distSq < trigR * trigR) {
                const store = useGameStore.getState();
                if (store.currentSectorId !== destinationSectorId) {
                    console.log(`Jumping from ${store.currentSectorId} to ${destinationSectorId} via ${gateType}`);

                    let arrivalGate: 'N' | 'S' | 'W' | 'E' | undefined;
                    if (gateType === 'N') arrivalGate = 'S';
                    else if (gateType === 'S') arrivalGate = 'N';
                    else if (gateType === 'W') arrivalGate = 'E';
                    else if (gateType === 'E') arrivalGate = 'W';

                    store.setSectorTransition(destinationSectorId, arrivalGate);
                }
            }
        } catch (e) {
            // ignore frame errors during transition
        }
    });

    return (
        <group position={position} rotation={rotation as [number, number, number]} name={objectName || "Gate"}>
            {/* Reuse Station component for visual loading of OBJ/BOD files */}
            <Station
                position={[0, 0, 0]}
                modelPath={modelPath}
                collisions={false}
                rotate={false}
                showLights={false}
                scale={scale}
            />
        </group>
    );
};
