import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, MathUtils, Quaternion, Box3, Quaternion as TQuaternion, Mesh, BufferGeometry, Matrix4 } from 'three';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
type RapierExports = { ColliderDesc: { convexHull: (arr: Float32Array) => unknown } };
import { useGameStore } from '../store/gameStore';
import { ShipModel } from './ShipModel';

interface ShipProps {
    enableLights?: boolean;
    position?: [number, number, number];
}

export const Ship: React.FC<ShipProps> = ({ enableLights = true, position = [0, 0, 300] }) => {
    const shipRef = useRef<Group | null>(null);
    const { camera, scene } = useThree();

    const speed = useGameStore((state) => state.speed);
    const maxSpeed = useGameStore((state) => state.maxSpeed);
    const updateSpeed = useGameStore((state) => state.updateSpeed);
    const setThrottle = useGameStore((state) => state.setThrottle);
    const throttle = useGameStore((state) => state.throttle);
    const timeScale = useGameStore((state) => state.timeScale);
    const setTimeScale = useGameStore((state) => state.setTimeScale);
    const velocityRef = useRef(new Vector3());
    const planetRadiusRef = useRef(0);
    const stationRadiusRef = useRef(0);
    const shipHalfExtentsRef = useRef(new Vector3(1, 1, 1));
    const shipBodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const shipColliderRef = useRef<RAPIERType.Collider | null>(null);
    const characterControllerRef = useRef<RAPIERType.KinematicCharacterController | null>(null);
    const initializedRef = useRef(false);
    const hullColliderRef = useRef<RAPIERType.Collider | null>(null);

    // Input state
    const keys = useRef<{ [key: string]: boolean }>({});
    const mouse = useRef({ x: 0, y: 0 });
    const orbitRef = useRef({ yaw: 0, pitch: -0.15, distance: 40, target: 'center' as 'center' | 'forward' });
    const lmbDownRef = useRef(false);
    const brakeRef = useRef(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keys.current[e.code] = true;
            if (e.code === 'KeyT') {
                const o = orbitRef.current;
                o.target = o.target === 'center' ? 'forward' : 'center';
            }
            if (e.code === 'KeyM') {
                useGameStore.getState().toggleSectorMap();
            }
            if (e.code === 'KeyJ') {
                const current = useGameStore.getState().timeScale;
                // Toggle between 1x and 10x
                useGameStore.getState().setTimeScale(current === 1.0 ? 10.0 : 1.0);
            }
            if (e.code === 'Backspace') {
                e.preventDefault();
                brakeRef.current = true;
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            keys.current[e.code] = false;
            if (e.code === 'Backspace') {
                brakeRef.current = false;
            }
        };
        const handleMouseMove = (e: MouseEvent) => {
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) lmbDownRef.current = true;
        };
        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 0) lmbDownRef.current = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const planet = scene.getObjectByName('PlanetGroup');
        if (planet) {
            const b = new Box3().setFromObject(planet);
            const s = b.getSize(new Vector3());
            planetRadiusRef.current = Math.max(s.x, s.y, s.z) * 0.5;
        }
        const st = scene.getObjectByName('Station');
        if (st) {
            const b = new Box3().setFromObject(st);
            const s = b.getSize(new Vector3());
            stationRadiusRef.current = Math.max(s.x, s.y, s.z) * 0.5;
        }
        if (shipRef.current) {
            const b = new Box3().setFromObject(shipRef.current);
            const s = b.getSize(new Vector3());
            // Keep the collider modest but wide enough to cover the wings
            const base = new Vector3(s.x * 0.5, s.y * 0.5, s.z * 0.5).multiplyScalar(0.55);
            shipHalfExtentsRef.current.set(
                Math.max(2.4, base.x),
                Math.max(0.9, base.y),
                Math.max(3.0, base.z)
            );
        }
        (async () => {
            const RAPIER = await ensureRapier();
            if (cancelled) return;
            const world = await getWorld();
            if (cancelled) return;
            const rbDesc = RAPIER.RigidBodyDesc.kinematicVelocityBased().setCcdEnabled(true);
            const body = world.createRigidBody(rbDesc);
            const he = shipHalfExtentsRef.current;
            const controller = world.createCharacterController(0.02);
            controller.setApplyImpulsesToDynamicBodies(true);
            if (cancelled) {
                world.removeRigidBody(body);
                return;
            }
            // Try to build a hull collider; fall back to a modest cuboid if unavailable
            shipBodyRef.current = body;
            let collider: RAPIERType.Collider | null = buildConvexHullCollider(RAPIER, world);
            if (!collider) {
                const collDesc = RAPIER.ColliderDesc.cuboid(he.x, he.y, he.z)
                    .setFriction(0.6)
                    .setRestitution(0.2);
                collider = world.createCollider(collDesc, body);
            }
            shipColliderRef.current = collider;
            characterControllerRef.current = controller;
            console.log('Ship physics initialized. HalfExtents:', he, 'Hull:', !!hullColliderRef.current);
        })();

        return () => {
            cancelled = true;
        if (shipBodyRef.current) {
            const w = getWorldSync();
            if (w) {
                w.removeRigidBody(shipBodyRef.current);
            }
            shipBodyRef.current = null;
            shipColliderRef.current = null;
            characterControllerRef.current = null;
            hullColliderRef.current = null;
        }
    };

    function buildConvexHullCollider(RAPIER: unknown, world: RAPIERType.World): RAPIERType.Collider | null {
        if (!shipRef.current || !shipBodyRef.current) return null;
        shipRef.current.updateWorldMatrix(true, true);
        const shipInv = new Matrix4().copy(shipRef.current.matrixWorld).invert();
        const verts: number[] = [];
        const v = new Vector3();
        shipRef.current.traverse((o) => {
            const m = o as Mesh;
            const g = m.geometry as BufferGeometry | undefined;
            if (!g || !g.attributes?.position) return;
            const pos = g.getAttribute('position');
            for (let i = 0; i < pos.count; i++) {
                v.set(pos.getX(i), pos.getY(i), pos.getZ(i))
                    .applyMatrix4(m.matrixWorld)
                    .applyMatrix4(shipInv); // convert to ship-local space for collider
                verts.push(v.x, v.y, v.z);
            }
        });
        if (verts.length < 9) return null;
        const hullDescUnknown = (RAPIER as RapierExports).ColliderDesc.convexHull(new Float32Array(verts));
        if (!hullDescUnknown) return null;
        const hullDesc = hullDescUnknown as unknown as RAPIERType.ColliderDesc;
        hullDesc.setFriction(0.6).setRestitution(0.2);
        const hullCollider = world.createCollider(hullDesc, shipBodyRef.current);
        hullColliderRef.current = hullCollider;
        return hullCollider;
    }
    }, [scene]);

    useFrame((state, rawDelta) => {
        const delta = rawDelta * timeScale;
        void state;
        if (!shipRef.current) return;
        const ship = shipRef.current;
        const velocity = velocityRef.current;
        const orbit = orbitRef.current;

        // Helper to compute camera follow (recalculates vectors from current quaternion)
        const updateCameraFollow = () => {
            const fwd = new Vector3(0, 0, -1).applyQuaternion(ship.quaternion).normalize();
            const upVec = new Vector3(0, 1, 0).applyQuaternion(ship.quaternion);
            const rightVec = new Vector3().crossVectors(fwd, upVec).normalize();
            const base = fwd.clone().multiplyScalar(-orbit.distance);
            const qYaw = new Quaternion().setFromAxisAngle(upVec, orbit.yaw);
            const qPitch = new Quaternion().setFromAxisAngle(rightVec, orbit.pitch);
            const offset = base.clone().applyQuaternion(qYaw).applyQuaternion(qPitch);
            const desired = ship.position.clone().add(offset);
            const lookTarget = orbit.target === 'center'
                ? ship.position.clone()
                : ship.position.clone().add(fwd.clone().multiplyScalar(50));
            const t = 1 - Math.exp(-5 * delta);
            if (!initializedRef.current) {
                camera.position.copy(desired);
                camera.up.copy(upVec);
                camera.lookAt(lookTarget);
                initializedRef.current = true;
            } else {
                camera.position.lerp(desired, t);
                camera.up.copy(upVec);
                camera.lookAt(lookTarget);
            }
        };

        // Skip all ship controls when sector map is open
        const sectorMapOpen = useGameStore.getState().sectorMapOpen;
        if (sectorMapOpen) {
            // Still update camera to follow ship, but no input processing
            updateCameraFollow();
            return;
        }

        // Input-driven throttle changes
        if (keys.current['KeyW']) {
            if (timeScale > 1.0) setTimeScale(1.0);
            setThrottle(throttle + delta * 0.5);
            brakeRef.current = false;
        } else if (keys.current['KeyS']) {
            if (timeScale > 1.0) setTimeScale(1.0);
            setThrottle(throttle - delta * 0.5);
            brakeRef.current = false;
        } else if (brakeRef.current) {
            if (timeScale > 1.0) setTimeScale(1.0);
            const eased = MathUtils.damp(throttle, 0, 1.2, delta);
            setThrottle(eased);
        }

        // Rotation (Pitch/Yaw from mouse, Roll from Q/E)
        const rollSpeed = 2.0;
        const pitchSpeed = 1.5;
        const yawSpeed = 1.5;

        const rotationChange = { x: 0, y: 0, z: 0 };

        // Mouse controls Pitch and Yaw with a small deadzone
        const mx = lmbDownRef.current && Math.abs(mouse.current.x) > 0.1 ? mouse.current.x : 0;
        const my = lmbDownRef.current && Math.abs(mouse.current.y) > 0.1 ? mouse.current.y : 0;

        rotationChange.x = my * pitchSpeed * delta;
        rotationChange.y = -mx * yawSpeed * delta;

        // Keys control Roll
        if (keys.current['KeyQ']) {
            rotationChange.z = rollSpeed * delta;
            if (timeScale > 1.0) setTimeScale(1.0);
        }
        if (keys.current['KeyE']) {
            rotationChange.z = -rollSpeed * delta;
            if (timeScale > 1.0) setTimeScale(1.0);
        }

        // Apply rotation in local space so controls stay aligned after rolling
        if (rotationChange.x !== 0) {
            ship.rotateX(rotationChange.x);
            if (timeScale > 1.0) setTimeScale(1.0);
        }
        if (rotationChange.y !== 0) {
            ship.rotateY(rotationChange.y);
            if (timeScale > 1.0) setTimeScale(1.0);
        }
        if (rotationChange.z !== 0) ship.rotateZ(rotationChange.z);

        const forward = new Vector3(0, 0, -1).applyQuaternion(ship.quaternion).normalize();
        const up = new Vector3(0, 1, 0).applyQuaternion(ship.quaternion);
        const right = new Vector3().crossVectors(forward, up).normalize();

        // Translational movement with simple flight-assist drift compensation
        const reverseSpeedScale = 0.35;
        const targetForwardSpeed = throttle >= 0
            ? throttle * maxSpeed
            : throttle * maxSpeed * reverseSpeedScale;

        // Damp toward the desired forward/reverse speed
        velocity.z = MathUtils.damp(velocity.z, targetForwardSpeed, 2.5, delta);

        const strafeInput = (keys.current['KeyD'] ? 1 : 0) - (keys.current['KeyA'] ? 1 : 0);
        const maxStrafeSpeed = maxSpeed * 0.6;
        const strafeTarget = strafeInput * maxStrafeSpeed;

        if (strafeInput !== 0) {
            velocity.x = MathUtils.damp(velocity.x, strafeTarget, 10, delta);
        } else {
            velocity.x = MathUtils.damp(velocity.x, 0, 4, delta); // counter-drift when no strafe input
        }

        const moveX = velocity.x * delta;
        const moveZ = velocity.z * delta;
        const move = new Vector3().copy(right).multiplyScalar(moveX).add(new Vector3().copy(forward).multiplyScalar(moveZ));
        const origin = ship.position.clone();
        const dest = origin.clone().add(move);

        let collided = false;
        if (shipBodyRef.current) {
            const b = shipBodyRef.current;
            const p = ship.position;
            const q = ship.quaternion;
            // Keep Rapier body in sync with the visual ship before collision tests
            b.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
            b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        }

        if (move.lengthSq() > 0 && characterControllerRef.current && shipColliderRef.current) {
            const desired = { x: move.x, y: move.y, z: move.z };
            const start = performance.now();
            characterControllerRef.current.computeColliderMovement(shipColliderRef.current, desired);
            const end = performance.now();
            if (end - start > 4) {
                console.warn('Slow collision check:', end - start, 'ms');
            }
            const result = characterControllerRef.current.computedMovement();

            // Debug log every 60 frames if moving
            if (state.clock.elapsedTime % 1 < 0.02) {
                // console.log('Movement:', desired, result);
            }

            if (result.x !== 0 || result.y !== 0 || result.z !== 0) {
                const newPos = origin.clone().add(new Vector3(result.x, result.y, result.z));
                ship.position.copy(newPos);
                collided = (Math.abs(result.x - move.x) + Math.abs(result.y - move.y) + Math.abs(result.z - move.z)) > 1e-6;
                if (collided) {
                    console.log('Ship collided!', result, move);
                    const n = new Vector3(move.x - result.x, move.y - result.y, move.z - result.z).normalize();
                    const vn = n.clone().multiplyScalar(velocity.dot(n));
                    velocity.sub(vn).multiplyScalar(0.9);
                }
            }
        }


        if (!collided) {
            ship.position.copy(dest);
        }

        const planet = scene.getObjectByName('PlanetGroup') as Group | null;
        if (planet) {
            const c = new Vector3();
            planet.getWorldPosition(c);
            const v = ship.position.clone().sub(c);
            const d = v.length();
            const r = planetRadiusRef.current;
            if (r > 0 && d < r) {
                const n = v.normalize();
                const invQ = ship.quaternion.clone().invert();
                const nLocal = n.clone().applyQuaternion(invQ as unknown as TQuaternion);
                const he = shipHalfExtentsRef.current;
                const support = Math.abs(nLocal.x) * he.x + Math.abs(nLocal.y) * he.y + Math.abs(nLocal.z) * he.z;
                ship.position.copy(c.clone().add(n.multiplyScalar(r + support)));
                velocity.multiplyScalar(0.5);
            }
        }

        // Station sphere fallback removed (physics colliders present)

        // Update HUD speed readout based on actual velocity magnitude
        updateSpeed(velocity.length());

        const orbitYawSpeed = 1.8;
        const orbitPitchSpeed = 1.2;
        const zoomSpeed = 18;
        if (keys.current['ArrowLeft']) orbit.yaw += orbitYawSpeed * delta;
        if (keys.current['ArrowRight']) orbit.yaw -= orbitYawSpeed * delta;
        if (keys.current['ArrowUp']) orbit.pitch = MathUtils.clamp(orbit.pitch - orbitPitchSpeed * delta, -1.2, 1.2);
        if (keys.current['ArrowDown']) orbit.pitch = MathUtils.clamp(orbit.pitch + orbitPitchSpeed * delta, -1.2, 1.2);
        if (keys.current['BracketLeft']) orbit.distance = MathUtils.clamp(orbit.distance - zoomSpeed * delta, 5, 60);
        if (keys.current['BracketRight']) orbit.distance = MathUtils.clamp(orbit.distance + zoomSpeed * delta, 5, 60);

        // Update camera to follow ship
        updateCameraFollow();

        // Sync ship position to store for sector map
        useGameStore.getState().setPosition({ x: ship.position.x, y: ship.position.y, z: ship.position.z });

        if (shipBodyRef.current) {
            const body = shipBodyRef.current;
            const p = ship.position;
            const q = ship.quaternion;
            body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
            body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        }

        // Docking Logic (Simplified)
        // Check distance to station (hardcoded position for now: [-100, 0, -200])
        const stationObj2 = scene.getObjectByName('Station') as Group | null;
        const dist = stationObj2 ? shipRef.current.position.distanceTo(new Vector3().setFromMatrixPosition(stationObj2.matrixWorld)) : Infinity;

        if (dist < 50 && speed < 10) {
            // Allow docking
            if (keys.current['KeyC']) { // 'C' to communicate/dock
                useGameStore.getState().setDocked(true);
                velocity.set(0, 0, 0);
            }
        }
    });

    return (
        <group ref={shipRef} name="PlayerShip" position={position}>
            <ShipModel enableLights={enableLights} />
            {/* External ship model could go here, but invisible from inside */}
        </group>
    );
};
