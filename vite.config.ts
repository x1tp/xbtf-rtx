import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import react from '@vitejs/plugin-react'

type Ware = { id: string; name: string; category: 'primary' | 'food' | 'intermediate' | 'end'; basePrice: number; volume: number }
type Recipe = { id: string; productId: string; inputs: { wareId: string; amount: number }[]; cycleTimeSec: number; batchSize: number; productStorageCap: number }
type Station = { id: string; name: string; recipeId: string; sectorId: string; inventory: Record<string, number>; reorderLevel: Record<string, number>; reserveLevel: Record<string, number>; productionProgress?: number }

// Fleet and Corporation types (mirroring simulation.ts but inline for vite backend)
type FleetState = 'idle' | 'loading' | 'in-transit' | 'unloading' | 'docking' | 'undocking'
type OwnershipType = 'corporation' | 'guild' | 'family' | 'state' | 'independent' | 'player'
type FleetBehavior = 'station-supply' | 'station-distribute' | 'corp-logistics' | 'guild-assigned' | 'freelance' | 'player-manual' | 'player-auto'
type RaceType = 'argon' | 'boron' | 'paranid' | 'split' | 'teladi' | 'pirate' | 'xenon'

// Ship command types for autonomous ships
type ShipCommandType = 'goto-station' | 'dock' | 'load-cargo' | 'unload-cargo' | 'undock' | 'goto-gate' | 'use-gate' | 'patrol' | 'wait'
type ShipCommand = {
  id: string
  type: ShipCommandType
  targetStationId?: string
  targetSectorId?: string
  wareId?: string
  amount?: number
  createdAt: number
}

type TradeOrder = {
  id: string
  buyStationId: string; buyStationName: string; buySectorId: string
  buyWareId: string; buyWareName: string; buyQty: number; buyPrice: number
  sellStationId: string; sellStationName: string; sellSectorId: string
  sellWareId: string; sellWareName: string; sellQty: number; sellPrice: number
  expectedProfit: number; createdAt: number
}

type NPCFleet = {
  id: string; name: string; shipType: string; modelPath: string; race: RaceType; capacity: number; speed: number; homeSectorId: string
  ownerId: string | null; ownerType: OwnershipType; homeStationId?: string; behavior: FleetBehavior; autonomy: number; profitShare: number
  currentSectorId: string; position: [number, number, number]; state: FleetState; stateStartTime: number
  destinationSectorId?: string
  cargo: Record<string, number>; credits: number; currentOrder?: TradeOrder; targetStationId?: string
  // Autonomous ship command queue
  commandQueue: ShipCommand[]; currentCommand?: ShipCommand
  totalProfit: number; tripsCompleted: number
}

type Corporation = {
  id: string; name: string; race: RaceType; type: OwnershipType
  stationIds: string[]; fleetIds: string[]
  credits: number; netWorth: number
  aggressiveness: number; expansionBudget: number; riskTolerance: number
  lifetimeProfit: number; lifetimeTrades: number
}

type TradeLogEntry = {
  id: string; timestamp: number; fleetId: string; fleetName: string
  wareId: string; wareName: string; quantity: number
  buyPrice: number; sellPrice: number; profit: number
  buySectorId: string; sellSectorId: string
  buyStationName: string; sellStationName: string
}

type UniverseState = {
  wares: Ware[]; recipes: Recipe[]; stations: Station[]; sectorPrices: Record<string, Record<string, number>>; timeScale: number; acc: number
  // Fleet simulation
  corporations: Corporation[]; fleets: NPCFleet[]; tradeLog: TradeLogEntry[]; lastTickTime: number
}

