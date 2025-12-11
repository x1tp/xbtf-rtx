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
    const isTargetViewRef = useRef(false);
    const targetOrbitRef = useRef({ yaw: 0, pitch: 0.2, distance: 800 });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keys.current[e.code] = true;
            if (e.code === 'KeyT') {
                const o = orbitRef.current;
                o.target = o.target === 'center' ? 'forward' : 'center';
            }
            if (e.code === 'F3') {
                // Prevent the browser's built-in find dialog so F3 can be used for target view
                e.preventDefault();
                e.stopPropagation();
                const target = useGameStore.getState().selectedTarget;
                if (target) {
                    isTargetViewRef.current = !isTargetViewRef.current;
                    // Reset zoom when opening target view to a dynamic distance
                    if (isTargetViewRef.current) {
                        const tObj = scene.getObjectByName('Station'); // Currently only station or planet are targets
                        let radius = 100;
                        if (tObj) {
                            const box = new Box3().setFromObject(tObj);
                            const s = box.getSize(new Vector3());
                            radius = Math.max(s.x, s.y, s.z) * 0.5;
                        }
                        // Start at 2.5x the radius for a good view
                        targetOrbitRef.current.distance = radius * 2.5;
                    }
                }
            }
            if (e.code === 'KeyM') {
                const state = useGameStore.getState();
                if (!state.sectorMapOpen) {
                    state.setSelectedSectorId(null);
                }
                state.toggleSectorMap();
            }
            if (e.code === 'KeyU') {
                useGameStore.getState().toggleUniverseMap();
            }
            if (e.code === 'KeyI') {
                const target = useGameStore.getState().selectedTarget;
                if (target && target.type === 'station') {
                    useGameStore.getState().toggleStationInfo();
                }
            }
            if (e.code === 'KeyJ') {
                const current = useGameStore.getState().timeScale;
                // Toggle between 1x and 10x
                useGameStore.getState().setTimeScale(current === 1.0 ? 30.0 : 1.0);
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

            if (isTargetViewRef.current && lmbDownRef.current) {
                const orbit = targetOrbitRef.current;
                const sensitivity = 0.005;
                orbit.yaw -= e.movementX * sensitivity;
                orbit.pitch = MathUtils.clamp(orbit.pitch + e.movementY * sensitivity, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
            }
        };
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) lmbDownRef.current = true;
        };
        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 0) lmbDownRef.current = false;
        };
        const handleWheel = (e: WheelEvent) => {
            if (isTargetViewRef.current) {
                const orbit = targetOrbitRef.current;
                const zoomSpeed = 0.5;
                orbit.distance = MathUtils.clamp(orbit.distance + e.deltaY * zoomSpeed, 20, 4000);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('wheel', handleWheel);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [scene]);

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
            const base = new Vector3(s.x * 0.5, s.y * 0.5, s.z * 0.5).multiplyScalar(0.95);
            shipHalfExtentsRef.current.set(
                Math.max(8.0, base.x),
                Math.max(3.0, base.y),
                Math.max(10.0, base.z)
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
            const controller = world.createCharacterController(0.5);
            controller.setApplyImpulsesToDynamicBodies(true);
            // controller.setUp({ x: 0, y: 0, z: 0 }); // Reverted to default for better wall blocking
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
            console.log('Ship physics initialized. HalfExtents:', he, 'Hull:', !!hullColliderRef.current, 'Offset: 0.5, FreeFlight: OFF, DefaultSize: LARGE');
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

        // Target view (F3)
        if (isTargetViewRef.current) {
            const target = useGameStore.getState().selectedTarget;
            if (!target) {
                isTargetViewRef.current = false;
            } else {
                // Try to get the actual 3D object position for smooth following
                // Fall back to store position if object not found
                let tPos: Vector3;
                const targetObj = scene.getObjectByName(target.name);
                if (targetObj) {
                    tPos = new Vector3();
                    targetObj.getWorldPosition(tPos);
                } else {
                    tPos = new Vector3(target.position[0], target.position[1], target.position[2]);
                }
                const orbit = targetOrbitRef.current;
                const orbitYawSpeed = 1.8;
                const orbitPitchSpeed = 1.2;
                const zoomSpeed = 50;

                if (keys.current['ArrowLeft']) orbit.yaw += orbitYawSpeed * delta;
                if (keys.current['ArrowRight']) orbit.yaw -= orbitYawSpeed * delta;
                if (keys.current['ArrowUp']) orbit.pitch = MathUtils.clamp(orbit.pitch - orbitPitchSpeed * delta, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
                if (keys.current['ArrowDown']) orbit.pitch = MathUtils.clamp(orbit.pitch + orbitPitchSpeed * delta, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
                if (keys.current['BracketLeft']) orbit.distance = MathUtils.clamp(orbit.distance - zoomSpeed * delta, 20, 2000);
                if (keys.current['BracketRight']) orbit.distance = MathUtils.clamp(orbit.distance + zoomSpeed * delta, 20, 2000);

                const qYaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), orbit.yaw);
                const qPitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), orbit.pitch);
                // Apply yaw first (horizontal), then pitch (vertical)
                // Note: order matters for typical orbit camera feel
                const offset = new Vector3(0, 0, orbit.distance).applyQuaternion(qPitch).applyQuaternion(qYaw);

                const camPos = tPos.clone().add(offset);
                camera.position.copy(camPos);
                camera.lookAt(tPos);
                return;
            }
        }

        // Skip all ship controls when sector map or universe map is open OR docked
        const sectorMapOpen = useGameStore.getState().sectorMapOpen;
        const universeMapOpen = useGameStore.getState().universeMapOpen;
        const isDocked = useGameStore.getState().isDocked;
        if (sectorMapOpen || universeMapOpen || isDocked) {
            // Still update camera to follow ship, but no input processing
            // If docked, we might want to kill velocity too to prevent drifting while trading
            if (isDocked) velocity.set(0, 0, 0);
            updateCameraFollow();
            return;
        }

        // Input-driven throttle changes
        if (keys.current['KeyZ']) {
            if (timeScale > 1.0) setTimeScale(1.0);
            setThrottle(throttle + delta * 0.5);
            brakeRef.current = false;
        } else if (keys.current['KeyX']) {
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

        const strafeXInput = (keys.current['KeyD'] ? 1 : 0) - (keys.current['KeyA'] ? 1 : 0);
        const strafeYInput = (keys.current['KeyW'] ? 1 : 0) - (keys.current['KeyS'] ? 1 : 0);

        const maxStrafeSpeed = maxSpeed * 0.6;
        const strafeXTarget = strafeXInput * maxStrafeSpeed;
        const strafeYTarget = strafeYInput * maxStrafeSpeed;

        if (strafeXInput !== 0) {
            velocity.x = MathUtils.damp(velocity.x, strafeXTarget, 10, delta);
        } else {
            velocity.x = MathUtils.damp(velocity.x, 0, 4, delta); // counter-drift when no strafe input
        }

        if (strafeYInput !== 0) {
            velocity.y = MathUtils.damp(velocity.y, strafeYTarget, 10, delta);
        } else {
            velocity.y = MathUtils.damp(velocity.y, 0, 4, delta);
        }

        const moveX = velocity.x * delta;
        const moveY = velocity.y * delta;
        const moveZ = velocity.z * delta;
        const move = new Vector3()
            .copy(right).multiplyScalar(moveX)
            .add(new Vector3().copy(up).multiplyScalar(moveY))
            .add(new Vector3().copy(forward).multiplyScalar(moveZ));
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

                // Check if we were obstructed (result differs from intended move)
                collided = (Math.abs(result.x - move.x) + Math.abs(result.y - move.y) + Math.abs(result.z - move.z)) > 1e-4;

                if (collided) {
                    // Update local velocity to match the actual World Space movement
                    // This prevents "pushing" - if we stopped, our velocity should become 0
                    const actualMove = new Vector3(result.x, result.y, result.z);
                    const actualVel = actualMove.divideScalar(delta); // World space velocity

                    // Project back to local space
                    velocity.x = actualVel.dot(right);
                    velocity.y = actualVel.dot(up);
                    velocity.z = actualVel.dot(forward);

                    // console.log('Collision corrected velocity:', velocity);
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

        // Docking Logic (Robust)
        // Check distance to any station in the current sector
        const stations = useGameStore.getState().stations;
        const currentSectorId = useGameStore.getState().currentSectorId;
        const shipPos = shipRef.current.position;

        let nearestStationId: string | null = null;
        let nearestDist = Infinity;

        // Optimization: Filter logic inside frame loop - should be fast enough for < 100 stations
        for (const st of stations) {
            if (st.sectorId !== currentSectorId) continue;
            // Station positions are [x,y,z] tuple
            const d = Math.sqrt(
                Math.pow(shipPos.x - st.position[0], 2) +
                Math.pow(shipPos.y - st.position[1], 2) +
                Math.pow(shipPos.z - st.position[2], 2)
            );
            if (d < nearestDist) {
                nearestDist = d;
                nearestStationId = st.id;
            }
        }

        const DOCK_DIST = 600; // Increased range
        const DOCK_SPEED = 50; // Increased allowance

        if (nearestStationId && nearestDist < DOCK_DIST && speed < DOCK_SPEED) {
            // Allow docking
            // TODO: Ideally verify ship is facing docking buy/light? For now, distance check.
            if (keys.current['KeyC']) { // 'C' to communicate/dock
                useGameStore.getState().setDocked(true, nearestStationId);
                velocity.set(0, 0, 0);
            }
        }
    });

    return (
        <group ref={shipRef} name="PlayerShip" position={position}>
            <ShipModel enableLights={enableLights} modelPath="/models/00124.obj" throttle={throttle} />
            {/* External ship model could go here, but invisible from inside */}
        </group>
    );
};
