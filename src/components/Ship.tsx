import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, MathUtils, Quaternion } from 'three';
import { useGameStore } from '../store/gameStore';
import { Cockpit } from './Cockpit';

interface ShipProps {
    enableLights?: boolean;
}

export const Ship: React.FC<ShipProps> = ({ enableLights = true }) => {
    const shipRef = useRef<Group | null>(null);
    const { camera } = useThree();

    const speed = useGameStore((state) => state.speed);
    const maxSpeed = useGameStore((state) => state.maxSpeed);
    const updateSpeed = useGameStore((state) => state.updateSpeed);
    const setThrottle = useGameStore((state) => state.setThrottle);
    const throttle = useGameStore((state) => state.throttle);
    const velocityRef = useRef(new Vector3());
    const initializedRef = useRef(false);

    // Input state
    const keys = useRef<{ [key: string]: boolean }>({});
    const mouse = useRef({ x: 0, y: 0 });
    const orbitRef = useRef({ yaw: 0, pitch: -0.45, distance: 40, target: 'center' as 'center' | 'forward' });
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

        // Translational movement with simple flight-assist drift compensation
        const reverseSpeedScale = 0.35; // reverse is intentionally slower
        const targetForwardSpeed = throttle >= 0
            ? -throttle * maxSpeed
            : -throttle * maxSpeed * reverseSpeedScale;

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

        ship.translateX(velocity.x * delta);
        ship.translateZ(velocity.z * delta);

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

        const forward = new Vector3(0, 0, -1).applyQuaternion(ship.quaternion).normalize();
        const up = new Vector3(0, 1, 0).applyQuaternion(ship.quaternion);
        const right = new Vector3().crossVectors(forward, up).normalize();
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
            camera.lookAt(lookTarget);
            initializedRef.current = true;
        } else {
            camera.position.lerp(desired, t);
            camera.lookAt(lookTarget);
        }

        // Docking Logic (Simplified)
        // Check distance to station (hardcoded position for now: [-100, 0, -200])
        const stationPos = new Vector3(-100, 0, -200);
        const dist = shipRef.current.position.distanceTo(stationPos);

        if (dist < 50 && speed < 10) {
            // Allow docking
            if (keys.current['KeyC']) { // 'C' to communicate/dock
                useGameStore.getState().setDocked(true);
                velocity.set(0, 0, 0);
            }
        }
    });

    return (
        <group ref={shipRef} name="PlayerShip">
            <Cockpit enableLights={enableLights} />
            {/* External ship model could go here, but invisible from inside */}
        </group>
    );
};
