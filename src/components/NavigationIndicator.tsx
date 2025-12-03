import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

/**
 * NavigationIndicator renders:
 * 1. Corner brackets around the selected target (like XBTF selection indicators)
 * 2. Updates nav state in the store for the DOM-based off-screen arrow
 * 3. Distance readout below the target
 */
export const NavigationIndicator: React.FC = () => {
    const selectedTarget = useGameStore((s) => s.selectedTarget);
    const setNavIndicatorState = useGameStore((s) => s.setNavIndicatorState);
    const { camera, size } = useThree();
    const stateRef = useRef({
        screenPos: new THREE.Vector2(),
        distance: 0,
        isOnScreen: false,
        angle: 0,
        targetPos: new THREE.Vector3(),
    });

    useFrame(() => {
        if (!selectedTarget) {
            // Clear state when no target
            setNavIndicatorState({ screenX: 0, screenY: 0, distance: 0, isOnScreen: false, angle: 0 });
            return;
        }

        const targetPos = stateRef.current.targetPos;
        targetPos.set(
            selectedTarget.position[0],
            selectedTarget.position[1],
            selectedTarget.position[2]
        );

        // Get camera position
        const camPos = new THREE.Vector3();
        camera.getWorldPosition(camPos);

        // Calculate distance
        const distance = targetPos.distanceTo(camPos);
        stateRef.current.distance = distance;

        // Project target to screen space
        const projected = targetPos.clone().project(camera);

        // Check if target is in front of camera
        const toTarget = targetPos.clone().sub(camPos);
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const isBehind = toTarget.dot(camDir) < 0;

        // Convert to screen coordinates
        const x = (projected.x * 0.5 + 0.5) * size.width;
        const y = (1 - (projected.y * 0.5 + 0.5)) * size.height;

        stateRef.current.screenPos.set(x, y);

        // Check if on screen (with margin)
        const margin = 80;
        const onScreen =
            !isBehind &&
            x >= margin &&
            x <= size.width - margin &&
            y >= margin &&
            y <= size.height - margin;

        stateRef.current.isOnScreen = onScreen;

        // Calculate angle for off-screen arrow
        let angle = 0;
        if (!onScreen) {
            const centerX = size.width / 2;
            const centerY = size.height / 2;
            let targetX = x;
            let targetY = y;

            // If behind, flip the position
            if (isBehind) {
                targetX = size.width - x;
                targetY = size.height - y;
            }

            angle = Math.atan2(targetY - centerY, targetX - centerX);
            stateRef.current.angle = angle;
        }

        // Update store for DOM-based off-screen arrow
        setNavIndicatorState({
            screenX: x,
            screenY: y,
            distance,
            isOnScreen: onScreen,
            angle,
        });
    });

    if (!selectedTarget) return null;

    return (
        <TargetBrackets stateRef={stateRef} targetPosition={selectedTarget.position} />
    );
};

interface StateRef {
    current: {
        screenPos: THREE.Vector2;
        distance: number;
        isOnScreen: boolean;
        angle: number;
        targetPos: THREE.Vector3;
    };
}

