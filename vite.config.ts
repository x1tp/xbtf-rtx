import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import react from '@vitejs/plugin-react'
// fs and path are already imported at the top

type Ware = { id: string; name: string; category: 'primary' | 'food' | 'intermediate' | 'end'; basePrice: number; volume: number }
type Recipe = { id: string; productId: string; inputs: { wareId: string; amount: number }[]; cycleTimeSec: number; batchSize: number; productStorageCap: number }
type Station = {
  id: string; name: string; recipeId: string; sectorId: string;
  inventory: Record<string, number>; reorderLevel: Record<string, number>; reserveLevel: Record<string, number>;
  productionProgress?: number; position?: [number, number, number]; modelPath?: string; ownerId?: string
}

type PendingConstruction = {
  id: string
  stationType: string
  targetSectorId: string
  status: 'planning' | 'in-transit' | 'building'
  builderShipId?: string
  createdAt: number
}

type CorporationAIState = {
  lastExpansionCheck: number
  currentGoal: 'expand' | 'consolidate' | 'war'
  pendingConstructions: PendingConstruction[]
}

// Fleet and Corporation types (mirroring simulation.ts but inline for vite backend)
type FleetState = 'idle' | 'loading' | 'in-transit' | 'unloading' | 'docking' | 'undocking' | 'building'
type OwnershipType = 'corporation' | 'guild' | 'family' | 'state' | 'independent' | 'player'
type FleetBehavior = 'station-supply' | 'station-distribute' | 'corp-logistics' | 'guild-assigned' | 'freelance' | 'player-manual' | 'player-auto' | 'patrol' | 'construction'
type RaceType = 'argon' | 'boron' | 'paranid' | 'split' | 'teladi' | 'pirate' | 'xenon'

// AI Constants
const STATION_BLUEPRINTS: Record<string, { id: string; name: string; cost: number; modelPath: string }> = {
  'spp_cycle': { id: 'teladi_spp', name: 'Teladi Solar Power Plant', cost: 846104, modelPath: '/models/00285.obj' },
  'spp_argon': { id: 'argon_spp', name: 'Argon Solar Power Plant', cost: 846104, modelPath: '/models/00184.obj' },
  'spp_split': { id: 'split_spp', name: 'Split Solar Power Plant', cost: 846104, modelPath: '/models/00275.obj' },
  'spp_paranid': { id: 'paranid_spp', name: 'Paranid Solar Power Plant', cost: 846104, modelPath: '/models/00279.obj' },
  'spp_boron': { id: 'boron_spp', name: 'Boron Solar Power Plant', cost: 846104, modelPath: '/models/00281.obj' },
  'mine_ore': { id: 'ore_mine', name: 'Ore Mine', cost: 588256, modelPath: '/models/00114.obj' },
  'mine_silicon': { id: 'silicon_mine', name: 'Silicon Mine', cost: 1118256, modelPath: '/models/00114.obj' },
  'flower_farm': { id: 'teladi_flower_farm', name: 'Flower Farm', cost: 461104, modelPath: '/models/00282.obj' },
  'oil_refinery': { id: 'teladi_oil_refinery', name: 'Sun Oil Refinery', cost: 1661104, modelPath: '/models/00283.obj' },
  'teladianium_foundry': { id: 'teladianium_foundry', name: 'Teladianium Foundry', cost: 661104, modelPath: '/models/00283.obj' },
  'ire_forge': { id: 'ire_forge', name: 'Beta I.R.E. Forge', cost: 2861104, modelPath: '/models/00430.obj' },
  'hept_forge': { id: 'hept_forge', name: 'HEPT Laser Forge', cost: 3200000, modelPath: '/models/00440.obj' },
  'pac_forge': { id: 'pac_forge', name: 'PAC Laser Forge', cost: 2000000, modelPath: '/models/00442.obj' },
  'spaceweed_cycle': { id: 'dream_farm', name: 'Dream Farm', cost: 1200000, modelPath: '/models/00282.obj' },
  'plankton_farm': { id: 'plankton_farm', name: 'Plankton Farm', cost: 350000, modelPath: '/models/00067.obj' },
  'bogas_plant': { id: 'bogas_plant', name: 'BoGas Factory', cost: 420000, modelPath: '/models/00011.obj' },
  'bofu_lab': { id: 'bofu_lab', name: 'BoFu Chemical Lab', cost: 520000, modelPath: '/models/00011.obj' },
  'argon_farm': { id: 'argon_farm', name: 'Argon Farm', cost: 400000, modelPath: '/models/00182.obj' },
  'cahoona_bakery': { id: 'cahoona_bakery', name: 'Cahoona Bakery', cost: 600000, modelPath: '/models/00183.obj' },
  'scruffin_farm': { id: 'scruffin_farm', name: 'Scruffin Farm', cost: 380000, modelPath: '/models/00272.obj' },
  'rastar_refinery': { id: 'rastar_refinery', name: 'Rastar Refinery', cost: 520000, modelPath: '/models/00273.obj' },
  'quantum_tube_fab': { id: 'quantum_tube_fab', name: 'Quantum Tube Fab', cost: 900000, modelPath: '/models/00420.obj' },
  'chip_plant': { id: 'chip_plant', name: 'Chip Plant', cost: 1100000, modelPath: '/models/00278.obj' },
  'computer_plant': { id: 'computer_plant', name: 'Computer Plant', cost: 1000000, modelPath: '/models/00431.obj' },
  'teladi_quantum_tube_fab': { id: 'teladi_quantum_tube_fab', name: 'Teladi Quantum Tube Fab', cost: 900000, modelPath: '/models/00420.obj' },
  'argon_quantum_tube_fab': { id: 'argon_quantum_tube_fab', name: 'Argon Quantum Tube Fab', cost: 900000, modelPath: '/models/00232.obj' },
  'split_quantum_tube_fab': { id: 'split_quantum_tube_fab', name: 'Split Quantum Tube Fab', cost: 900000, modelPath: '/models/00237.obj' },
  'boron_bio_gas': { id: 'bogas_plant', name: 'BoGas Factory', cost: 420000, modelPath: '/models/00011.obj' },
  'boron_bofu': { id: 'bofu_lab', name: 'BoFu Chemical Lab', cost: 520000, modelPath: '/models/00011.obj' },
  'paranid_farm': { id: 'paranid_farm', name: 'Paranid Farm', cost: 400000, modelPath: '/models/00276.obj' },
  'paranid_quantum_tube_fab': { id: 'paranid_quantum_tube_fab', name: 'Paranid Quantum Tube Fab', cost: 900000, modelPath: '/models/00213.obj' },
  'boron_chip_plant': { id: 'boron_chip_plant', name: 'Boron Chip Plant', cost: 1100000, modelPath: '/models/00280.obj' },
  'equipment_dock': { id: 'equipment_dock', name: 'Equipment Dock', cost: 1500000, modelPath: '/models/00448.obj' },
  'trading_station': { id: 'trading_station', name: 'Trading Station', cost: 1200000, modelPath: '/models/00001.obj' },
  'shipyard': { id: 'shipyard', name: 'Shipyard', cost: 5000000, modelPath: '/models/00444.obj' },
  'pirate_station': { id: 'pirate_station', name: 'Pirate Station', cost: 1800000, modelPath: '/models/00397.obj' },
  'xenon_power': { id: 'xenon_power', name: 'Xenon Power Plant', cost: 900000, modelPath: '/models/00323.obj' }
}

