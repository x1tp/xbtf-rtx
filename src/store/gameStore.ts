import { create } from 'zustand';
import { SHIP_STATS } from '../config/ships';
import type { NPCFleet, SectorEvent, TradeLogEntry, SectorViewData, Corporation } from '../types/simulation';

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

export interface Station {
  id: string;
  name: string;
  recipeId: string;
  sectorId: string;
  inventory: Record<string, number>;
  reorderLevel: Record<string, number>;
  reserveLevel: Record<string, number>;
  productionProgress?: number;
}

export interface GameState {
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
  elapsedTimeSec: number;

  // Navigation/Sector map
  sectorMapOpen: boolean;
  universeMapOpen: boolean;
  stationInfoOpen: boolean;
  selectedTarget: NavTarget | null;
  selectedSectorId: string | null;
  currentSectorId: string | null;
  arrivalGate: 'N' | 'S' | 'W' | 'E' | null | undefined;
  navIndicatorState: NavIndicatorState;
  navObjects: NavTarget[];
  toggleSectorMap: () => void;
  setSectorMapOpen: (open: boolean) => void;
  toggleUniverseMap: () => void;
  setUniverseMapOpen: (open: boolean) => void;
  toggleStationInfo: () => void;
  setStationInfoOpen: (open: boolean) => void;
  setSelectedSectorId: (id: string | null) => void;
  setCurrentSectorId: (id: string | null) => void;
  setSectorTransition: (id: string, arrivalGate?: 'N' | 'S' | 'W' | 'E') => void;
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
  stations: Station[];
  sectorPrices: Record<string, Record<string, number>>;
  initEconomy: () => void;
  tickEconomy: (deltaSec: number) => void;
  syncEconomy: () => Promise<void>;

  // Fleet simulation state
  corporations: Corporation[];
  fleets: NPCFleet[];
  activeEvents: SectorEvent[];
  tradeLog: TradeLogEntry[];
  syncFleets: () => Promise<void>;
  getSectorView: (sectorId: string) => SectorViewData | null;
  getCorporation: (id: string) => Corporation | undefined;
  
  // Ship autonomy - reports from frontend ships to backend
  reportShipAction: (fleetId: string, type: string, data: {
    sectorId: string;
    position: [number, number, number];
    stationId?: string;
    wareId?: string;
    amount?: number;
  }) => Promise<void>;
}