function createUniverse() {
  const state: UniverseState = { wares: [], recipes: [], stations: [], sectorPrices: {}, timeScale: 1, acc: 0, corporations: [], fleets: [], tradeLog: [], lastTickTime: Date.now() }
  
  // Fleet constants
  const FLEET_CONSTANTS = {
    BASE_JUMP_TIME: 120,    // seconds between sectors
    DOCK_TIME: 30,          // seconds to dock
    TRANSFER_TIME_PER_1000: 60, // seconds per 1000 cargo units
    MIN_PROFIT_MARGIN: 50,
    IDLE_RETHINK_TIME: 30,
  }
  
  // Sector adjacency for routing (simple for now - all Teladi sectors connected in line)
  const SECTOR_GRAPH: Record<string, string[]> = {
    'seizewell': ['teladi_gain'],
    'teladi_gain': ['seizewell', 'profit_share'],
    'profit_share': ['teladi_gain', 'greater_profit'],
    'greater_profit': ['profit_share'],
  }
  
  const SECTOR_NAMES: Record<string, string> = {
    'seizewell': 'Seizewell',
    'teladi_gain': 'Teladi Gain',
    'profit_share': 'Profit Share',
    'greater_profit': 'Greater Profit',
  }
  
  // Helper: Generate unique ID
  const genId = () => Math.random().toString(36).substr(2, 9)
  
  // Helper: Random position in sector (scaled to match sector layout spacing of 30)
  // Station positions are typically [-200, 200] * 30 = [-6000, 6000]
  const randomPos = (): [number, number, number] => [
    (Math.random() - 0.5) * 8000,  // X: -4000 to +4000
    (Math.random() - 0.5) * 600,   // Y: -300 to +300
    (Math.random() - 0.5) * 8000   // Z: -4000 to +4000
  ]
  
  // Helper: Find shortest path between sectors
  const findPath = (from: string, to: string): string[] | null => {
    if (from === to) return [from]
    const visited = new Set<string>()
    const queue: { sector: string; path: string[] }[] = [{ sector: from, path: [from] }]
    while (queue.length > 0) {
      const { sector, path } = queue.shift()!
      if (visited.has(sector)) continue
      visited.add(sector)
      const neighbors = SECTOR_GRAPH[sector] || []
      for (const n of neighbors) {
        if (n === to) return [...path, n]
        if (!visited.has(n)) queue.push({ sector: n, path: [...path, n] })
      }
    }
    return null
  }
  
  // Helper: Get ware name
  const getWareName = (wareId: string) => state.wares.find(w => w.id === wareId)?.name || wareId
  
  // Helper: Get station by ID
  const getStation = (stationId: string) => state.stations.find(s => s.id === stationId)
  const init = () => {
    // Wares based on actual Teladi sector stations
    const wares: Ware[] = [
      { id: 'energy_cells', name: 'Energy Cells', category: 'primary', basePrice: 16, volume: 1 },
      { id: 'crystals', name: 'Crystals', category: 'intermediate', basePrice: 1684, volume: 1 },
      { id: 'sun_oil', name: 'Sunrise Flowers Oil', category: 'food', basePrice: 156, volume: 1 },
      { id: 'sunrise_flowers', name: 'Sunrise Flowers', category: 'food', basePrice: 54, volume: 1 },
      { id: 'teladianium', name: 'Teladianium', category: 'intermediate', basePrice: 120, volume: 1 },
      { id: 'ore', name: 'Ore', category: 'primary', basePrice: 58, volume: 1 },
      { id: 'space_weed', name: 'Space Weed', category: 'food', basePrice: 420, volume: 1 },
      { id: 'space_fuel', name: 'Space Fuel', category: 'end', basePrice: 200, volume: 1 },
      { id: 'ire_laser', name: 'IRE Laser', category: 'end', basePrice: 2980, volume: 5 },
    ]
    // Recipes for Teladi stations
    const recipes: Recipe[] = [
      // Solar Power Plants - produce energy from crystals
      { id: 'spp_teladi', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 1 }], cycleTimeSec: 60, batchSize: 12, productStorageCap: 6000 },
      // Sun Oil Refinery - produces oil from flowers + energy
      { id: 'sun_oil_refinery', productId: 'sun_oil', inputs: [{ wareId: 'sunrise_flowers', amount: 4 }, { wareId: 'energy_cells', amount: 8 }], cycleTimeSec: 90, batchSize: 6, productStorageCap: 2000 },
      // Flower Farm - produces sunrise flowers from energy
      { id: 'flower_farm', productId: 'sunrise_flowers', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 80, batchSize: 20, productStorageCap: 4000 },
      // Teladianium Foundry - produces teladianium from ore + energy
      { id: 'teladianium_foundry', productId: 'teladianium', inputs: [{ wareId: 'ore', amount: 6 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 8, productStorageCap: 2000 },
      // Bliss Place - produces space weed from energy + flowers
      { id: 'bliss_place', productId: 'space_weed', inputs: [{ wareId: 'sunrise_flowers', amount: 8 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 150, batchSize: 10, productStorageCap: 1500 },
      // Dream Farm - produces space fuel from weed + energy
      { id: 'dream_farm', productId: 'space_fuel', inputs: [{ wareId: 'space_weed', amount: 4 }, { wareId: 'energy_cells', amount: 12 }], cycleTimeSec: 100, batchSize: 8, productStorageCap: 2000 },
      // IRE Laser Forge - produces lasers from teladianium + energy
      { id: 'ire_forge', productId: 'ire_laser', inputs: [{ wareId: 'teladianium', amount: 2 }, { wareId: 'energy_cells', amount: 40 }], cycleTimeSec: 180, batchSize: 1, productStorageCap: 50 },
    ]
    // Stations matching the 4 Teladi sectors
    const stations: Station[] = [
      // === SEIZEWELL ===
      { id: 'sz_spp_b', name: 'Solar Power Plant (b)', recipeId: 'spp_teladi', sectorId: 'seizewell', inventory: { energy_cells: 500, crystals: 20 }, reorderLevel: { crystals: 10 }, reserveLevel: { energy_cells: 200 } },
      { id: 'sz_spp_d', name: 'Solar Power Plant (delta)', recipeId: 'spp_teladi', sectorId: 'seizewell', inventory: { energy_cells: 400, crystals: 15 }, reorderLevel: { crystals: 10 }, reserveLevel: { energy_cells: 200 } },
      { id: 'sz_oil', name: 'Sun Oil Refinery (beta)', recipeId: 'sun_oil_refinery', sectorId: 'seizewell', inventory: { sun_oil: 50, sunrise_flowers: 40, energy_cells: 100 }, reorderLevel: { sunrise_flowers: 20, energy_cells: 50 }, reserveLevel: { sun_oil: 100 } },
      { id: 'sz_flower_b', name: 'Flower Farm (beta)', recipeId: 'flower_farm', sectorId: 'seizewell', inventory: { sunrise_flowers: 100, energy_cells: 80 }, reorderLevel: { energy_cells: 60 }, reserveLevel: { sunrise_flowers: 150 } },
      { id: 'sz_flower_g', name: 'Flower Farm (gamma)', recipeId: 'flower_farm', sectorId: 'seizewell', inventory: { sunrise_flowers: 120, energy_cells: 70 }, reorderLevel: { energy_cells: 60 }, reserveLevel: { sunrise_flowers: 150 } },
      { id: 'sz_flower_d', name: 'Flower Farm (delta)', recipeId: 'flower_farm', sectorId: 'seizewell', inventory: { sunrise_flowers: 80, energy_cells: 90 }, reorderLevel: { energy_cells: 60 }, reserveLevel: { sunrise_flowers: 150 } },
      { id: 'sz_ire', name: 'Beta I.R.E. Laser Forge (alpha)', recipeId: 'ire_forge', sectorId: 'seizewell', inventory: { ire_laser: 2, teladianium: 10, energy_cells: 200 }, reorderLevel: { teladianium: 8, energy_cells: 100 }, reserveLevel: { ire_laser: 5 } },
      
      // === TELADI GAIN ===
      { id: 'tg_bliss', name: 'Bliss Place (M)', recipeId: 'bliss_place', sectorId: 'teladi_gain', inventory: { space_weed: 30, sunrise_flowers: 60, energy_cells: 120 }, reorderLevel: { sunrise_flowers: 40, energy_cells: 80 }, reserveLevel: { space_weed: 60 } },
      { id: 'tg_oil', name: 'Sun Oil Refinery (M)', recipeId: 'sun_oil_refinery', sectorId: 'teladi_gain', inventory: { sun_oil: 40, sunrise_flowers: 30, energy_cells: 80 }, reorderLevel: { sunrise_flowers: 20, energy_cells: 50 }, reserveLevel: { sun_oil: 80 } },
      { id: 'tg_flower', name: 'Flower Farm (M)', recipeId: 'flower_farm', sectorId: 'teladi_gain', inventory: { sunrise_flowers: 150, energy_cells: 100 }, reorderLevel: { energy_cells: 60 }, reserveLevel: { sunrise_flowers: 200 } },
      
      // === PROFIT SHARE ===
      { id: 'ps_spp', name: 'Solar Power Plant (M)', recipeId: 'spp_teladi', sectorId: 'profit_share', inventory: { energy_cells: 600, crystals: 25 }, reorderLevel: { crystals: 12 }, reserveLevel: { energy_cells: 250 } },
      { id: 'ps_foundry', name: 'Teladianium Foundry (L)', recipeId: 'teladianium_foundry', sectorId: 'profit_share', inventory: { teladianium: 40, ore: 50, energy_cells: 150 }, reorderLevel: { ore: 30, energy_cells: 100 }, reserveLevel: { teladianium: 60 } },
      
      // === GREATER PROFIT ===
      { id: 'gp_dream', name: 'Dream Farm (M)', recipeId: 'dream_farm', sectorId: 'greater_profit', inventory: { space_fuel: 20, space_weed: 30, energy_cells: 100 }, reorderLevel: { space_weed: 20, energy_cells: 60 }, reserveLevel: { space_fuel: 40 } },
      { id: 'gp_bliss', name: 'Bliss Place (L)', recipeId: 'bliss_place', sectorId: 'greater_profit', inventory: { space_weed: 50, sunrise_flowers: 80, energy_cells: 150 }, reorderLevel: { sunrise_flowers: 50, energy_cells: 100 }, reserveLevel: { space_weed: 80 } },
    ]
    state.wares = wares
    state.recipes = recipes
    state.stations = stations
    state.sectorPrices = {}
    
    // Initialize corporations
    const corporations: Corporation[] = [
      { id: 'teladi_company', name: 'Teladi Company', race: 'teladi', type: 'state', stationIds: ['ps_foundry'], fleetIds: [], credits: 5_000_000, netWorth: 50_000_000, aggressiveness: 0.4, expansionBudget: 500_000, riskTolerance: 0.3, lifetimeProfit: 0, lifetimeTrades: 0 },
      { id: 'sunward_consortium', name: 'Sunward Consortium', race: 'teladi', type: 'guild', stationIds: ['sz_spp_b', 'ps_spp'], fleetIds: [], credits: 800_000, netWorth: 4_000_000, aggressiveness: 0.5, expansionBudget: 100_000, riskTolerance: 0.4, lifetimeProfit: 0, lifetimeTrades: 0 },
      { id: 'family_zhikkt', name: "Family Zhi'kkt", race: 'teladi', type: 'family', stationIds: ['sz_spp_d', 'sz_flower_b', 'tg_flower'], fleetIds: [], credits: 300_000, netWorth: 1_500_000, aggressiveness: 0.6, expansionBudget: 50_000, riskTolerance: 0.5, lifetimeProfit: 0, lifetimeTrades: 0 },
      { id: 'family_tekra', name: "Family Tek'ra", race: 'teladi', type: 'family', stationIds: ['sz_oil', 'tg_oil'], fleetIds: [], credits: 400_000, netWorth: 2_000_000, aggressiveness: 0.55, expansionBudget: 60_000, riskTolerance: 0.45, lifetimeProfit: 0, lifetimeTrades: 0 },
      { id: 'crimson_commerce', name: 'Crimson Commerce Guild', race: 'teladi', type: 'guild', stationIds: ['sz_ire'], fleetIds: [], credits: 1_200_000, netWorth: 6_000_000, aggressiveness: 0.7, expansionBudget: 200_000, riskTolerance: 0.6, lifetimeProfit: 0, lifetimeTrades: 0 },
      { id: 'profit_guild', name: 'Profit Guild', race: 'teladi', type: 'guild', stationIds: ['tg_bliss', 'gp_dream', 'gp_bliss'], fleetIds: [], credits: 600_000, netWorth: 3_000_000, aggressiveness: 0.65, expansionBudget: 80_000, riskTolerance: 0.55, lifetimeProfit: 0, lifetimeTrades: 0 },
    ]
    
    // Initial fleet spawn configs
    const fleetConfigs = [
      { ownerId: 'teladi_company', ownerType: 'state' as OwnershipType, behavior: 'corp-logistics' as FleetBehavior, shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.1, homeSectorId: 'seizewell' },
      { ownerId: 'teladi_company', ownerType: 'state' as OwnershipType, behavior: 'corp-logistics' as FleetBehavior, shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.1, homeSectorId: 'profit_share' },
      { ownerId: 'teladi_company', ownerType: 'state' as OwnershipType, behavior: 'freelance' as FleetBehavior, shipType: 'Albatross', capacity: 8000, speed: 0.7, autonomy: 0.8, profitShare: 0.2, homeSectorId: 'seizewell' },
      { ownerId: 'sunward_consortium', ownerType: 'guild' as OwnershipType, behavior: 'station-supply' as FleetBehavior, homeStationId: 'sz_spp_b', shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 0.2, profitShare: 0.15, homeSectorId: 'seizewell' },
      { ownerId: 'sunward_consortium', ownerType: 'guild' as OwnershipType, behavior: 'station-distribute' as FleetBehavior, homeStationId: 'ps_spp', shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.15, homeSectorId: 'profit_share' },
      { ownerId: 'family_zhikkt', ownerType: 'family' as OwnershipType, behavior: 'station-distribute' as FleetBehavior, homeStationId: 'sz_spp_d', shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 0.4, profitShare: 0.25, homeSectorId: 'seizewell' },
      { ownerId: 'family_tekra', ownerType: 'family' as OwnershipType, behavior: 'station-supply' as FleetBehavior, homeStationId: 'sz_oil', shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.2, homeSectorId: 'seizewell' },
      { ownerId: 'crimson_commerce', ownerType: 'guild' as OwnershipType, behavior: 'station-supply' as FleetBehavior, homeStationId: 'sz_ire', shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 0.2, profitShare: 0.1, homeSectorId: 'seizewell' },
      { ownerId: 'crimson_commerce', ownerType: 'guild' as OwnershipType, behavior: 'freelance' as FleetBehavior, shipType: 'Vulture', capacity: 2800, speed: 1.1, autonomy: 0.9, profitShare: 0.3, homeSectorId: 'seizewell' },
      { ownerId: 'profit_guild', ownerType: 'guild' as OwnershipType, behavior: 'guild-assigned' as FleetBehavior, shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 0.5, profitShare: 0.2, homeSectorId: 'teladi_gain' },
      { ownerId: 'profit_guild', ownerType: 'guild' as OwnershipType, behavior: 'station-supply' as FleetBehavior, homeStationId: 'gp_dream', shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.15, homeSectorId: 'greater_profit' },
      { ownerId: null, ownerType: 'independent' as OwnershipType, behavior: 'freelance' as FleetBehavior, shipType: 'Vulture', capacity: 2800, speed: 1.05, autonomy: 1.0, profitShare: 1.0, homeSectorId: 'seizewell' },
      { ownerId: null, ownerType: 'independent' as OwnershipType, behavior: 'freelance' as FleetBehavior, shipType: 'Vulture', capacity: 2800, speed: 0.95, autonomy: 1.0, profitShare: 1.0, homeSectorId: 'profit_share' },
      { ownerId: null, ownerType: 'independent' as OwnershipType, behavior: 'freelance' as FleetBehavior, shipType: 'Vulture', capacity: 2800, speed: 1.0, autonomy: 1.0, profitShare: 1.0, homeSectorId: 'teladi_gain' },
    ]
    
    // Spawn fleets
    const fleets: NPCFleet[] = fleetConfigs.map((cfg, i) => {
      const fleet: NPCFleet = {
        id: `fleet_${genId()}`,
        name: `${cfg.shipType} ${cfg.ownerId ? corporations.find(c => c.id === cfg.ownerId)?.name?.split(' ')[0] || '' : 'Independent'}-${i + 1}`,
        shipType: cfg.shipType,
        modelPath: '/models/00007.obj',
        race: 'teladi',
        capacity: cfg.capacity,
        speed: cfg.speed,
        homeSectorId: cfg.homeSectorId,
        ownerId: cfg.ownerId,
        ownerType: cfg.ownerType,
        homeStationId: cfg.homeStationId,
        behavior: cfg.behavior,
        autonomy: cfg.autonomy,
        profitShare: cfg.profitShare,
        currentSectorId: cfg.homeSectorId,
        position: randomPos(),
        state: 'idle',
        stateStartTime: Date.now(),
        cargo: {},
        credits: cfg.ownerId ? 10000 : 50000, // Independents have more starting capital
        commandQueue: [], // Autonomous ship command queue
        totalProfit: 0,
        tripsCompleted: 0,
      }
      // Link fleet to corporation
      if (cfg.ownerId) {
        const corp = corporations.find(c => c.id === cfg.ownerId)
        if (corp) corp.fleetIds.push(fleet.id)
      }
      return fleet
    })
    
    state.corporations = corporations
    state.fleets = fleets
    state.tradeLog = []
    state.lastTickTime = Date.now()
  }
  const tick = (deltaSec: number) => {
    const tickLen = 10
    if (deltaSec < tickLen) return
    const nextStations = state.stations.map((st) => ({ ...st, inventory: { ...st.inventory } }))
    const recipeById = new Map(state.recipes.map((r) => [r.id, r]))
    for (const st of nextStations) {
      const r = recipeById.get(st.recipeId)
      if (!r) continue
      
      const canRun = r.inputs.every((x) => (st.inventory[x.wareId] || 0) >= x.amount)
      
      if (typeof st.productionProgress !== 'number') st.productionProgress = 0
      
      if (canRun) {
        st.productionProgress += deltaSec / r.cycleTimeSec
        if (st.productionProgress >= 1.0) {
          for (const x of r.inputs) st.inventory[x.wareId] = (st.inventory[x.wareId] || 0) - x.amount
          st.inventory[r.productId] = (st.inventory[r.productId] || 0) + r.batchSize
          st.productionProgress = 0
        }
      }
    }
    const sectorPrices = { ...state.sectorPrices }
    for (const st of nextStations) {
      const r = recipeById.get(st.recipeId)
      if (!r) continue
      const sp = sectorPrices[st.sectorId] || {}
      for (const x of r.inputs) {
        const base = state.wares.find((w) => w.id === x.wareId)?.basePrice || 1
        const stock = st.inventory[x.wareId] || 0
        const rl = st.reorderLevel[x.wareId] || 0
        const mod = Math.max(0.5, Math.min(2.0, rl <= 0 ? 1 : 1 + (rl - stock) / Math.max(rl, 1)))
        sp[x.wareId] = base * mod
      }
      const baseProd = state.wares.find((w) => w.id === r.productId)?.basePrice || 1
      const prodStock = st.inventory[r.productId] || 0
      const reserve = st.reserveLevel[r.productId] || 0
      const modProd = Math.max(0.5, Math.min(2.0, reserve <= 0 ? 1 : 1 - (reserve - prodStock) / Math.max(reserve, 1)))
      sp[r.productId] = baseProd * modProd
      sectorPrices[st.sectorId] = sp
    }
    state.stations = nextStations
    state.sectorPrices = sectorPrices
    
    // ============ Fleet Tick Logic ============
    const now = Date.now()
    const timeScaleMultiplier = Math.max(0.1, state.timeScale)
    
    // Helper: Find best trade route for a fleet
    const findBestTradeRoute = (fleet: NPCFleet): TradeOrder | null => {
      const routes: { buyStation: Station; sellStation: Station; wareId: string; profit: number; qty: number }[] = []
      
      // For station-supply behavior: find wares the home station needs
      if ((fleet.behavior === 'station-supply' || fleet.behavior === 'station-distribute') && fleet.homeStationId) {
        const homeSt = getStation(fleet.homeStationId)
        if (!homeSt) return null
        const recipe = recipeById.get(homeSt.recipeId)
        if (!recipe) return null
        
        if (fleet.behavior === 'station-supply') {
          // Find stations selling inputs that home station needs
          for (const input of recipe.inputs) {
            const need = (homeSt.reorderLevel[input.wareId] || 0) - (homeSt.inventory[input.wareId] || 0)
            if (need <= 0) continue
            
            // Find selling stations
            for (const seller of state.stations) {
              if (seller.id === homeSt.id) continue
              const sellerRecipe = recipeById.get(seller.recipeId)
              if (!sellerRecipe || sellerRecipe.productId !== input.wareId) continue
              const available = (seller.inventory[input.wareId] || 0) - (seller.reserveLevel[input.wareId] || 0)
              if (available <= 0) continue
              
              const qty = Math.min(available, need, fleet.capacity)
              const buyPrice = (state.sectorPrices[seller.sectorId]?.[input.wareId] || state.wares.find(w => w.id === input.wareId)?.basePrice || 100)
              const sellPrice = buyPrice * 1.1 // Internal transfer markup
              const profit = (sellPrice - buyPrice) * qty
              if (profit > FLEET_CONSTANTS.MIN_PROFIT_MARGIN) {
                routes.push({ buyStation: seller, sellStation: homeSt, wareId: input.wareId, profit, qty })
              }
            }
          }
        } else {
          // station-distribute: sell home station's products
          const productId = recipe.productId
          const available = (homeSt.inventory[productId] || 0) - (homeSt.reserveLevel[productId] || 0)
          if (available > 0) {
            // Find buyers
            for (const buyer of state.stations) {
              if (buyer.id === homeSt.id) continue
              const buyerRecipe = recipeById.get(buyer.recipeId)
              if (!buyerRecipe) continue
              const needsProduct = buyerRecipe.inputs.some(i => i.wareId === productId)
              if (!needsProduct) continue
              const buyerNeed = (buyer.reorderLevel[productId] || 0) - (buyer.inventory[productId] || 0)
              if (buyerNeed <= 0) continue
              
              const qty = Math.min(available, buyerNeed, fleet.capacity)
              const sellPrice = (state.sectorPrices[buyer.sectorId]?.[productId] || state.wares.find(w => w.id === productId)?.basePrice || 100)
              const buyPrice = sellPrice * 0.9
              const profit = (sellPrice - buyPrice) * qty
              if (profit > FLEET_CONSTANTS.MIN_PROFIT_MARGIN) {
                routes.push({ buyStation: homeSt, sellStation: buyer, wareId: productId, profit, qty })
              }
            }
          }
        }
      } else {
        // Freelance/corp-logistics: find any profitable route
        for (const ware of state.wares) {
          // Find sellers (producers with excess)
          const sellers = state.stations.filter(st => {
            const r = recipeById.get(st.recipeId)
            if (!r || r.productId !== ware.id) return false
            const available = (st.inventory[ware.id] || 0) - (st.reserveLevel[ware.id] || 0)
            return available > 0
          })
          
          // Find buyers (consumers needing this ware)
          const buyers = state.stations.filter(st => {
            const r = recipeById.get(st.recipeId)
            if (!r) return false
            const needsWare = r.inputs.some(i => i.wareId === ware.id)
            if (!needsWare) return false
            const need = (st.reorderLevel[ware.id] || 0) - (st.inventory[ware.id] || 0)
            return need > 0
          })
          
          for (const seller of sellers) {
            for (const buyer of buyers) {
              if (seller.id === buyer.id) continue
              const available = (seller.inventory[ware.id] || 0) - (seller.reserveLevel[ware.id] || 0)
              const need = (buyer.reorderLevel[ware.id] || 0) - (buyer.inventory[ware.id] || 0)
              const qty = Math.min(available, need, fleet.capacity)
              if (qty <= 0) continue
              
              const buyPrice = state.sectorPrices[seller.sectorId]?.[ware.id] || ware.basePrice
              const sellPrice = state.sectorPrices[buyer.sectorId]?.[ware.id] || ware.basePrice
              const profit = (sellPrice - buyPrice) * qty
              if (profit > FLEET_CONSTANTS.MIN_PROFIT_MARGIN) {
                routes.push({ buyStation: seller, sellStation: buyer, wareId: ware.id, profit, qty })
              }
            }
          }
        }
      }
      
      if (routes.length === 0) return null
      
      // Pick best route (highest profit, with some randomness for variety)
      routes.sort((a, b) => b.profit - a.profit)
      const pick = routes[Math.floor(Math.random() * Math.min(3, routes.length))]
      
      return {
        id: genId(),
        buyStationId: pick.buyStation.id,
        buyStationName: pick.buyStation.name,
        buySectorId: pick.buyStation.sectorId,
        buyWareId: pick.wareId,
        buyWareName: getWareName(pick.wareId),
        buyQty: pick.qty,
        buyPrice: state.sectorPrices[pick.buyStation.sectorId]?.[pick.wareId] || 100,
        sellStationId: pick.sellStation.id,
        sellStationName: pick.sellStation.name,
        sellSectorId: pick.sellStation.sectorId,
        sellWareId: pick.wareId,
        sellWareName: getWareName(pick.wareId),
        sellQty: pick.qty,
        sellPrice: state.sectorPrices[pick.sellStation.sectorId]?.[pick.wareId] || 100,
        expectedProfit: pick.profit,
        createdAt: now,
      }
    }
    
    // Process each fleet
    for (const fleet of state.fleets) {
      const stateAge = (now - fleet.stateStartTime) * timeScaleMultiplier / 1000 // seconds in game time
      
      // Autonomous mode: if fleet has commands queued, let frontend handle it
      // Backend only issues new commands when queue is empty
      const hasQueuedCommands = fleet.commandQueue.length > 0
      
      switch (fleet.state) {
        case 'idle': {
          // Try to find a trade route when idle and no pending commands
          if (!hasQueuedCommands && (stateAge > FLEET_CONSTANTS.IDLE_RETHINK_TIME || !fleet.currentOrder)) {
            const order = findBestTradeRoute(fleet)
            if (order) {
              fleet.currentOrder = order
              // Issue commands for the trade route
              if (fleet.currentSectorId !== order.buySectorId) {
                // Need to travel to buy station - issue gate travel commands
                fleet.destinationSectorId = order.buySectorId
                issueCommand(fleet.id, { type: 'goto-gate', targetSectorId: order.buySectorId })
                issueCommand(fleet.id, { type: 'use-gate', targetSectorId: order.buySectorId })
              } else {
                // Already in sector - go to station, dock, load
                issueCommand(fleet.id, { type: 'goto-station', targetStationId: order.buyStationId })
                issueCommand(fleet.id, { type: 'dock', targetStationId: order.buyStationId })
                issueCommand(fleet.id, { type: 'load-cargo', targetStationId: order.buyStationId, wareId: order.buyWareId, amount: order.buyQty })
              }
              fleet.stateStartTime = now
            }
          }
          break
        }
        
        case 'docking': {
          // Backend fallback if no reports come in
          if (!hasQueuedCommands && stateAge > FLEET_CONSTANTS.DOCK_TIME) {
            const hasCargo = Object.values(fleet.cargo).reduce((a, b) => a + b, 0) > 0
            fleet.state = hasCargo ? 'unloading' : 'loading'
            fleet.stateStartTime = now
          }
          break
        }
        
        case 'loading': {
          // Load cargo from buy station
          const order = fleet.currentOrder
          if (!order) { fleet.state = 'idle'; fleet.stateStartTime = now; break }
          
          const station = getStation(order.buyStationId)
          if (!station) { fleet.state = 'idle'; fleet.stateStartTime = now; break }
          
          const transferTime = (order.buyQty / 1000) * FLEET_CONSTANTS.TRANSFER_TIME_PER_1000
          if (!hasQueuedCommands && stateAge > transferTime) {
            // Transfer complete - take cargo from station
            const available = station.inventory[order.buyWareId] || 0
            const qty = Math.min(available, order.buyQty)
            if (qty > 0) {
              station.inventory[order.buyWareId] = (station.inventory[order.buyWareId] || 0) - qty
              fleet.cargo[order.buyWareId] = (fleet.cargo[order.buyWareId] || 0) + qty
              fleet.credits -= qty * order.buyPrice
            }
            
            // Issue commands to travel to sell station
            fleet.state = 'undocking'
            fleet.stateStartTime = now
            
            issueCommand(fleet.id, { type: 'undock' })
            if (fleet.currentSectorId !== order.sellSectorId) {
              issueCommand(fleet.id, { type: 'goto-gate', targetSectorId: order.sellSectorId })
              issueCommand(fleet.id, { type: 'use-gate', targetSectorId: order.sellSectorId })
            }
            issueCommand(fleet.id, { type: 'goto-station', targetStationId: order.sellStationId })
            issueCommand(fleet.id, { type: 'dock', targetStationId: order.sellStationId })
            issueCommand(fleet.id, { type: 'unload-cargo', targetStationId: order.sellStationId, wareId: order.sellWareId, amount: qty })
          }
          break
        }
        
        case 'undocking': {
          if (!hasQueuedCommands && stateAge > FLEET_CONSTANTS.DOCK_TIME) {
            const order = fleet.currentOrder
            if (!order) { fleet.state = 'idle'; fleet.stateStartTime = now; break }
            
            const hasCargo = Object.values(fleet.cargo).reduce((a, b) => a + b, 0) > 0
            
            if (hasCargo && fleet.currentSectorId !== order.sellSectorId) {
              // Travel to sell sector
              fleet.state = 'in-transit'
              fleet.destinationSectorId = order.sellSectorId
            } else if (hasCargo) {
              // Already in sell sector, dock
              fleet.state = 'docking'
              fleet.targetStationId = order.sellStationId
            } else {
              // No cargo, order complete
              fleet.currentOrder = undefined
              fleet.state = 'idle'
            }
            fleet.stateStartTime = now
          }
          break
        }
        
        case 'in-transit': {
          // For autonomous ships, this is handled by frontend flying to gate
          // Backend keeps this as a fallback / for off-screen simulation
          if (!hasQueuedCommands && stateAge > FLEET_CONSTANTS.BASE_JUMP_TIME / fleet.speed) {
            // Arrived!
            fleet.currentSectorId = fleet.destinationSectorId || fleet.homeSectorId
            fleet.position = randomPos()
            fleet.destinationSectorId = undefined
            
            // Dock at target station
            const order = fleet.currentOrder
            if (order) {
              const hasCargo = Object.values(fleet.cargo).reduce((a, b) => a + b, 0) > 0
              fleet.targetStationId = hasCargo ? order.sellStationId : order.buyStationId
              fleet.state = 'docking'
              // Issue commands for the new sector
              issueCommand(fleet.id, { type: 'goto-station', targetStationId: fleet.targetStationId })
              issueCommand(fleet.id, { type: 'dock', targetStationId: fleet.targetStationId })
            } else {
              fleet.state = 'idle'
            }
            fleet.stateStartTime = now
          }
          break
        }
        
        case 'unloading': {
          // Unload cargo at sell station
          const order = fleet.currentOrder
          if (!order) { fleet.state = 'idle'; fleet.stateStartTime = now; break }
          
          const station = getStation(order.sellStationId)
          if (!station) { fleet.state = 'idle'; fleet.stateStartTime = now; break }
          
          const cargoQty = fleet.cargo[order.sellWareId] || 0
          const transferTime = (cargoQty / 1000) * FLEET_CONSTANTS.TRANSFER_TIME_PER_1000
          
          if (stateAge > transferTime) {
            // Transfer complete - give cargo to station, get credits
            if (cargoQty > 0) {
              station.inventory[order.sellWareId] = (station.inventory[order.sellWareId] || 0) + cargoQty
              const revenue = cargoQty * order.sellPrice
              const cost = cargoQty * order.buyPrice
              const profit = revenue - cost
              
              fleet.credits += revenue
              fleet.totalProfit += profit
              fleet.tripsCompleted++
              fleet.cargo[order.sellWareId] = 0
              
              // Log the trade
              state.tradeLog.unshift({
                id: genId(),
                timestamp: now,
                fleetId: fleet.id,
                fleetName: fleet.name,
                wareId: order.sellWareId,
                wareName: order.sellWareName,
                quantity: cargoQty,
                buyPrice: order.buyPrice,
                sellPrice: order.sellPrice,
                profit,
                buySectorId: order.buySectorId,
                sellSectorId: order.sellSectorId,
                buyStationName: order.buyStationName,
                sellStationName: order.sellStationName,
              })
              
              // Keep trade log manageable
              if (state.tradeLog.length > 100) state.tradeLog.length = 100
              
              // Pay profit share to owner
              if (fleet.ownerId) {
                const corp = state.corporations.find(c => c.id === fleet.ownerId)
                if (corp) {
                  const share = profit * (1 - fleet.profitShare)
                  corp.credits += share
                  corp.lifetimeProfit += share
                  corp.lifetimeTrades++
                }
              }
            }
            
            // Order complete
            fleet.currentOrder = undefined
            fleet.state = 'undocking'
            fleet.stateStartTime = now
          }
          break
        }
      }
    }
    
    state.lastTickTime = now
  }
  const loop = () => {
    state.acc += 1 * Math.max(0.1, state.timeScale)
    if (state.acc >= 10) {
      tick(state.acc)
      state.acc = 0
    }
  }
  const setTimeScale = (v: number) => { state.timeScale = v }
  
  // Helper: Issue a command to a fleet
  const issueCommand = (fleetId: string, command: Omit<ShipCommand, 'id' | 'createdAt'>) => {
    const fleet = state.fleets.find(f => f.id === fleetId)
    if (!fleet) return
    const cmd: ShipCommand = {
      ...command,
      id: genId(),
      createdAt: Date.now()
    }
    fleet.commandQueue.push(cmd)
  }
  
  // Handle ship reports from autonomous frontend ships
  const handleShipReport = (report: {
    fleetId: string
    type: string
    sectorId: string
    position: [number, number, number]
    stationId?: string
    wareId?: string
    amount?: number
    timestamp: number
  }) => {
    const fleet = state.fleets.find(f => f.id === report.fleetId)
    if (!fleet) return
    
    // Update fleet position from frontend
    fleet.position = report.position
    fleet.currentSectorId = report.sectorId
    
    // Remove completed command from queue
    if (fleet.commandQueue.length > 0) {
      fleet.commandQueue.shift()
    }
    
    console.log(`[Universe] Ship report: ${fleet.name} - ${report.type}`)
    
    // Handle specific report types
    switch (report.type) {
      case 'arrived-at-station':
        fleet.targetStationId = report.stationId
        fleet.state = 'docking'
        // Next: issue dock command if not already queued
        if (fleet.commandQueue.length === 0) {
          issueCommand(fleet.id, { type: 'dock', targetStationId: report.stationId })
        }
        break
        
      case 'docked':
        fleet.state = 'docked' as FleetState // Use loading as docked equivalent
        fleet.targetStationId = report.stationId
        break
        
      case 'cargo-loaded':
        if (report.wareId && report.amount) {
          fleet.cargo[report.wareId] = (fleet.cargo[report.wareId] || 0) + report.amount
        }
        fleet.state = 'loading'
        break
        
      case 'cargo-unloaded':
        if (report.wareId && report.amount) {
          const station = state.stations.find(s => s.id === report.stationId)
          if (station) {
            station.inventory[report.wareId] = (station.inventory[report.wareId] || 0) + report.amount
          }
          fleet.cargo[report.wareId] = Math.max(0, (fleet.cargo[report.wareId] || 0) - report.amount)
          if (fleet.cargo[report.wareId] === 0) delete fleet.cargo[report.wareId]
        }
        fleet.state = 'unloading'
        break
        
      case 'undocked':
        fleet.state = 'idle'
        fleet.targetStationId = undefined
        break
        
      case 'arrived-at-gate':
        // Ship is at the gate, next should use the gate
        break
        
      case 'entered-sector':
        // Ship has entered new sector (stationId contains the destination sector)
        if (report.stationId) {
          fleet.currentSectorId = report.stationId
          fleet.destinationSectorId = undefined
          fleet.state = 'idle'
        }
        break
        
      case 'position-update':
        // Just a position sync, already handled above
        break
    }
  }
  
  return { state, init, tick, loop, setTimeScale, handleShipReport, issueCommand }
}

function universePlugin() {
  return {
    name: 'universe-instance',
    configureServer(server: ViteDevServer) {
      const u = createUniverse()
      u.init()
      const i = setInterval(() => u.loop(), 1000)
      server.httpServer?.on('close', () => clearInterval(i))
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || ''
        if (req.method === 'GET' && url.startsWith('/__universe/state')) {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ 
            wares: u.state.wares, 
            recipes: u.state.recipes, 
            stations: u.state.stations, 
            sectorPrices: u.state.sectorPrices, 
            timeScale: u.state.timeScale,
            fleets: u.state.fleets,
            corporations: u.state.corporations,
            tradeLog: u.state.tradeLog.slice(0, 20), // Send last 20 trades
          }))
          return
        }
        if (req.method === 'GET' && url.startsWith('/__universe/fleets')) {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ fleets: u.state.fleets }))
          return
        }
        if (req.method === 'GET' && url.startsWith('/__universe/corporations')) {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ corporations: u.state.corporations }))
          return
        }
        if (req.method === 'GET' && url.startsWith('/__universe/trade-log')) {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ tradeLog: u.state.tradeLog }))
          return
        }
        if (req.method === 'POST' && url.startsWith('/__universe/init')) {
          u.init()
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method === 'POST' && url.startsWith('/__universe/tick')) {
          const full = new URL(url, 'http://localhost')
          const d = Number(full.searchParams.get('delta') || '0')
          u.tick(d)
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method === 'POST' && url.startsWith('/__universe/time-scale')) {
          const full = new URL(url, 'http://localhost')
          const v = Number(full.searchParams.get('value') || '1')
          u.setTimeScale(v)
          res.statusCode = 204
          res.end()
          return
        }
        // Ship report endpoint for autonomous ships
        if (req.method === 'POST' && url.startsWith('/__universe/ship-report')) {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              const report = JSON.parse(body)
              u.handleShipReport(report)
              res.statusCode = 204
              res.end()
            } catch (e) {
              res.statusCode = 400
              res.end('Invalid JSON')
            }
          })
          return
        }
        next()
      })
    }
  }
}

// ... existing imports
import fs from 'fs';
import path from 'path';

// ... existing code

function persistPlugin() {
  return {
    name: 'persist-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || '';
        if (url.startsWith('/__persist/load') && req.method === 'GET') {
          const p = path.join(process.cwd(), 'user-data.json');
          if (fs.existsSync(p)) {
            const data = fs.readFileSync(p, 'utf-8');
            res.setHeader('content-type', 'application/json');
            res.end(data);
          } else {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({}));
          }
          return;
        }
        if (url.startsWith('/__persist/save') && req.method === 'POST') {
          const chunks: any[] = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            const body = Buffer.concat(chunks).toString();
            try {
              // Validate JSON
              JSON.parse(body);
              const p = path.join(process.cwd(), 'user-data.json');
              fs.writeFileSync(p, body);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), universePlugin(), persistPlugin()],
})