const TargetBrackets: React.FC<{ stateRef: StateRef; targetPosition: [number, number, number] }> = ({ stateRef, targetPosition }) => {
    const ref = useRef<HTMLDivElement>(null);
    const selectedTarget = useGameStore((s) => s.selectedTarget);

    useFrame(() => {
        if (!ref.current) return;
        
        if (!stateRef.current.isOnScreen) {
            ref.current.style.display = 'none';
            return;
        }
        ref.current.style.display = 'block';

        // Update distance text
        const distText = ref.current.querySelector('.nav-distance') as HTMLElement;
        if (distText) {
            distText.textContent = formatDistance(stateRef.current.distance);
        }
    });

    if (!selectedTarget) return null;

    return (
        <Html
            position={targetPosition}
            center
            style={{ pointerEvents: 'none' }}
            zIndexRange={[100, 0]}
            occlude={false}
        >
            <div
                ref={ref}
                style={{
                    display: 'none',
                }}
            >
                {/* Corner brackets */}
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                    {/* Top-left bracket */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 16,
                            height: 16,
                            borderTop: '2px solid #00ffaa',
                            borderLeft: '2px solid #00ffaa',
                        }}
                    />
                    {/* Top-right bracket */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 16,
                            height: 16,
                            borderTop: '2px solid #00ffaa',
                            borderRight: '2px solid #00ffaa',
                        }}
                    />
                    {/* Bottom-left bracket */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            width: 16,
                            height: 16,
                            borderBottom: '2px solid #00ffaa',
                            borderLeft: '2px solid #00ffaa',
                        }}
                    />
                    {/* Bottom-right bracket */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 16,
                            height: 16,
                            borderBottom: '2px solid #00ffaa',
                            borderRight: '2px solid #00ffaa',
                        }}
                    />
                    {/* Center crosshair */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 8,
                            height: 8,
                            border: '1px solid rgba(0, 255, 170, 0.6)',
                            borderRadius: '50%',
                        }}
                    />
                </div>
                {/* Distance readout below */}
                <div
                    className="nav-distance"
                    style={{
                        position: 'absolute',
                        top: 88,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: '#00ffaa',
                        fontSize: 13,
                        fontFamily: 'monospace',
                        textShadow: '0 0 8px rgba(0, 255, 170, 0.5)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    0.00 km
                </div>
            </div>
        </Html>
    );
};

function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${meters.toFixed(0)} m`;
    } else {
        return `${(meters / 1000).toFixed(2)} km`;
    }
}

/**
 * OffScreenArrow - DOM-based component for rendering off-screen navigation arrows.
 * This component should be rendered outside the Canvas (in App.tsx or similar).
 */
export const OffScreenArrow: React.FC = () => {
    const selectedTarget = useGameStore((s) => s.selectedTarget);
    const navState = useGameStore((s) => s.navIndicatorState);

    if (!selectedTarget || navState.isOnScreen) return null;

    const margin = 60;
    const { angle, distance } = navState;

    // Calculate position on screen edge
    // We need to use window dimensions since we're outside Canvas
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Calculate intersection with screen boundaries
    const maxX = (width / 2 - margin) / Math.abs(cos || 0.001);
    const maxY = (height / 2 - margin) / Math.abs(sin || 0.001);
    const t = Math.min(maxX, maxY);

    const edgeX = centerX + cos * t;
    const edgeY = centerY + sin * t;

    const distanceText = distance < 1000 ? `${distance.toFixed(0)} m` : `${(distance / 1000).toFixed(2)} km`;

    return (
        <div
            style={{
                position: 'fixed',
                left: edgeX,
                top: edgeY,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 100,
            }}
        >
            {/* Arrow pointing to target */}
            <div
                style={{
                    width: 0,
                    height: 0,
                    borderLeft: '12px solid transparent',
                    borderRight: '12px solid transparent',
                    borderBottom: '24px solid #00ffaa',
                    filter: 'drop-shadow(0 0 6px rgba(0, 255, 170, 0.6))',
                    marginBottom: 6,
                    transform: `rotate(${angle}rad)`,
                }}
            />
            {/* Target name */}
            <div
                style={{
                    color: '#00ffaa',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    textShadow: '0 0 8px rgba(0, 255, 170, 0.5)',
                    whiteSpace: 'nowrap',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'center',
                    background: 'rgba(0, 20, 30, 0.7)',
                    padding: '2px 6px',
                    borderRadius: 3,
                }}
            >
                {selectedTarget.name}
            </div>
            {/* Distance */}
            <div
                style={{
                    color: '#80ffdd',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    marginTop: 2,
                }}
            >
                {distanceText}
            </div>
        </div>
    );
};