// Ship Catalog for purchasing
const SHIP_CATALOG = {
  vulture: { id: 'vulture', name: 'Vulture', cost: 85000, capacity: 2800, speed: 1.0, modelPath: '/models/00007.obj' },
  albatross: { id: 'albatross', name: 'Albatross', cost: 450000, capacity: 8000, speed: 0.7, modelPath: '/models/00187.obj' },
}

// Dynamic Economy Settings
const ECONOMY_SETTINGS = {
  CORP_MIN_CREDITS_TO_BUY_SHIP: 200000,  // Must have this after purchase
  TRADER_SPAWN_INTERVAL: 300000,          // 5 min between new sole traders
  TRADER_SPAWN_CHANCE: 0.3,               // 30% chance per interval
  TRADER_STARTING_CREDITS: 30000,
  TRADER_PROMOTION_THRESHOLD: 500000,     // Credits needed to found corp
  STATION_FOUNDING_COST: 800000,
  MAX_INDEPENDENT_TRADERS: 10,
}

// Ship command types for autonomous ships
type ShipCommandType = 'goto-station' | 'dock' | 'load-cargo' | 'unload-cargo' | 'undock' | 'goto-gate' | 'use-gate' | 'patrol' | 'wait' | 'trade-buy' | 'trade-sell' | 'move-to-sector'
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
  aiState?: CorporationAIState
}

type TradeLogEntry = {
  id: string; timestamp: number; fleetId: string; fleetName: string
  wareId: string; wareName: string; quantity: number
  buyPrice: number; sellPrice: number; profit: number
  buySectorId: string; sellSectorId: string
  buyStationName: string; sellStationName: string
}

type UniverseState = {
  wares: Ware[]; recipes: Recipe[]; stations: Station[]; sectorPrices: Record<string, Record<string, number>>; timeScale: number; acc: number; elapsedTimeSec: number
  // Fleet simulation
  corporations: Corporation[]; fleets: NPCFleet[]; tradeLog: TradeLogEntry[]; lastTickTime: number
  // Dynamic economy
  lastTraderSpawnCheck?: number
}

