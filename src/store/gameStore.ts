import { create } from 'zustand';

export interface NavTarget {
  name: string;
  position: [number, number, number];
  type: 'station' | 'gate' | 'ship' | 'planet' | 'asteroid';
  targetSectorId?: string;
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
  universeMapOpen: boolean;
  selectedTarget: NavTarget | null;
  selectedSectorId: string | null;
  currentSectorId: string | null;
  navIndicatorState: NavIndicatorState;
  navObjects: NavTarget[];
  toggleSectorMap: () => void;
  setSectorMapOpen: (open: boolean) => void;
  toggleUniverseMap: () => void;
  setUniverseMapOpen: (open: boolean) => void;
  setSelectedSectorId: (id: string | null) => void;
  setCurrentSectorId: (id: string | null) => void;
  setSelectedTarget: (target: NavTarget | null) => void;
  setNavIndicatorState: (state: NavIndicatorState) => void;
  setNavObjects: (objects: NavTarget[]) => void;
  upsertNavObject: (obj: NavTarget) => void;

  setThrottle: (throttle: number) => void;
  updateSpeed: (speed?: number) => void;
  updatePosition: () => void;
  setRotation: (rotation: { x: number; y: number; z: number }) => void;
  setDocked: (docked: boolean) => void;

  wares: { id: string; name: string; category: 'primary' | 'food' | 'intermediate' | 'end'; basePrice: number; volume: number }[];
  recipes: { id: string; productId: string; inputs: { wareId: string; amount: number }[]; cycleTimeSec: number; batchSize: number; productStorageCap: number }[];
  stations: { id: string; name: string; recipeId: string; sectorId: string; inventory: Record<string, number>; reorderLevel: Record<string, number>; reserveLevel: Record<string, number> }[];
  sectorPrices: Record<string, Record<string, number>>;
  initEconomy: () => void;
  tickEconomy: (deltaSec: number) => void;
  syncEconomy: () => Promise<void>;
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
  setTimeScale: (scale) => {
    set({ timeScale: scale })
    fetch(`/__universe/time-scale?value=${encodeURIComponent(scale)}`, { method: 'POST' })
  },

  // Navigation state
  sectorMapOpen: false,
  universeMapOpen: false,
  selectedTarget: null,
  selectedSectorId: null,
  currentSectorId: 'seizewell',
  navIndicatorState: { screenX: 0, screenY: 0, distance: 0, isOnScreen: false, angle: 0 },
  navObjects: [],
  toggleSectorMap: () => set((state) => ({ sectorMapOpen: !state.sectorMapOpen })),
  setSectorMapOpen: (open) => set({ sectorMapOpen: open }),
  toggleUniverseMap: () => set((state) => ({ universeMapOpen: !state.universeMapOpen })),
  setUniverseMapOpen: (open) => set({ universeMapOpen: open }),
  setSelectedSectorId: (id) => set({ selectedSectorId: id }),
  setCurrentSectorId: (id) => set({ currentSectorId: id }),
  setSelectedTarget: (target) => set({ selectedTarget: target }),
  setNavIndicatorState: (state) => set({ navIndicatorState: state }),
  setNavObjects: (objects) => set({ navObjects: objects }),
  upsertNavObject: (obj) =>
    set((state) => {
      const next = [...state.navObjects];
      const idx = next.findIndex((o) => o.name === obj.name && o.type === obj.type);
      if (idx >= 0) {
        next[idx] = obj;
      } else {
        next.push(obj);
      }
      const selectedTarget =
        state.selectedTarget && state.selectedTarget.name === obj.name && state.selectedTarget.type === obj.type
          ? { ...state.selectedTarget, position: obj.position }
          : state.selectedTarget;
      return { navObjects: next, selectedTarget };
    }),

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

  wares: [],
  recipes: [],
  stations: [],
  sectorPrices: {},
  initEconomy: () => {
    fetch('/__universe/init', { method: 'POST' }).then(() => {
      const sync = useGameStore.getState().syncEconomy
      return sync()
    })
  },
  tickEconomy: (deltaSec) => {
    fetch(`/__universe/tick?delta=${encodeURIComponent(deltaSec)}`, { method: 'POST' }).then(() => {
      const sync = useGameStore.getState().syncEconomy
      return sync()
    })
  },
  syncEconomy: async () => {
    try {
      const res = await fetch('/__universe/state')
      const data = await res.json()
      set({ wares: data.wares || [], recipes: data.recipes || [], stations: data.stations || [], sectorPrices: data.sectorPrices || {}, timeScale: typeof data.timeScale === 'number' ? data.timeScale : 1 })
    } catch {
      set(() => ({}))
    }
  },
}));
