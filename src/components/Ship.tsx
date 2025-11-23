import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, MathUtils, Quaternion, Box3, Raycaster, Matrix3, Quaternion as TQuaternion } from 'three';
import type { InstancedMesh } from 'three';
import { ensureRapier, getWorld } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import { useGameStore } from '../store/gameStore';
import { Cockpit } from './Cockpit';

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
    const velocityRef = useRef(new Vector3());
    const planetRadiusRef = useRef(0);
    const stationRadiusRef = useRef(0);
    const shipHalfExtentsRef = useRef(new Vector3(1, 1, 1));
    const shipBodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const initializedRef = useRef(false);

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
            shipHalfExtentsRef.current.set(s.x * 0.5, s.y * 0.5, s.z * 0.5).multiplyScalar(0.9);
        }
        (async () => {
            const RAPIER = await ensureRapier();
            const world = await getWorld();
            const rbDesc = RAPIER.RigidBodyDesc.kinematicVelocityBased();
            const body = world.createRigidBody(rbDesc);
            const he = shipHalfExtentsRef.current;
            const collDesc = RAPIER.ColliderDesc.cuboid(he.x, he.y, he.z)
                .setFriction(0.6)
                .setRestitution(0.2);
            world.createCollider(collDesc, body);
            shipBodyRef.current = body;
        })();
    }, [scene]);

    useFrame((state, delta) => {
        void state;
        if (!shipRef.current) return;
        const ship = shipRef.current;
        const velocity = velocityRef.current;
        const orbit = orbitRef.current;

        // Input-driven throttle changes
        if (keys.current['KeyW']) {
            setThrottle(throttle + delta * 0.5);
            brakeRef.current = false;
        } else if (keys.current['KeyS']) {
            setThrottle(throttle - delta * 0.5);
            brakeRef.current = false;
        } else if (brakeRef.current) {
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
        if (keys.current['KeyQ']) rotationChange.z = rollSpeed * delta;
        if (keys.current['KeyE']) rotationChange.z = -rollSpeed * delta;

        // Apply rotation in local space so controls stay aligned after rolling
        if (rotationChange.x !== 0) ship.rotateX(rotationChange.x);
        if (rotationChange.y !== 0) ship.rotateY(rotationChange.y);
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

        const stationObj = scene.getObjectByName('Station') as Group | null;
        let collided = false;
        if (stationObj && move.lengthSq() > 0) {
            const dir = move.clone().normalize();
            const rc = new Raycaster(origin, dir, 0, move.length() + 2);
            const hits = rc.intersectObject(stationObj, true);
            if (hits.length > 0) {
                const hit = hits[0];
                const n = hit.face?.normal?.clone() || dir.clone().multiplyScalar(-1);
                const wn = n.clone().applyMatrix3(new Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
                const invQ = ship.quaternion.clone().invert();
                const nLocal = wn.clone().applyQuaternion(invQ as unknown as TQuaternion);
                const he = shipHalfExtentsRef.current;
                const support = Math.abs(nLocal.x) * he.x + Math.abs(nLocal.y) * he.y + Math.abs(nLocal.z) * he.z;
                const separation = support + 0.5;
                const adjusted = hit.point.clone().add(wn.clone().multiplyScalar(separation));
                ship.position.copy(adjusted);
                const vn = wn.clone().multiplyScalar(velocity.dot(wn));
                velocity.sub(vn).multiplyScalar(0.85);
                collided = true;
            }
        }

        if (!collided) {
            const ast = scene.getObjectByName('AsteroidField') as Group | null;
            type AsteroidUserData2 = { positions?: Vector3[]; scales?: number[] };
            const astMesh2 = ast as InstancedMesh | null;
            const ud2 = astMesh2 ? (astMesh2.userData as AsteroidUserData2) : undefined;
            const positions2 = ud2?.positions;
            const scales2 = ud2?.scales;
            if (positions2 && scales2 && move.lengthSq() > 0) {
                const dir = move.clone().normalize();
                const moveLen = move.length();
                let tHit = Infinity;
                let contactNormal: Vector3 | null = null;
                for (let i = 0; i < positions2.length; i++) {
                    const c = positions2[i];
                    const r = scales2[i] ?? 1;
                    const L = origin.clone().sub(c);
                    const nApprox = L.length() > 0 ? L.clone().normalize() : dir.clone().multiplyScalar(-1);
                    const invQ = ship.quaternion.clone().invert();
                    const nLocal = nApprox.clone().applyQuaternion(invQ as unknown as TQuaternion);
                    const he = shipHalfExtentsRef.current;
                    const support = Math.abs(nLocal.x) * he.x + Math.abs(nLocal.y) * he.y + Math.abs(nLocal.z) * he.z;
                    const radius = r + support;
                    const b = L.dot(dir);
                    const c0 = L.dot(L) - radius * radius;
                    const disc = b * b - c0;
                    if (disc >= 0) {
                        const t = -b - Math.sqrt(disc);
                        if (t >= 0 && t <= moveLen && t < tHit) {
                            tHit = t;
                            const contact = origin.clone().add(dir.clone().multiplyScalar(t));
                            contactNormal = contact.clone().sub(c).normalize();
                        }
                    }
                }
                if (tHit !== Infinity && contactNormal) {
                    const epsilon = 0.05;
                    const newPos = origin.clone().add(dir.clone().multiplyScalar(Math.max(0, tHit - epsilon)));
                    ship.position.copy(newPos);
                    const n = contactNormal.clone().normalize();
                    const vn = n.clone().multiplyScalar(velocity.dot(n));
                    velocity.sub(vn).multiplyScalar(0.9);
                    collided = true;
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

        const st = scene.getObjectByName('Station') as Group | null;
        if (st) {
            const c = new Vector3();
            st.getWorldPosition(c);
            const v2 = ship.position.clone().sub(c);
            const d2 = v2.length();
            const rr = stationRadiusRef.current;
            if (rr > 0 && d2 < rr) {
                const n2 = v2.normalize();
                ship.position.copy(c.clone().add(n2.multiplyScalar(rr)));
                velocity.multiplyScalar(0.6);
            }
        }

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

        const base = forward.clone().multiplyScalar(-orbit.distance);
        const qYaw = new Quaternion().setFromAxisAngle(up, orbit.yaw);
        const qPitch = new Quaternion().setFromAxisAngle(right, orbit.pitch);
        const offset = base.clone().applyQuaternion(qYaw).applyQuaternion(qPitch);
        const desired = ship.position.clone().add(offset);
        const lookTarget = orbit.target === 'center'
            ? ship.position.clone()
            : ship.position.clone().add(forward.clone().multiplyScalar(50));
        const t = 1 - Math.exp(-5 * delta);
        if (!initializedRef.current) {
            camera.position.copy(desired);
            camera.up.copy(up);
            camera.lookAt(lookTarget);
            initializedRef.current = true;
        } else {
            camera.position.lerp(desired, t);
            camera.up.copy(up);
            camera.lookAt(lookTarget);
        }

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
            <Cockpit enableLights={enableLights} />
            {/* External ship model could go here, but invisible from inside */}
        </group>
    );
};
