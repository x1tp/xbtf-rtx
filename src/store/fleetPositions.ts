import { useEffect, useState } from 'react';

// Mutable registry for high-frequency updates to avoid React/Zustand overhead
export const fleetPositionRegistry: Record<string, [number, number, number]> = {};

export const updateFleetPosition = (id: string, position: [number, number, number]) => {
    fleetPositionRegistry[id] = position;
};

export const getFleetPosition = (id: string) => fleetPositionRegistry[id];

// Hook to force re-render at a fixed rate to visualize updates
export const useFleetPositions = (fps: number = 30) => {
    const [, setTick] = useState(0);

    useEffect(() => {
        let lastTime = performance.now();
        let frameId: number;
        const interval = 1000 / fps;

        const loop = (time: number) => {
            if (time - lastTime > interval) {
                setTick(t => t + 1);
                lastTime = time;
            }
            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, [fps]);

    return fleetPositionRegistry;
};