function createUniverse() {
  const state: UniverseState = { wares: [], recipes: [], stations: [], sectorPrices: {}, timeScale: 1, acc: 0, elapsedTimeSec: 0, corporations: [], fleets: [], tradeLog: [], lastTickTime: Date.now() }

  // Fleet constants
  const FLEET_CONSTANTS = {
    BASE_JUMP_TIME: 120,    // seconds between sectors
    DOCK_TIME: 30,          // seconds to dock
    TRANSFER_TIME_PER_1000: 60, // seconds per 1000 cargo units
    MIN_PROFIT_MARGIN: 50,
    IDLE_RETHINK_TIME: 30,
  }

  // Sector adjacency for routing - MUST match universe_xbtf.ts neighbors (using sector IDs)
  const SECTOR_GRAPH: Record<string, string[]> = {
    'seizewell': ['teladi_gain', 'greater_profit', 'profit_share'],
    'teladi_gain': ['ceo_s_buckzoid', 'family_whi', 'seizewell'],
    'profit_share': ['ceo_s_buckzoid', 'spaceweed_drift', 'seizewell'],
    'greater_profit': ['seizewell', 'spaceweed_drift', 'blue_profit'],
    'spaceweed_drift': ['profit_share', 'greater_profit'],
    'blue_profit': ['greater_profit', 'ceo_s_sprite'],
    'ceo_s_sprite': ['blue_profit', 'company_pride'],
    'company_pride': ['ceo_s_sprite', 'thuruks_beard'],
    'ceo_s_buckzoid': ['menelaus_frontier', 'teladi_gain', 'profit_share'],
    // Add more sectors as needed
  }

  // BFS pathfinding for multi-hop sector navigation
  const findSectorPath = (fromSectorId: string, toSectorId: string): string[] | null => {
    if (fromSectorId === toSectorId) return []
    if (!SECTOR_GRAPH[fromSectorId]) {
      console.warn(`[Pathfinding] Unknown sector: ${fromSectorId}`)
      return null
    }

    const queue: { sector: string; path: string[] }[] = [{ sector: fromSectorId, path: [] }]
    const visited = new Set<string>([fromSectorId])

    while (queue.length > 0) {
      const { sector, path } = queue.shift()!
      const neighbors = SECTOR_GRAPH[sector] || []

      for (const neighbor of neighbors) {
        if (neighbor === toSectorId) {
          return [...path, neighbor] // Found! Return path (excludes start, includes end)
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push({ sector: neighbor, path: [...path, neighbor] })
        }
      }
    }

    console.warn(`[Pathfinding] No path from ${fromSectorId} to ${toSectorId}`)
    return null // No path found
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

  // Helper: Get ware name
  const getWareName = (wareId: string) => state.wares.find(w => w.id === wareId)?.name || wareId

  // Helper: Get station by ID
  const getStation = (stationId: string) => state.stations.find(s => s.id === stationId)
  // Helper: Try to load the latest autosave
  const tryLoadLatestSave = (): UniverseState | null => {
    try {
      const saveDir = path.resolve(process.cwd(), 'saves')
      if (!fs.existsSync(saveDir)) return null

      const files = fs.readdirSync(saveDir).filter(f => f.startsWith('autosave_') && f.endsWith('.json'))
      if (files.length === 0) return null

      // Find latest by mtime
      const latestFile = files.map(f => {
        const fullPath = path.join(saveDir, f)
        return { file: f, mtime: fs.statSync(fullPath).mtime.getTime() }
      }).sort((a, b) => b.mtime - a.mtime)[0]

      if (!latestFile) return null

      console.log(`[Universe] Loading state from ${latestFile.file}...`)
      const content = fs.readFileSync(path.join(saveDir, latestFile.file), 'utf-8')
      const data = JSON.parse(content)
      return data as UniverseState
    } catch (e) {
      console.error('[Universe] Failed to load save:', e)
      return null
    }
  }

  const init = (options?: { fresh?: boolean }) => {
    // Try loading save first (unless fresh start requested)
    if (!options?.fresh) {
      const loadedState = tryLoadLatestSave()
      if (loadedState) {
        state.wares = loadedState.wares
        state.recipes = loadedState.recipes
        state.stations = loadedState.stations
        state.sectorPrices = loadedState.sectorPrices
        state.timeScale = 1 // Reset time scale on load
        state.elapsedTimeSec = loadedState.elapsedTimeSec
        state.corporations = loadedState.corporations
        state.fleets = loadedState.fleets
        state.tradeLog = loadedState.tradeLog || []
        console.log(`[Universe] State restored! ${state.stations.length} stations, ${state.fleets.length} fleets.`)
        return
      }
    } else {
      // Archive existing saves
      try {
        const saveDir = path.resolve(process.cwd(), 'saves')
        if (fs.existsSync(saveDir)) {
          const files = fs.readdirSync(saveDir).filter(f => f.startsWith('autosave_') && f.endsWith('.json'))
          files.forEach(f => {
            const oldPath = path.join(saveDir, f)
            const newPath = path.join(saveDir, f + '.bak')
            fs.renameSync(oldPath, newPath)
            console.log(`[Universe] Archived save ${f} to ${f}.bak`)
          })
        }
      } catch (e) {
        console.error('[Universe] Failed to archive saves:', e)
      }
    }

    console.log('[Universe] No save found, initializing fresh start...')
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
      { id: 'silicon_wafers', name: 'Silicon Wafers', category: 'primary', basePrice: 504, volume: 18 },
      { id: 'ire_laser', name: 'IRE Laser', category: 'end', basePrice: 2980, volume: 5 },
      { id: 'plankton', name: 'Plankton', category: 'food', basePrice: 40, volume: 1 },
      { id: 'bogas', name: 'BoGas', category: 'food', basePrice: 50, volume: 1 },
      { id: 'bofu', name: 'BoFu', category: 'food', basePrice: 90, volume: 1 },
      { id: 'wheat', name: 'Wheat', category: 'food', basePrice: 60, volume: 1 },
      { id: 'cahoonas', name: 'Meatsteak Cahoonas', category: 'food', basePrice: 110, volume: 1 },
      { id: 'scruffin_fruit', name: 'Scruffin Fruit', category: 'food', basePrice: 60, volume: 1 },
      { id: 'rastar_oil', name: 'Rastar Oil', category: 'food', basePrice: 140, volume: 1 },
      { id: 'quantum_tubes', name: 'Quantum Tubes', category: 'intermediate', basePrice: 1800, volume: 2 },
      { id: 'microchips', name: 'Microchips', category: 'intermediate', basePrice: 1684, volume: 1 },
      { id: 'computer_components', name: 'Computer Components', category: 'intermediate', basePrice: 1200, volume: 1 },
      { id: 'hept_laser', name: 'HEPT Laser', category: 'end', basePrice: 120000, volume: 8 },
      { id: 'pac_laser', name: 'PAC Laser', category: 'end', basePrice: 40000, volume: 6 },
      { id: 'ship_parts', name: 'Ship Parts', category: 'end', basePrice: 800, volume: 4 },
      { id: 'trade_goods', name: 'Trade Goods', category: 'end', basePrice: 200, volume: 1 },
    ]
    // Recipes for Teladi stations
    const recipes: Recipe[] = [
      // Solar Power Plants - produce energy from crystals
      { id: 'spp_teladi', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 1 }], cycleTimeSec: 60, batchSize: 120, productStorageCap: 6000 },
      // Sun Oil Refinery - produces oil from flowers + energy
      { id: 'sun_oil_refinery', productId: 'sun_oil', inputs: [{ wareId: 'sunrise_flowers', amount: 4 }, { wareId: 'energy_cells', amount: 8 }], cycleTimeSec: 90, batchSize: 6, productStorageCap: 2000 },
      // Flower Farm - produces sunrise flowers from energy
      { id: 'flower_farm', productId: 'sunrise_flowers', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 80, batchSize: 20, productStorageCap: 4000 },
      // Teladianium Foundry - produces teladianium from ore + energy
      { id: 'teladianium_foundry', productId: 'teladianium', inputs: [{ wareId: 'ore', amount: 6 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 8, productStorageCap: 2000 },
      // Ore Mine - produces ore from energy
      { id: 'ore_mine', productId: 'ore', inputs: [{ wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 90, batchSize: 8, productStorageCap: 1200 },
      // Crystal Fab - produces crystals from silicon + food + energy
      { id: 'crystal_fab', productId: 'crystals', inputs: [{ wareId: 'silicon_wafers', amount: 4 }, { wareId: 'sun_oil', amount: 8 }, { wareId: 'energy_cells', amount: 80 }], cycleTimeSec: 120, batchSize: 4, productStorageCap: 1000 },
      // Silicon Mine - produces silicon from energy
      { id: 'silicon_mine', productId: 'silicon_wafers', inputs: [{ wareId: 'energy_cells', amount: 24 }], cycleTimeSec: 90, batchSize: 1, productStorageCap: 200 },
      // Bliss Place - produces space weed from energy + flowers
      { id: 'bliss_place', productId: 'space_weed', inputs: [{ wareId: 'sunrise_flowers', amount: 8 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 150, batchSize: 10, productStorageCap: 1500 },
      // Dream Farm - produces space fuel from weed + energy
      { id: 'dream_farm', productId: 'space_fuel', inputs: [{ wareId: 'space_weed', amount: 4 }, { wareId: 'energy_cells', amount: 12 }], cycleTimeSec: 100, batchSize: 8, productStorageCap: 2000 },
      // IRE Laser Forge - produces lasers from teladianium + energy
      { id: 'ire_forge', productId: 'ire_laser', inputs: [{ wareId: 'teladianium', amount: 2 }, { wareId: 'energy_cells', amount: 40 }], cycleTimeSec: 180, batchSize: 1, productStorageCap: 50 },
      // HEPT Laser Forge
      { id: 'hept_forge', productId: 'hept_laser', inputs: [{ wareId: 'teladianium', amount: 6 }, { wareId: 'energy_cells', amount: 120 }], cycleTimeSec: 200, batchSize: 1, productStorageCap: 20 },
      // PAC Laser Forge
      { id: 'pac_forge', productId: 'pac_laser', inputs: [{ wareId: 'ore', amount: 6 }, { wareId: 'energy_cells', amount: 80 }], cycleTimeSec: 180, batchSize: 1, productStorageCap: 20 },
      // Plankton Farm (Boron)
      { id: 'plankton_farm', productId: 'plankton', inputs: [{ wareId: 'energy_cells', amount: 8 }], cycleTimeSec: 80, batchSize: 40, productStorageCap: 800 },
      // BoGas Plant (Boron)
      { id: 'bogas_plant', productId: 'bogas', inputs: [{ wareId: 'plankton', amount: 20 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 90, batchSize: 30, productStorageCap: 600 },
      // BoFu Lab (Boron)
      { id: 'bofu_lab', productId: 'bofu', inputs: [{ wareId: 'bogas', amount: 20 }, { wareId: 'energy_cells', amount: 12 }], cycleTimeSec: 100, batchSize: 30, productStorageCap: 600 },
      // Argon Farm (wheat)
      { id: 'argon_farm', productId: 'wheat', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 80, batchSize: 30, productStorageCap: 800 },
      // Cahoona Bakery
      { id: 'cahoona_bakery', productId: 'cahoonas', inputs: [{ wareId: 'wheat', amount: 20 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 90, batchSize: 30, productStorageCap: 600 },
      // Scruffin Farm (Split)
      { id: 'scruffin_farm', productId: 'scruffin_fruit', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 80, batchSize: 30, productStorageCap: 800 },
      // Rastar Refinery (Split)
      { id: 'rastar_refinery', productId: 'rastar_oil', inputs: [{ wareId: 'scruffin_fruit', amount: 20 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 100, batchSize: 30, productStorageCap: 600 },
      // Quantum Tube Fab
      { id: 'quantum_tube_fab', productId: 'quantum_tubes', inputs: [{ wareId: 'silicon_wafers', amount: 4 }, { wareId: 'teladianium', amount: 2 }, { wareId: 'energy_cells', amount: 40 }], cycleTimeSec: 140, batchSize: 4, productStorageCap: 400 },
      // Chip Plant
      { id: 'chip_plant', productId: 'microchips', inputs: [{ wareId: 'silicon_wafers', amount: 4 }, { wareId: 'quantum_tubes', amount: 1 }, { wareId: 'energy_cells', amount: 30 }], cycleTimeSec: 160, batchSize: 2, productStorageCap: 200 },
      // Computer Plant
      { id: 'computer_plant', productId: 'computer_components', inputs: [{ wareId: 'microchips', amount: 2 }, { wareId: 'silicon_wafers', amount: 2 }, { wareId: 'energy_cells', amount: 30 }], cycleTimeSec: 150, batchSize: 4, productStorageCap: 400 },
      // Logistics hubs (trading station / equipment dock)
      { id: 'logistics_hub', productId: 'trade_goods', inputs: [], cycleTimeSec: 120, batchSize: 5, productStorageCap: 500 },
      // Shipyard (produces ship parts to justify inputs)
      { id: 'shipyard', productId: 'ship_parts', inputs: [{ wareId: 'teladianium', amount: 20 }, { wareId: 'ore', amount: 20 }, { wareId: 'energy_cells', amount: 100 }], cycleTimeSec: 240, batchSize: 10, productStorageCap: 500 },
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
      { id: 'gp_crystal', name: 'Crystal Fab (M)', recipeId: 'crystal_fab', sectorId: 'greater_profit', inventory: { crystals: 20, silicon_wafers: 40, sun_oil: 60, energy_cells: 200 }, reorderLevel: { silicon_wafers: 20, sun_oil: 30, energy_cells: 100 }, reserveLevel: { crystals: 50 } },

      // === COMPANY PRIDE ===
      { id: 'cp_silicon', name: 'Silicon Mine (M)', recipeId: 'silicon_mine', sectorId: 'company_pride', inventory: { silicon_wafers: 10, energy_cells: 100 }, reorderLevel: { energy_cells: 50 }, reserveLevel: { silicon_wafers: 20 } },
    ]
    state.wares = wares
    state.recipes = recipes
    state.stations = stations
    state.sectorPrices = {}

    // Initialize corporations
    const corporations: Corporation[] = [
      { id: 'teladi_company', name: 'Teladi Company', race: 'teladi', type: 'state', stationIds: ['ps_foundry'], fleetIds: [], credits: 5_000_000, netWorth: 50_000_000, aggressiveness: 0.4, expansionBudget: 500_000, riskTolerance: 0.3, lifetimeProfit: 0, lifetimeTrades: 0 },
      { id: 'sunward_consortium', name: 'Sunward Consortium', race: 'teladi', type: 'guild', stationIds: ['sz_spp_b', 'ps_spp', 'gp_crystal', 'cp_silicon'], fleetIds: [], credits: 800_000, netWorth: 4_000_000, aggressiveness: 0.5, expansionBudget: 100_000, riskTolerance: 0.4, lifetimeProfit: 0, lifetimeTrades: 0 },
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

      // === Military / Special Ships ===
      // Seizewell: Teladi Destroyer Phoenix (M2)
      { ownerId: 'teladi_company', ownerType: 'state' as OwnershipType, behavior: 'patrol' as FleetBehavior, shipType: 'Phoenix', capacity: 5000, speed: 0.6, autonomy: 0.9, profitShare: 0, homeSectorId: 'seizewell' },
      // Seizewell: Albatross (TL) - Construction
      { ownerId: 'teladi_company', ownerType: 'state' as OwnershipType, behavior: 'construction' as FleetBehavior, shipType: 'Albatross', capacity: 50000, speed: 0.4, autonomy: 0.8, profitShare: 0.5, homeSectorId: 'seizewell' },
      // Teladi Gain: Osprey (M6)
      { ownerId: 'teladi_company', ownerType: 'state' as OwnershipType, behavior: 'patrol' as FleetBehavior, shipType: 'Osprey', capacity: 1500, speed: 0.8, autonomy: 0.9, profitShare: 0, homeSectorId: 'teladi_gain' },
    ]

    // Spawn fleets
    const fleets: NPCFleet[] = fleetConfigs.map((cfg, i) => {
      let modelPath = '/models/00007.obj' // Default Vulture
      if (cfg.shipType === 'Phoenix') modelPath = '/models/00140.obj'
      else if (cfg.shipType === 'Albatross') modelPath = '/models/00187.obj'
      else if (cfg.shipType === 'Osprey') modelPath = '/models/00141.obj'

      const fleet: NPCFleet = {
        id: `fleet_${genId()}`,
        name: `${cfg.shipType} ${cfg.ownerId ? corporations.find(c => c.id === cfg.ownerId)?.name?.split(' ')[0] || '' : 'Independent'}-${i + 1}`,
        shipType: cfg.shipType,
        modelPath: modelPath,
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
    state.acc = 0
    state.elapsedTimeSec = 0
    state.lastTickTime = Date.now()
  }

  // ============ Corporation AI Logic ============
  const runCorporationAI = () => {
    const now = Date.now()

    state.corporations.forEach(corp => {
      // Initialize AI state if missing
      if (!corp.aiState) {
        corp.aiState = { lastExpansionCheck: now, currentGoal: 'expand', pendingConstructions: [] }
      }
      const ai = corp.aiState

      // Manage Pending Constructions
      for (let i = ai.pendingConstructions.length - 1; i >= 0; i--) {
        const job = ai.pendingConstructions[i]

        if (job.status === 'planning') {
          // Hire TL
          const tlId = `tl_${corp.id}_${genId()}`
          const spawnSector = 'seizewell' // Default shipyard

          const tl: NPCFleet = {
            id: tlId,
            name: `${corp.name} Supply Mammoth ${genId().substring(0, 4)}`,
            shipType: 'Albatross',
            modelPath: '/models/00187.obj',
            race: corp.race,
            capacity: 50000,
            speed: 0.5,
            homeSectorId: spawnSector,
            ownerId: corp.id,
            ownerType: corp.type,
            behavior: 'construction',
            autonomy: 0,
            profitShare: 0,
            currentSectorId: spawnSector,
            position: [0, 0, 0],
            state: 'idle',
            stateStartTime: now,
            cargo: {},
            credits: 0,
            commandQueue: [],
            totalProfit: 0,
            tripsCompleted: 0
          }
          state.fleets.push(tl)
          corp.fleetIds.push(tl.id)

          job.builderShipId = tl.id
          job.status = 'in-transit'
          console.log(`[CorpAI] ${corp.name} hired TL ${tl.name} for ${job.stationType}`)

          // Start the TL moving toward the build sector right away (first hop)
          const path = findSectorPath(spawnSector, job.targetSectorId)
          if (path && path.length > 0) {
            const nextSector = path[0]
            tl.commandQueue = []
            issueCommand(tl.id, { type: 'goto-gate', targetSectorId: nextSector })
            issueCommand(tl.id, { type: 'use-gate', targetSectorId: nextSector })
            tl.state = 'in-transit'
            tl.destinationSectorId = job.targetSectorId
            tl.stateStartTime = now
          } else if (path && path.length === 0) {
            // Already in target sector (unlikely on spawn)
            tl.destinationSectorId = job.targetSectorId
          } else {
            console.warn(`[CorpAI] TL ${tl.name} cannot find path from ${spawnSector} to ${job.targetSectorId}`)
          }
        }
        else if (job.status === 'in-transit') {
          // Check if TL is there
          const tl = state.fleets.find(f => f.id === job.builderShipId)
          if (!tl) {
            console.warn(`[CorpAI] Builder ship ${job.builderShipId} not found for job ${job.id}. Resetting to PLANNING.`)
            job.status = 'planning' // Retry
            continue
          }


          if (tl.currentSectorId === job.targetSectorId) {
            console.log(`[CorpAI] TL ${tl.name} arrived at target ${job.targetSectorId}. Starting construction.`)
            job.status = 'building'
            // Stop the ship
            tl.commandQueue = []
            tl.state = 'idle'
          } else {
            const path = findSectorPath(tl.currentSectorId, job.targetSectorId)
            if (!path) {
              console.warn(`[CorpAI] TL ${tl.name} cannot find path from ${tl.currentSectorId} to ${job.targetSectorId}`)
              continue
            }

            // Debug why it's not matching
            if (Math.random() < 0.05) console.log(`[CorpAI] TL ${tl.name} at ${tl.currentSectorId}, target ${job.targetSectorId}`)

            // Issue the next hop explicitly (goto-gate + use-gate) to mirror trader behavior
            const nextSector = path[0]
            const head = tl.commandQueue[0]
            const needsNewOrder =
              tl.commandQueue.length === 0 ||
              head.targetSectorId !== nextSector ||
              (head.type !== 'goto-gate' && head.type !== 'move-to-sector')

            if (needsNewOrder) {
              tl.commandQueue = []
              issueCommand(tl.id, { type: 'goto-gate', targetSectorId: nextSector })
              issueCommand(tl.id, { type: 'use-gate', targetSectorId: nextSector })
              tl.state = 'in-transit'
              tl.destinationSectorId = job.targetSectorId
              tl.stateStartTime = now
              const pathStr = [tl.currentSectorId, ...path].join(' -> ')
              console.log(`[CorpAI] TL ${tl.name} path: ${pathStr}`)
            }
          }
        }
        else if (job.status === 'building') {
          // DEPLOY
          const blueprint = STATION_BLUEPRINTS[job.stationType]
          if (blueprint) {
            const station: Station = {
              id: `station_${corp.id}_${genId()}`,
              name: blueprint.name,
              // Map stationType to actual recipe id (some differ from blueprint key)
              recipeId: (() => {
                if (job.stationType === 'spp_cycle') return 'spp_teladi'
                if (job.stationType === 'spp_argon' || job.stationType === 'spp_split' || job.stationType === 'spp_paranid' || job.stationType === 'spp_boron') return 'spp_teladi'
                if (job.stationType === 'mine_silicon') return 'silicon_mine'
                if (job.stationType === 'mine_ore') return 'ore_mine'
                if (job.stationType === 'hept_forge') return 'hept_forge'
                if (job.stationType === 'pac_forge') return 'pac_forge'
                if (job.stationType === 'plankton_farm') return 'plankton_farm'
                if (job.stationType === 'bogas_plant') return 'bogas_plant'
                if (job.stationType === 'bofu_lab') return 'bofu_lab'
                if (job.stationType === 'argon_farm') return 'argon_farm'
                if (job.stationType === 'cahoona_bakery') return 'cahoona_bakery'
                if (job.stationType === 'scruffin_farm') return 'scruffin_farm'
                if (job.stationType === 'rastar_refinery') return 'rastar_refinery'
                if (job.stationType === 'quantum_tube_fab' || job.stationType === 'teladi_quantum_tube_fab' || job.stationType === 'argon_quantum_tube_fab' || job.stationType === 'split_quantum_tube_fab' || job.stationType === 'paranid_quantum_tube_fab') return 'quantum_tube_fab'
                if (job.stationType === 'chip_plant' || job.stationType === 'boron_chip_plant') return 'chip_plant'
                if (job.stationType === 'computer_plant') return 'computer_plant'
                if (job.stationType === 'equipment_dock') return 'logistics_hub'
                if (job.stationType === 'trading_station') return 'logistics_hub'
                if (job.stationType === 'shipyard') return 'shipyard'
                if (job.stationType === 'xenon_power') return 'spp_teladi'
                return job.stationType
              })(),
              sectorId: job.targetSectorId,
              position: randomPos(),
              modelPath: blueprint.modelPath,
              ownerId: corp.id,
              inventory: {},
              reorderLevel: {},
              reserveLevel: {}
            }
            // Seed
            const recipe = state.recipes.find(r => r.id === station.recipeId)
            if (recipe) {
              station.inventory[recipe.productId] = recipe.batchSize
              recipe.inputs.forEach(inp => station.inventory[inp.wareId] = inp.amount * 5)
            }

            state.stations.push(station)
            corp.stationIds.push(station.id)

            console.log(`[CorpAI] ${corp.name} DEPLOYED ${blueprint.name} in ${job.targetSectorId}`)

            // Remove TL
            state.fleets = state.fleets.filter(f => f.id !== job.builderShipId)
            corp.fleetIds = corp.fleetIds.filter(f => f !== job.builderShipId)

            // Done
            ai.pendingConstructions.splice(i, 1)
          }
        }
      }

      // Strategy: Expand (Every 60s)
      if (now - ai.lastExpansionCheck > 60000) {
        ai.lastExpansionCheck = now

        // Limit concurrent constructions to 1 per corp to prevent swarms
        if (ai.pendingConstructions.length > 0) return

        // Market Analysis (Simplified)
        if (corp.credits > 2000000) { // Min budget
          // For now, expand randomly to test mechanism
          const typeKeys = Object.keys(STATION_BLUEPRINTS)
          const type = typeKeys[Math.floor(Math.random() * typeKeys.length)]
          const blueprint = STATION_BLUEPRINTS[type]

          if (blueprint && corp.credits >= blueprint.cost) {
            const sectorKeys = Object.keys(SECTOR_GRAPH)
            const targetSector = sectorKeys[Math.floor(Math.random() * sectorKeys.length)]

            corp.credits -= blueprint.cost
            ai.pendingConstructions.push({
              id: genId(),
              stationType: type,
              targetSectorId: targetSector,
              status: 'planning',
              createdAt: now
            })
            console.log(`[CorpAI] ${corp.name} ordered NEW ${blueprint.name} in ${targetSector}`)
          }
        }
      }

      // ============ Ship Purchasing Logic ============
      const corpFleets = state.fleets.filter(f => f.ownerId === corp.id && f.behavior !== 'construction')
      const corpStations = state.stations.filter(s => s.ownerId === corp.id)

      // Rule: 1 trader per 2 stations, minimum 1
      const desiredFleetSize = Math.max(1, Math.floor(corpStations.length / 2))

      if (corpFleets.length < desiredFleetSize && corp.credits > SHIP_CATALOG.vulture.cost + ECONOMY_SETTINGS.CORP_MIN_CREDITS_TO_BUY_SHIP) {
        // Purchase new trader
        const shipyard = 'seizewell' // Teladi shipyard
        const newFleet: NPCFleet = {
          id: `fleet_${genId()}`,
          name: `${corp.name.split(' ')[0]} Trader ${genId().substring(0, 4)}`,
          shipType: 'Vulture',
          modelPath: SHIP_CATALOG.vulture.modelPath,
          race: corp.race,
          capacity: SHIP_CATALOG.vulture.capacity,
          speed: SHIP_CATALOG.vulture.speed,
          homeSectorId: shipyard,
          ownerId: corp.id,
          ownerType: corp.type,
          behavior: 'corp-logistics',
          autonomy: 0.5,
          profitShare: 0.15,
          currentSectorId: shipyard,
          position: randomPos(),
          state: 'idle',
          stateStartTime: now,
          cargo: {},
          credits: 10000,
          commandQueue: [],
          totalProfit: 0,
          tripsCompleted: 0
        }

        state.fleets.push(newFleet)
        corp.fleetIds.push(newFleet.id)
        corp.credits -= SHIP_CATALOG.vulture.cost

        console.log(`[CorpAI] ${corp.name} purchased new trader: ${newFleet.name}`)
      }
    })
  }

  // ============ Sole Trader Spawning ============
  const spawnSoleTraders = () => {
    const now = Date.now()

    // Initialize spawn timer if missing
    if (!state.lastTraderSpawnCheck) state.lastTraderSpawnCheck = now

    if (now - state.lastTraderSpawnCheck > ECONOMY_SETTINGS.TRADER_SPAWN_INTERVAL) {
      state.lastTraderSpawnCheck = now

      // Cap total independents
      const independentCount = state.fleets.filter(f => f.ownerType === 'independent').length
      if (independentCount < ECONOMY_SETTINGS.MAX_INDEPENDENT_TRADERS && Math.random() < ECONOMY_SETTINGS.TRADER_SPAWN_CHANCE) {
        const spawnSectors = ['seizewell', 'profit_share', 'teladi_gain', 'greater_profit']
        const spawnSector = spawnSectors[Math.floor(Math.random() * spawnSectors.length)]

        const newTrader: NPCFleet = {
          id: `fleet_${genId()}`,
          name: `Independent ${genId().substring(0, 4)}`,
          shipType: 'Vulture',
          modelPath: SHIP_CATALOG.vulture.modelPath,
          race: 'teladi',
          capacity: SHIP_CATALOG.vulture.capacity,
          speed: 0.9 + Math.random() * 0.2, // Slight variation
          homeSectorId: spawnSector,
          ownerId: null,
          ownerType: 'independent',
          behavior: 'freelance',
          autonomy: 1.0,
          profitShare: 1.0,
          currentSectorId: spawnSector,
          position: randomPos(),
          state: 'idle',
          stateStartTime: now,
          cargo: {},
          credits: ECONOMY_SETTINGS.TRADER_STARTING_CREDITS,
          commandQueue: [],
          totalProfit: 0,
          tripsCompleted: 0
        }

        state.fleets.push(newTrader)
        console.log(`[Economy] 🚀 New sole trader entered market: ${newTrader.name} in ${spawnSector}`)
      }
    }
  }

  // ============ Trader → Corporation Promotion ============
  const runTraderPromotion = () => {
    const now = Date.now()
    const promotionCandidates = state.fleets.filter(
      f => f.ownerType === 'independent' && f.credits >= ECONOMY_SETTINGS.TRADER_PROMOTION_THRESHOLD
    )

    for (const trader of promotionCandidates) {
      // Check if they have enough for station + buffer
      if (trader.credits < ECONOMY_SETTINGS.STATION_FOUNDING_COST + 100000) continue

      // Found a new corporation!
      const newCorpId = `corp_${genId()}`
      const traderShortName = trader.name.replace('Independent ', '')
      const newCorp: Corporation = {
        id: newCorpId,
        name: `${traderShortName} Trading Co.`,
        race: trader.race,
        type: 'family', // Small family business
        stationIds: [],
        fleetIds: [trader.id],
        credits: trader.credits - ECONOMY_SETTINGS.STATION_FOUNDING_COST,
        netWorth: trader.credits,
        aggressiveness: 0.3 + Math.random() * 0.3,
        expansionBudget: 50000,
        riskTolerance: 0.5,
        lifetimeProfit: trader.totalProfit,
        lifetimeTrades: trader.tripsCompleted,
        aiState: { lastExpansionCheck: now, currentGoal: 'expand', pendingConstructions: [] }
      }

      // Transfer trader to corp
      trader.ownerId = newCorpId
      trader.ownerType = 'family'
      trader.behavior = 'corp-logistics'
      trader.credits = 10000 // Reset personal funds

      // Start building first station
      const sectorKeys = Object.keys(SECTOR_GRAPH)
      const targetSector = sectorKeys[Math.floor(Math.random() * sectorKeys.length)]
      newCorp.aiState!.pendingConstructions.push({
        id: genId(),
        stationType: 'spp_cycle', // Start with basic solar power
        targetSectorId: targetSector,
        status: 'planning',
        createdAt: now
      })

      state.corporations.push(newCorp)
      console.log(`[Economy] 🎉 ${trader.name} founded ${newCorp.name}! Building first station in ${targetSector}`)
    }
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

    // Run AI
    runCorporationAI()
    spawnSoleTraders()
    runTraderPromotion()

    // ============ Fleet Tick Logic ============
    const now = Date.now()

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
      // Autonomous mode: if fleet has commands queued, let frontend handle it
      // Backend only issues new commands when queue is empty
      const hasQueuedCommands = fleet.commandQueue.length > 0

      // Nudge ships that look stuck mid-order (e.g., forever undocking with cargo loaded)
      if (hasQueuedCommands) {
        const cmd = fleet.commandQueue[0]
        const isTradeCmd = cmd.type === 'trade-buy' || cmd.type === 'trade-sell'
        const stuckTooLong = now - (fleet.stateStartTime || now) > 15000 // 15 seconds of no progress

        if (isTradeCmd && stuckTooLong && (fleet.state === 'undocking' || fleet.state === 'docking' || fleet.state === 'idle')) {
          // Force the ship back into transit toward its target sector
          fleet.state = 'in-transit'
          fleet.destinationSectorId = cmd.targetSectorId
          fleet.stateStartTime = now
        }

        // Hard rescue: if a sell command has been running for a long time, settle the trade to unblock the economy
        if (cmd.type === 'trade-sell' && now - (fleet.stateStartTime || now) > 120000) { // 2 minutes
          const station = state.stations.find(s => s.id === cmd.targetStationId)
          const wareId = cmd.wareId
          const amount = Math.min(cmd.amount || 0, wareId ? (fleet.cargo[wareId] || 0) : 0)
          if (station && wareId && amount > 0) {
            // Transfer cargo
            fleet.cargo[wareId] = Math.max(0, (fleet.cargo[wareId] || 0) - amount)
            station.inventory[wareId] = (station.inventory[wareId] || 0) + amount

            // Credit revenue
            const sellPrice = state.sectorPrices[station.sectorId]?.[wareId] || state.wares.find(w => w.id === wareId)?.basePrice || 0
            const revenue = amount * sellPrice
            fleet.credits += revenue

            // Log trade for visibility
            state.tradeLog.unshift({
              id: genId(),
              timestamp: now,
              fleetId: fleet.id,
              fleetName: fleet.name,
              wareId,
              wareName: state.wares.find(w => w.id === wareId)?.name || wareId,
              quantity: amount,
              buyPrice: 0,
              sellPrice,
              profit: revenue,
              buySectorId: fleet.currentSectorId,
              sellSectorId: station.sectorId,
              buyStationName: fleet.targetStationId || 'unknown',
              sellStationName: station.name,
            })
            if (state.tradeLog.length > 100) state.tradeLog.length = 100
          }

          // Clear command and reset
          fleet.commandQueue = []
          fleet.currentOrder = undefined
          fleet.state = 'idle'
          fleet.stateStartTime = now
          continue
        }

        // Let the frontend continue executing the queued commands
        continue
      }

      if (!hasQueuedCommands && !fleet.currentOrder) {
        // Fleet is idle and needs work

        // Check if fleet has cargo (stuck?)
        const cargoKeys = Object.keys(fleet.cargo)
        if (cargoKeys.length > 0 && cargoKeys.some(k => fleet.cargo[k] > 0)) {
          // Fleet has cargo but no order. Sell it!
          const wareId = cargoKeys.find(k => fleet.cargo[k] > 0)
          if (wareId) {
            // Find buyer
            const buyers = state.stations.filter(st => {
              const r = recipeById.get(st.recipeId)
              if (!r) return false
              const needsWare = r.inputs.some(i => i.wareId === wareId)
              if (!needsWare) return false
              const need = (st.reorderLevel[wareId] || 0) - (st.inventory[wareId] || 0)
              return need > 0
            })

            // Sort by price
            buyers.sort((a, b) => {
              const priceA = state.sectorPrices[a.sectorId]?.[wareId] || 0
              const priceB = state.sectorPrices[b.sectorId]?.[wareId] || 0
              return priceB - priceA
            })

            // Default to best price
            let bestBuyer = buyers[0]

            // Try to find a buyer that is NOT the current station to avoid loops
            if (fleet.targetStationId) {
              const alt = buyers.find(b => b.id !== fleet.targetStationId)
              if (alt) bestBuyer = alt
            }

            // Only rescue if we have significant cargo (ignoring trace amounts < 10)
            if (bestBuyer && (fleet.cargo[wareId] || 0) > 10) {
              console.log(`[Universe] Rescuing stuck fleet ${fleet.name} with ${fleet.cargo[wareId]} ${wareId}. Sending to ${bestBuyer.name}`)
              issueCommand(fleet.id, {
                type: 'trade-sell',
                targetStationId: bestBuyer.id,
                targetSectorId: bestBuyer.sectorId,
                wareId: wareId,
                amount: fleet.cargo[wareId]
              })
              fleet.state = 'in-transit'
              fleet.stateStartTime = now
              continue
            } else if ((fleet.cargo[wareId] || 0) <= 10) {
              // Clear trace amounts
              delete fleet.cargo[wareId]
            }
          }
        }

        if (fleet.behavior === 'patrol') {
          // Patrol logic: Fly to random station in current sector
          const sectorStations = state.stations.filter(s => s.sectorId === fleet.currentSectorId)
          if (sectorStations.length > 0) {
            // 20% chance to switch sectors if connected, BUT only for smaller ships
            // Capital ships (M1/M2/TL) should stay in home sector mostly
            const isCapital = fleet.shipType === 'Phoenix' || fleet.shipType === 'Albatross' || fleet.shipType === 'Condor'
            const switchChance = isCapital ? 0.01 : 0.2

            if (Math.random() < switchChance) {
              const neighbors = SECTOR_GRAPH[fleet.currentSectorId] || []
              if (neighbors.length > 0) {
                const nextSector = neighbors[Math.floor(Math.random() * neighbors.length)]
                issueCommand(fleet.id, {
                  type: 'goto-gate',
                  targetSectorId: nextSector
                })
                issueCommand(fleet.id, {
                  type: 'use-gate',
                  targetSectorId: nextSector
                })
                fleet.state = 'in-transit'
                fleet.stateStartTime = now
                continue
              }
            }

            const randomStation = sectorStations[Math.floor(Math.random() * sectorStations.length)]
            // Don't just fly to the same station we are at
            if (randomStation.id !== fleet.targetStationId) {
              issueCommand(fleet.id, {
                type: 'goto-station',
                targetStationId: randomStation.id,
                targetSectorId: fleet.currentSectorId
              })
              fleet.state = 'in-transit'
              fleet.stateStartTime = now
            }
          }
        } else if (fleet.behavior === 'construction') {
          // Construction logic: Mostly idle, occasionally move
          // For now, just stay put or move very rarely
          if (Math.random() < 0.05) {
            const sectorStations = state.stations.filter(s => s.sectorId === fleet.currentSectorId)
            if (sectorStations.length > 0) {
              const randomStation = sectorStations[Math.floor(Math.random() * sectorStations.length)]
              issueCommand(fleet.id, {
                type: 'goto-station',
                targetStationId: randomStation.id,
                targetSectorId: fleet.currentSectorId
              })
              fleet.state = 'in-transit'
              fleet.stateStartTime = now
            }
          }
        } else {
          // Trade logic
          const order = findBestTradeRoute(fleet)
          if (order) {
            fleet.currentOrder = order
            // Issue high-level trade command
            // The frontend will handle navigation, docking, and loading
            issueCommand(fleet.id, {
              type: 'trade-buy',
              targetStationId: order.buyStationId,
              targetSectorId: order.buySectorId,
              wareId: order.buyWareId,
              amount: order.buyQty
            })
            // Queue Sell command immediately
            issueCommand(fleet.id, {
              type: 'trade-sell',
              targetStationId: order.sellStationId,
              targetSectorId: order.sellSectorId,
              wareId: order.sellWareId,
              amount: order.sellQty
            })
            fleet.state = 'in-transit' // Generic busy state
            fleet.stateStartTime = now
          }
        }
      }
    }

    state.lastTickTime = now
  }

  // Saving logic
  const saveGame = () => {
    try {
      const saveDir = path.resolve(process.cwd(), 'saves')
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir)
      }

      const hour = Math.floor(state.elapsedTimeSec / 3600)
      const slot = (hour % 10) + 1
      const filename = path.join(saveDir, `autosave_${slot}.json`)

      // We don't want to save the entire state if it contains massive logs or unnecessary data
      // but strictly speaking, we should save everything to restore it.
      // state.tradeLog is capped at 100 entries, so it's fine.
      const saveData = JSON.stringify(state, null, 2)
      fs.writeFileSync(filename, saveData)
      console.log(`[Universe] Auto-saved to ${filename} (Hour ${hour})`)
    } catch (e) {
      console.error('[Universe] Failed to save game:', e)
    }
  }

  const advanceTime = (deltaSec: number) => {
    if (deltaSec <= 0) return

    const lastHour = Math.floor(state.elapsedTimeSec / 3600)

    state.acc += deltaSec
    state.elapsedTimeSec += deltaSec

    const currentHour = Math.floor(state.elapsedTimeSec / 3600)

    // Auto-save every in-game hour (3600 seconds)
    if (currentHour > lastHour && currentHour > 0) {
      saveGame()
    }

    if (state.acc >= 10) {
      tick(state.acc)
      state.acc = 0
    }
  }
  const loop = () => {
    const delta = 1 * Math.max(0.1, state.timeScale)
    advanceTime(delta)
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
    gateType?: string
    timestamp: number
  }) => {
    const fleet = state.fleets.find(f => f.id === report.fleetId)
    if (!fleet) return

    // Update fleet position from frontend
    fleet.position = report.position
    fleet.currentSectorId = report.sectorId

    if (report.type !== 'position-update') {
      console.log(`[Universe] Ship report: ${fleet.name} - ${report.type}`)
    }

    // Handle specific report types
    switch (report.type) {
      case 'arrived-at-station':
        fleet.state = 'docking'
        break

      case 'docked':
        // We don't have a specific 'docked' state, but 'docking' implies being at the station
        fleet.state = 'docking'
        break

      case 'undocked':
        // Consider undocking complete on report; keep ship free to move immediately
        fleet.state = 'idle'
        fleet.stateStartTime = report.timestamp || Date.now()
        break

      case 'queue-complete':
        console.log(`[Universe] Fleet ${fleet.name} finished queue. Resetting to IDLE.`)
        fleet.commandQueue = []
        fleet.currentOrder = undefined
        fleet.state = 'idle'
        break

      case 'arrived-at-gate':
        fleet.state = 'in-transit'
        break

      case 'entered-sector':
        if (report.stationId) {
          fleet.currentSectorId = report.stationId
          fleet.destinationSectorId = undefined
          fleet.state = 'idle'

          // Use the position provided in the report (calculated by frontend with correct scale)
          if (report.position) {
            fleet.position = report.position
          } else {
            // Fallback: Calculate spawn position based on arrival gate
            // Standard gate positions in frontend are scaled by 30 (5000 * 30 = 150000)
            // N: [0,0,-150000], S: [0,0,150000], W: [-150000,0,0], E: [150000,0,0]

            let spawnPos: [number, number, number] = [0, 0, 0]
            const offset = 2000 // Distance from gate center
            const GATE_DIST = 150000

            if (report.gateType === 'N') {
              // Arrive at South Gate
              spawnPos = [0, 0, GATE_DIST - offset]
            } else if (report.gateType === 'S') {
              // Arrive at North Gate
              spawnPos = [0, 0, -GATE_DIST + offset]
            } else if (report.gateType === 'W') {
              // Arrive at East Gate
              spawnPos = [GATE_DIST - offset, 0, 0]
            } else if (report.gateType === 'E') {
              // Arrive at West Gate
              spawnPos = [-GATE_DIST + offset, 0, 0]
            } else {
              spawnPos = randomPos()
            }

            fleet.position = spawnPos
          }
        }
        break

      case 'cargo-loaded':
        // Transaction: Buy from station
        if (report.wareId && report.amount && report.stationId) {
          const station = state.stations.find(s => s.id === report.stationId)
          const order = fleet.currentOrder

          if (station && order) {
            // Deduct from station, add to fleet
            const available = station.inventory[report.wareId] || 0
            const actualAmount = Math.min(report.amount, available)

            station.inventory[report.wareId] = Math.max(0, available - actualAmount)
            fleet.cargo[report.wareId] = (fleet.cargo[report.wareId] || 0) + actualAmount
            fleet.credits -= actualAmount * order.buyPrice

            // Issue next command: Sell
            // Remove the buy command from queue (it should be done)
            fleet.commandQueue = []

            issueCommand(fleet.id, {
              type: 'trade-sell',
              targetStationId: order.sellStationId,
              targetSectorId: order.sellSectorId,
              wareId: order.sellWareId,
              amount: actualAmount
            })
            fleet.state = 'in-transit'
          }
        }
        break

      case 'cargo-unloaded':
        // Transaction: Sell to station
        if (report.wareId && report.amount && report.stationId) {
          const station = state.stations.find(s => s.id === report.stationId)
          const order = fleet.currentOrder

          if (station) {
            // Add to station, remove from fleet
            station.inventory[report.wareId] = (station.inventory[report.wareId] || 0) + report.amount
            fleet.cargo[report.wareId] = Math.max(0, (fleet.cargo[report.wareId] || 0) - report.amount)
            if (fleet.cargo[report.wareId] === 0) delete fleet.cargo[report.wareId]

            const sellPrice = order ? order.sellPrice : (state.sectorPrices[station.sectorId]?.[report.wareId] || 0)
            const buyPrice = order ? order.buyPrice : 0 // We don't track buy price for lost orders/rescues

            const revenue = report.amount * sellPrice
            const cost = report.amount * buyPrice
            const profit = revenue - cost

            fleet.credits += revenue
            fleet.totalProfit += profit
            fleet.tripsCompleted++

            // Log trade
            state.tradeLog.unshift({
              id: genId(),
              timestamp: Date.now(),
              fleetId: fleet.id,
              fleetName: fleet.name,
              wareId: report.wareId,
              wareName: order ? order.sellWareName : getWareName(report.wareId),
              quantity: report.amount,
              buyPrice: buyPrice,
              sellPrice: sellPrice,
              profit,
              buySectorId: order ? order.buySectorId : 'unknown',
              sellSectorId: order ? order.sellSectorId : station.sectorId,
              buyStationName: order ? order.buyStationName : 'unknown',
              sellStationName: order ? order.sellStationName : station.name,
            })
            if (state.tradeLog.length > 100) state.tradeLog.length = 100

            // Profit share
            if (fleet.ownerId) {
              const corp = state.corporations.find(c => c.id === fleet.ownerId)
              if (corp) {
                const share = profit * (1 - fleet.profitShare)
                corp.credits += share
                corp.lifetimeProfit += share
                corp.lifetimeTrades++
              }
            }

            // Order complete
            fleet.currentOrder = undefined
            fleet.commandQueue = []
            fleet.state = 'idle'
          }
        }
        break

        break
    }
  }

  return { state, init, tick, loop, setTimeScale, handleShipReport, issueCommand, advanceTime }
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
            elapsedTimeSec: u.state.elapsedTimeSec,
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
          const full = new URL(url, 'http://localhost')
          const fresh = full.searchParams.get('fresh') === 'true'
          u.init({ fresh })
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method === 'POST' && url.startsWith('/__universe/tick')) {
          const full = new URL(url, 'http://localhost')
          const d = Number(full.searchParams.get('delta') || '0')
          u.advanceTime(d)
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
