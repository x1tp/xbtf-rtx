import { create } from 'zustand';

export interface NavTarget {
  name: string;
  position: [number, number, number];
  type: 'station' | 'gate' | 'ship' | 'planet' | 'asteroid';
}

export interface NavIndicatorState {
  screenX: number;
  screenY: number;
  distance: number;
  isOnScreen: boolean;
  angle: number;
}

interface GameState {
  speed: number;
  maxSpeed: number;
  throttle: number; // -reverseLimit to 1
  rotation: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  setPosition: (position: { x: number; y: number; z: number }) => void;
  isDocked: boolean;
  sunVisible: boolean;
  sunAdapt: number;
  sunIntensity: number;
  setSunVisible: (v: boolean) => void;
  setSunAdapt: (v: number) => void;
  setSunIntensity: (v: number) => void;

  // Time / SETA
  timeScale: number;
  setTimeScale: (scale: number) => void;

  // Navigation/Sector map
  sectorMapOpen: boolean;
  selectedTarget: NavTarget | null;
  navIndicatorState: NavIndicatorState;
  toggleSectorMap: () => void;
  setSectorMapOpen: (open: boolean) => void;
  setSelectedTarget: (target: NavTarget | null) => void;
  setNavIndicatorState: (state: NavIndicatorState) => void;

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
  sunVisible: false,
  sunAdapt: 0,
  sunIntensity: 0,

  timeScale: 1.0,
  setTimeScale: (scale) => set({ timeScale: scale }),

  // Navigation state
  sectorMapOpen: false,
  selectedTarget: null,
  navIndicatorState: { screenX: 0, screenY: 0, distance: 0, isOnScreen: false, angle: 0 },
  toggleSectorMap: () => set((state) => ({ sectorMapOpen: !state.sectorMapOpen })),
  setSectorMapOpen: (open) => set({ sectorMapOpen: open }),
  setSelectedTarget: (target) => set({ selectedTarget: target }),
  setNavIndicatorState: (state) => set({ navIndicatorState: state }),

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
  setPosition: (position) => set({ position }),

  setRotation: (rot) => set({ rotation: rot }),
  setDocked: (docked) => set({ isDocked: docked, speed: 0, throttle: 0 }),
  setSunVisible: (v) => set({ sunVisible: v }),
  setSunAdapt: (v) => set({ sunAdapt: Math.max(0, Math.min(1, v)) }),
  setSunIntensity: (v: number) => set({ sunIntensity: Math.max(0, Math.min(1, v)) }),
}));