export const useGameStore = create<GameState>((set) => ({
  speed: 0,
  maxSpeed: SHIP_STATS['player'].maxSpeed, // m/s
  throttle: 0,
  rotation: { x: 0, y: 0, z: 0 },
  position: { x: 0, y: 0, z: 0 },
  isDocked: false,
  sunVisible: false,
  sunAdapt: 0,
  sunIntensity: 0,

  timeScale: 1.0,
  elapsedTimeSec: 0,
  setTimeScale: (scale) => {
    set({ timeScale: scale })
    fetch(`/__universe/time-scale?value=${encodeURIComponent(scale)}`, { method: 'POST' })
  },

  // Navigation state
  sectorMapOpen: false,
  universeMapOpen: false,
  stationInfoOpen: false,
  selectedTarget: null,
  selectedSectorId: null,
  currentSectorId: 'seizewell',
  arrivalGate: null,
  navIndicatorState: { screenX: 0, screenY: 0, distance: 0, isOnScreen: false, angle: 0 },
  navObjects: [],
  toggleSectorMap: () => set((state) => ({ sectorMapOpen: !state.sectorMapOpen })),
  setSectorMapOpen: (open) => set({ sectorMapOpen: open }),
  toggleUniverseMap: () => set((state) => ({ universeMapOpen: !state.universeMapOpen })),
  setUniverseMapOpen: (open) => set({ universeMapOpen: open }),
  toggleStationInfo: () => set((state) => ({ stationInfoOpen: !state.stationInfoOpen })),
  setStationInfoOpen: (open) => set({ stationInfoOpen: open }),
  setSelectedSectorId: (id) => set({ selectedSectorId: id }),
  setCurrentSectorId: (id) => set({ currentSectorId: id }),
  setSectorTransition: (id, gate) => set({ currentSectorId: id, arrivalGate: gate }),
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
      set({ 
        wares: data.wares || [], 
        recipes: data.recipes || [], 
        stations: data.stations || [], 
        sectorPrices: data.sectorPrices || {}, 
        timeScale: typeof data.timeScale === 'number' ? data.timeScale : 1,
        elapsedTimeSec: typeof data.elapsedTimeSec === 'number' ? data.elapsedTimeSec : 0,
        corporations: data.corporations || [],
        fleets: data.fleets || [],
        activeEvents: data.activeEvents || [],
        tradeLog: data.tradeLog || [],
      })
    } catch {
      set(() => ({}))
    }
  },

  // Fleet state
  corporations: [],
  fleets: [],
  activeEvents: [],
  tradeLog: [],
  
  syncFleets: async () => {
    try {
      const res = await fetch('/__universe/fleets')
      const data = await res.json()
      set({ 
        corporations: data.corporations || [],
        fleets: data.fleets || [],
        activeEvents: data.activeEvents || [],
        tradeLog: data.tradeLog || [],
      })
    } catch {
      // Fleets not available yet
    }
  },

  getSectorView: (sectorId: string): SectorViewData | null => {
    const state = useGameStore.getState()
    const { fleets, tradeLog } = state
    
    // Get fleets in this sector (include in-transit so they still render on the map)
    const sectorFleets = fleets.filter(f => 
      f.currentSectorId === sectorId
    )
    
    // Get fleets in transit to/from this sector
    const inTransit = fleets.filter(f => 
      f.state === 'in-transit' && 
      (f.currentSectorId === sectorId || f.destinationSectorId === sectorId)
    )
    
    // Calculate stats
    const stats = {
      totalFleets: sectorFleets.length,
      fleetsLoading: sectorFleets.filter(f => f.state === 'loading').length,
      fleetsUnloading: sectorFleets.filter(f => f.state === 'unloading').length,
      fleetsIdle: sectorFleets.filter(f => f.state === 'idle').length,
      incomingFleets: inTransit.filter(f => f.destinationSectorId === sectorId).length,
      outgoingFleets: inTransit.filter(f => f.currentSectorId === sectorId).length,
    }
    
    // Recent trades in this sector
    const recentTrades = tradeLog
      .filter(t => t.buySectorId === sectorId || t.sellSectorId === sectorId)
      .slice(0, 10)
    
    return {
      sectorId,
      sectorName: sectorId, // TODO: lookup proper name
      fleets: sectorFleets.map(f => ({
        id: f.id,
        name: f.name,
        shipType: f.shipType,
        modelPath: f.modelPath,
        owner: f.ownerId || f.race,
        position: f.position,
        state: f.state,
        targetStationName: f.targetStationId,
        cargo: f.cargo,
        cargoValue: Object.entries(f.cargo).reduce((sum, [wareId, qty]) => {
          const ware = state.wares.find(w => w.id === wareId)
          return sum + (ware?.basePrice || 0) * qty
        }, 0),
      })),
      fleetsInTransit: inTransit.map(f => {
        const now = Date.now()
        const total = (f.arrivalTime || now) - (f.departureTime || now)
        const elapsed = now - (f.departureTime || now)
        return {
          id: f.id,
          name: f.name,
          fromSectorId: f.currentSectorId,
          fromSectorName: f.currentSectorId,
          toSectorId: f.destinationSectorId || '',
          toSectorName: f.destinationSectorId || '',
          progress: total > 0 ? Math.min(1, elapsed / total) : 0,
          etaSeconds: Math.max(0, ((f.arrivalTime || now) - now) / 1000),
          direction: f.destinationSectorId === sectorId ? 'incoming' as const : 'outgoing' as const,
        }
      }),
      stats,
      recentTrades,
    }
  },

  getCorporation: (id: string) => {
    return useGameStore.getState().corporations.find(c => c.id === id)
  },
  
  // Report ship actions to backend for autonomous ships
  reportShipAction: async (fleetId: string, type: string, data: {
    sectorId: string;
    position: [number, number, number];
    stationId?: string;
    wareId?: string;
    amount?: number;
  }) => {
    try {
      await fetch('/__universe/ship-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fleetId,
          type,
          ...data,
          timestamp: Date.now()
        })
      })
    } catch (err) {
      console.warn('[gameStore] Failed to report ship action:', err)
    }
  },
}));
