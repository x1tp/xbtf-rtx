import { create } from 'zustand';

interface GameState {
  speed: number;
  maxSpeed: number;
  throttle: number; // -reverseLimit to 1
  rotation: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  isDocked: boolean;

  setThrottle: (throttle: number) => void;
  updateSpeed: (speed?: number) => void;
  updatePosition: () => void;
  setRotation: (rotation: { x: number; y: number; z: number }) => void;
  setDocked: (docked: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  speed: 0,
  maxSpeed: 50, // m/s
  throttle: 0,
  rotation: { x: 0, y: 0, z: 0 },
  position: { x: 0, y: 0, z: 0 },
  isDocked: false,

  setThrottle: (val) => {
    const minReverse = -0.3; // allow gentle reverse
    set({ throttle: Math.max(minReverse, Math.min(1, val)) });
  },

  updateSpeed: (speedOverride) =>
    set((state) => {
      if (state.isDocked) return { speed: 0 }; // No movement while docked
      if (typeof speedOverride === 'number') {
        return { speed: Math.max(0, speedOverride) };
      }

      const reverseScaler = 0.35;
      const targetSpeed =
        state.throttle >= 0
          ? state.throttle * state.maxSpeed
          : Math.abs(state.throttle) * state.maxSpeed * reverseScaler;

      // Simple linear interpolation for acceleration/deceleration
      const newSpeed = state.speed + (targetSpeed - state.speed) * 0.02;
      return { speed: newSpeed };
    }),

  updatePosition: () => set(() => ({})),

  setRotation: (rot) => set({ rotation: rot }),
  setDocked: (docked) => set({ isDocked: docked, speed: 0, throttle: 0 }),
}));
