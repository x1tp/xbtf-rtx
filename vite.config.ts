import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import react from '@vitejs/plugin-react'
import { INITIAL_CORPORATIONS, INITIAL_FLEETS } from './src/types/simulation'
import { UNIVERSE_SECTORS_XBTF } from './src/config/universe_xbtf'
import { getSectorLayoutById } from './src/config/sector'
import { CUSTOM_STATIONS } from './src/config/stations_custom'
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
type ShipCommandType = 'goto-station' | 'dock' | 'load-cargo' | 'unload-cargo' | 'store-cargo' | 'undock' | 'goto-gate' | 'use-gate' | 'patrol' | 'wait' | 'trade-buy' | 'trade-sell' | 'move-to-sector'
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

// Derive sector price map from station inventories/reserves
const computeSectorPrices = (stations: Station[], recipes: Recipe[], wares: Ware[]) => {
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const priceMap: Record<string, Record<string, number>> = {}

  for (const st of stations) {
    const r = recipeById.get(st.recipeId)
    if (!r) continue
    const sp = priceMap[st.sectorId] || {}

    // Price inputs higher when low, lower when stocked
    for (const x of r.inputs) {
      const base = wares.find((w) => w.id === x.wareId)?.basePrice || 1
      const stock = st.inventory[x.wareId] || 0
      const rl = st.reorderLevel[x.wareId] || 0
      const mod = Math.max(0.5, Math.min(2.0, rl <= 0 ? 1 : 1 + (rl - stock) / Math.max(rl, 1)))
      sp[x.wareId] = base * mod
    }

    // Price products lower when lots in reserve, higher when scarce
    const baseProd = wares.find((w) => w.id === r.productId)?.basePrice || 1
    const prodStock = st.inventory[r.productId] || 0
    const reserve = st.reserveLevel[r.productId] || 0
    const modProd = Math.max(0.5, Math.min(2.0, reserve <= 0 ? 1 : 1 - (reserve - prodStock) / Math.max(reserve, 1)))
    sp[r.productId] = baseProd * modProd

    priceMap[st.sectorId] = sp
  }

  return priceMap
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

  // Sector adjacency for routing - derived from universe_xbtf.ts neighbors (using sector IDs)
  const SECTOR_GRAPH: Record<string, string[]> = (() => {
    const idByName = new Map(UNIVERSE_SECTORS_XBTF.map(s => [s.name.toLowerCase(), s.id]))
    const graph: Record<string, string[]> = {}
    UNIVERSE_SECTORS_XBTF.forEach(sector => {
      graph[sector.id] = (sector.neighbors || [])
        .map(n => idByName.get(n.toLowerCase()))
        .filter((id): id is string => Boolean(id))
    })
    return graph
  })()

  // Legacy station ID mapping (older save/game configs) -> current procedural IDs
  // This keeps fleets with old homeStationIds working after the station ID cleanup.
  const LEGACY_STATION_ID_MAP: Record<string, string[]> = {
    sz_spp_b: ['seizewell_solar_power_plant_b', 'seizewell_solar_power_plant_b_2'],
    sz_spp_d: ['seizewell_solar_power_plant_delta', 'seizewell_solar_power_plant_delta_2'],
    ps_spp: ['profit_share_solar_power_plant_m', 'profit_share_solar_power_plant_m_2'],
    sz_oil: ['seizewell_sun_oil_refinery_beta', 'seizewell_sun_oil_refinery_beta_2'],
    sz_ire: ['seizewell_beta_i_r_e_laser_forge_alpha', 'seizewell_beta_i_r_e_laser_forge_alpha_2'],
    gp_dream: ['greater_profit_dream_farm_m', 'greater_profit_dream_farm_m_2'],
  }

  const remapLegacyStations = () => {
    const stationIdSet = new Set(state.stations.map(s => s.id))
    const resolveStationId = (id?: string) => {
      if (!id) return undefined
      if (stationIdSet.has(id)) return id
      const mapped = LEGACY_STATION_ID_MAP[id]?.find(c => stationIdSet.has(c))
      return mapped
    }

    for (const fleet of state.fleets) {
      // Fix home station references first
      if (fleet.homeStationId && !stationIdSet.has(fleet.homeStationId)) {
        const mapped = resolveStationId(fleet.homeStationId)
        if (mapped) {
          console.log(`[Universe] Remapped home station ${fleet.homeStationId} -> ${mapped} for ${fleet.name}`)
          fleet.homeStationId = mapped
        } else {
          console.warn(`[Universe] Home station ${fleet.homeStationId} missing for ${fleet.name}, switching to freelance`)
          fleet.homeStationId = undefined
          if (fleet.behavior === 'station-supply' || fleet.behavior === 'station-distribute') {
            fleet.behavior = 'freelance'
          }
        }
      }

      // Patch any queued commands/orders that pointed at legacy IDs
      fleet.commandQueue = fleet.commandQueue.map(cmd => {
        if (cmd.targetStationId) {
          const mapped = resolveStationId(cmd.targetStationId)
          if (mapped) cmd.targetStationId = mapped
        }
        return cmd
      })

      if (fleet.currentOrder) {
        const order = fleet.currentOrder
        order.buyStationId = resolveStationId(order.buyStationId) || order.buyStationId
        order.sellStationId = resolveStationId(order.sellStationId) || order.sellStationId
      }
    }
  }

  // Preferred starting hubs per race (used when a fleet lacks an explicit home sector)
  const RACE_HOME_SECTOR: Record<RaceType, string> = {
    teladi: 'seizewell',
    argon: 'argon_prime',
    boron: 'kingdom_end',
    split: 'thuruks_pride',
    paranid: 'paranid_prime',
    pirate: 'company_pride',
    xenon: 'xenon_sector_3',
  }

  // Keep independents distributed across the map instead of dog-piling Seizewell
  const INDEPENDENT_START_SECTORS = [
    'seizewell',
    'profit_share',
    'teladi_gain',
    'argon_prime',
    'home_of_light',
    'kingdom_end',
    'family_whi',
    'paranid_prime',
    'company_pride',
  ]
  let independentStartCursor = Math.floor(Math.random() * INDEPENDENT_START_SECTORS.length)
  const pickIndependentStartSector = () => {
    const sector = INDEPENDENT_START_SECTORS[independentStartCursor % INDEPENDENT_START_SECTORS.length]
    independentStartCursor += 1
    return sector
  }

  const getRaceHub = (race?: RaceType) => (race ? RACE_HOME_SECTOR[race] : null) || 'seizewell'

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

  // Normalize fleet start positions to their intended home space
  const rehomeFleet = (fleet: NPCFleet) => {
    if (fleet.ownerType === 'independent') {
      const startSector = pickIndependentStartSector()
      fleet.homeSectorId = startSector
      fleet.currentSectorId = startSector
      fleet.destinationSectorId = undefined
      fleet.commandQueue = []
      fleet.position = randomPos()
      return
    }

    const home = fleet.homeSectorId || getRaceHub(fleet.race)
    if (!home) return
    fleet.homeSectorId = home
    fleet.currentSectorId = home
    fleet.destinationSectorId = undefined
    fleet.commandQueue = []
    fleet.position = randomPos()
  }

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
        state.sectorPrices = Object.keys(loadedState.sectorPrices || {}).length > 0
          ? loadedState.sectorPrices
          : computeSectorPrices(loadedState.stations, loadedState.recipes, loadedState.wares)
        state.timeScale = 1 // Reset time scale on load
        state.elapsedTimeSec = loadedState.elapsedTimeSec
        state.corporations = loadedState.corporations
        state.fleets = loadedState.fleets
        state.tradeLog = loadedState.tradeLog || []
        remapLegacyStations()
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
      // Boron / Split / Paranid Wares
      { id: 'stott_spices', name: 'Stott Spices', category: 'food', basePrice: 72, volume: 1 },
      { id: 'soya_beans', name: 'Soya Beans', category: 'food', basePrice: 14, volume: 1 },
      { id: 'soya_husk', name: 'Soya Husk', category: 'food', basePrice: 364, volume: 1 },
      { id: 'maja_snails', name: 'Maja Snails', category: 'food', basePrice: 80, volume: 1 },
      { id: 'majaglit', name: 'Majaglit', category: 'end', basePrice: 50, volume: 1 }, // Actually intermediate/end
      { id: 'massom_powder', name: 'Massom Powder', category: 'food', basePrice: 50, volume: 1 },
      { id: 'chelt_meat', name: 'Chelt Meat', category: 'food', basePrice: 104, volume: 1 },
      { id: 'nostrop_oil', name: 'Nostrop Oil', category: 'food', basePrice: 72, volume: 1 }, // Teladi secondary food?
      { id: 'swamp_plant', name: 'Swamp Plant', category: 'food', basePrice: 154, volume: 1 }, // Space weed ingredient usually
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

      // Boron Additional
      { id: 'stott_mixery', productId: 'stott_spices', inputs: [{ wareId: 'plankton', amount: 10 }, { wareId: 'energy_cells', amount: 12 }], cycleTimeSec: 100, batchSize: 20, productStorageCap: 1000 },

      // Split Additional
      { id: 'chelt_aquarium', productId: 'chelt_meat', inputs: [{ wareId: 'energy_cells', amount: 8 }], cycleTimeSec: 90, batchSize: 10, productStorageCap: 800 },
      // Rastar Refinery consumes Chelt Meat usually, but for now we mapped it to Scruffin Fruit in old config.
      // Let's fix Rastar Refinery to use Chelt Meat if we want accuracy, but strict adherence to old code might break simulation if fleets expect scruffin.
      // But user asked for accuracy. Let's add Massom Mill.
      { id: 'massom_mill', productId: 'massom_powder', inputs: [{ wareId: 'scruffin_fruit', amount: 10 }, { wareId: 'energy_cells', amount: 12 }], cycleTimeSec: 90, batchSize: 20, productStorageCap: 1000 },

      // Paranid Additional
      { id: 'snail_ranch', productId: 'maja_snails', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 100, batchSize: 10, productStorageCap: 800 },
      { id: 'soyfarm', productId: 'soya_beans', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 80, batchSize: 40, productStorageCap: 2000 },
      { id: 'soyery', productId: 'soya_husk', inputs: [{ wareId: 'soya_beans', amount: 10 }, { wareId: 'energy_cells', amount: 12 }], cycleTimeSec: 90, batchSize: 15, productStorageCap: 1000 },
      { id: 'majaglit_factory', productId: 'majaglit', inputs: [{ wareId: 'maja_snails', amount: 10 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 100, batchSize: 10, productStorageCap: 500 },
      { id: 'shield_plant', productId: 'hept_laser', inputs: [{ wareId: 'quantum_tubes', amount: 5 }, { wareId: 'energy_cells', amount: 50 }], cycleTimeSec: 300, batchSize: 1, productStorageCap: 20 }, // Placeholder for generic shield

      // Logistics hubs (trading station / equipment dock)
      { id: 'logistics_hub', productId: 'trade_goods', inputs: [], cycleTimeSec: 120, batchSize: 5, productStorageCap: 500 },
      // Shipyard (produces ship parts to justify inputs)
      { id: 'shipyard', productId: 'ship_parts', inputs: [{ wareId: 'teladianium', amount: 20 }, { wareId: 'ore', amount: 20 }, { wareId: 'energy_cells', amount: 100 }], cycleTimeSec: 240, batchSize: 10, productStorageCap: 500 },
    ]
    // Load custom stations
    const stations: Station[] = []
    const spacing = 30
    const slug = (name: string, fallback: string) => {
      const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      return s || fallback
    }

    const pickRecipeId = (name: string): string => {
      const n = name.toLowerCase()
      if (n.includes('solar power')) return 'spp_teladi'
      if (n.includes('spp')) return 'spp_teladi'
      if (n.includes('flower')) return 'flower_farm'
      if (n.includes('dream')) return 'dream_farm'
      if (n.includes('bliss')) return 'bliss_place'
      if (n.includes('sun oil') || n.includes('oil refinery')) return 'sun_oil_refinery'
      if (n.includes('teladianium')) return 'teladianium_foundry'
      if (n.includes('ore mine')) return 'ore_mine'
      if (n.includes('silicon')) return 'silicon_mine'
      if (n.includes('crystal')) return 'crystal_fab'
      if (n.includes('equipment dock') || n.includes('trading station')) return 'logistics_hub'
      if (n.includes('shipyard')) return 'shipyard'
      if (n.includes('cattle ranch') || n.includes('wheat')) return 'argon_farm'
      if (n.includes('cahoona')) return 'cahoona_bakery'
      if (n.includes('plankton')) return 'plankton_farm'
      if (n.includes('bogas')) return 'bogas_plant'
      if (n.includes('bofu')) return 'bofu_lab'
      if (n.includes('scruffin')) return 'scruffin_farm'
      if (n.includes('rastar')) return 'rastar_refinery'
      if (n.includes('quantum')) return 'quantum_tube_fab'
      if (n.includes('chip')) return 'chip_plant'
      if (n.includes('computer')) return 'computer_plant'
      if (n.includes('shield')) return 'hept_forge'
      if (n.includes('ire') || n.includes('laser')) return 'ire_forge'
      // New mappings
      if (n.includes('stott')) return 'stott_mixery'
      if (n.includes('soyfarm')) return 'soyfarm'
      if (n.includes('soyery')) return 'soyery'
      if (n.includes('snail')) return 'snail_ranch'
      if (n.includes('majaglit')) return 'majaglit_factory'
      if (n.includes('massom')) return 'massom_mill'
      if (n.includes('chelt')) return 'chelt_aquarium'

      return 'logistics_hub'
    }

    // 1. Process CUSTOM_STATIONS to assign positions and merge with layout
    const existingIds = new Set<string>()

    // Helper to find layout position
    const getLayoutPos = (sectorId: string, stationName: string): [number, number, number] | undefined => {
      const layout = getSectorLayoutById(sectorId)
      if (layout) {
        // Try precise match
        let found = layout.stations.find(s => s.name === stationName)
        if (found) return [found.position[0] * spacing, found.position[1] * spacing, found.position[2] * spacing]
        // Try fuzzy match if needed?
      }
      return undefined
    }

    // Initialize corporations for lookup
    // Initialize corporations for lookup
    const corporations: Corporation[] = INITIAL_CORPORATIONS.map((c) => ({
      ...c,
      stationIds: [...c.stationIds],
      fleetIds: [...c.fleetIds],
    })) as unknown as Corporation[]

    // Helper for ownership
    // Shipyards / Equipment Docks / Trading Stations -> State (or specific race gov/tech corp)
    // Factories -> 30% Independent, 70% Corp (Distributed)
    const assignOwner = (st: any): { ownerId: string | null; ownerType: OwnershipType } => {
      const name = st.name.toLowerCase()
      const sectorId = st.sectorId

      // State Infrastructure
      if (name.includes('shipyard') || name.includes('equipment dock') || name.includes('trading station') || name.includes('wharf')) {
        // Find state corp for this sector's race
        // We know sector owner from universe data but let's infer from sectorId prefix or hardcode
        let race: RaceType = 'teladi'
        if (sectorId.includes('argon') || sectorId.includes('cloudbase') || sectorId.includes('president') || sectorId.includes('home') || sectorId.includes('red') || sectorId.includes('three') || sectorId.includes('power') || sectorId.includes('antigone') || sectorId.includes('herron') || sectorId.includes('hole') || sectorId.includes('wall') || sectorId.includes('ore')) race = 'argon'
        else if (sectorId.includes('kingdom') || sectorId.includes('rolk') || sectorId.includes('que') || sectorId.includes('menelaus') || sectorId.includes('atreus')) race = 'boron'
        else if (sectorId.includes('paranid') || sectorId.includes('priest') || sectorId.includes('emp') || sectorId.includes('duke') || sectorId.includes('trinity')) race = 'paranid'
        else if (sectorId.includes('family') || sectorId.includes('thuruk') || sectorId.includes('chin') || sectorId.includes('cho')) race = 'split'
        else if (sectorId.includes('xenon')) race = 'xenon'

        if (race === 'xenon') return { ownerId: 'xenon_collective', ownerType: 'state' }

        // Find a 'state' corporation for this race
        const stateCorp = corporations.find(c => c.race === race && c.type === 'state')
        if (stateCorp) return { ownerId: stateCorp.id, ownerType: 'state' }
        // Fallback
        return { ownerId: null, ownerType: 'independent' }
      }

      // Pirate Bases
      if (name.includes('pirate')) {
        const pirateCorp = corporations.find(c => c.id === 'pirate_clans')
        return { ownerId: pirateCorp ? pirateCorp.id : null, ownerType: 'guild' }
      }

      // Factories
      if (Math.random() < 0.3) {
        return { ownerId: null, ownerType: 'independent' }
      } else {
        // Assign to corporation
        // Find corps of the sector's race? Or any race?
        // Let's stick to sector race mainly, or Teladi everywhere?
        // Let's check sector owner first.
        let race: RaceType = 'teladi' // Default
        if (sectorId.includes('argon') || sectorId.includes('cloudbase') || sectorId.includes('president') || sectorId.includes('home') || sectorId.includes('red') || sectorId.includes('three') || sectorId.includes('power') || sectorId.includes('antigone') || sectorId.includes('herron') || sectorId.includes('hole') || sectorId.includes('wall') || sectorId.includes('ore')) race = 'argon'
        else if (sectorId.includes('kingdom') || sectorId.includes('rolk') || sectorId.includes('que') || sectorId.includes('menelaus') || sectorId.includes('atreus')) race = 'boron'
        else if (sectorId.includes('paranid') || sectorId.includes('priest') || sectorId.includes('emp') || sectorId.includes('duke') || sectorId.includes('trinity')) race = 'paranid'
        else if (sectorId.includes('family') || sectorId.includes('thuruk') || sectorId.includes('chin') || sectorId.includes('cho')) race = 'split'
        else if (sectorId.includes('xenon')) race = 'xenon'

        // Filter suitable corps (not state, unless they run factories too? Usually separate)
        const candidates = corporations.filter(c => c.race === race && c.type !== 'state')
        if (candidates.length > 0) {
          const c = candidates[Math.floor(Math.random() * candidates.length)]
          return { ownerId: c.id, ownerType: c.type }
        } else {
          // Fallback to Teladi corps or Independent
          const teladi = corporations.filter(c => c.race === 'teladi' && c.type !== 'state')
          if (teladi.length > 0 && Math.random() < 0.5) {
            const c = teladi[Math.floor(Math.random() * teladi.length)]
            return { ownerId: c.id, ownerType: c.type }
          }
          return { ownerId: null, ownerType: 'independent' }
        }
      }
    }

    // Load CUSTOM_STATIONS
    CUSTOM_STATIONS.forEach(cs => {
      // Check ID uniqueness
      let finalId = cs.id
      if (existingIds.has(finalId)) {
        let k = 2
        while (existingIds.has(`${finalId}_${k}`)) k++
        finalId = `${finalId}_${k}`
      }
      existingIds.add(finalId)

      // Position
      // Position
      let pos = (cs as any).position || getLayoutPos(cs.sectorId, cs.name) || randomPos()

      const ownership = assignOwner(cs)

      const st: Station = {
        id: finalId,
        name: cs.name,
        recipeId: cs.recipeId,
        sectorId: cs.sectorId,
        inventory: cs.inventory as Record<string, number>,
        reorderLevel: cs.reorderLevel,
        reserveLevel: cs.reserveLevel,
        position: pos,
        modelPath: '/models/00001.obj', // Default, should ideally lookup blueprint
        ownerId: ownership.ownerId || undefined
      }

      // Try lookup model from layout
      const layout = getSectorLayoutById(cs.sectorId)
      if (layout) {
        const bp = layout.stations.find(s => s.name === cs.name)
        if (bp) st.modelPath = bp.modelPath
      }
      // If still default, try naive mapping based on recipe
      if (st.modelPath === '/models/00001.obj') {
        if (st.recipeId === 'spp_teladi') st.modelPath = '/models/00285.obj'
        else if (st.recipeId === 'shipyard') st.modelPath = '/models/00444.obj'
        else if (st.recipeId === 'logistics_hub') st.modelPath = '/models/00448.obj'
        // ... add more if needed
      }


      // Seed if inventory empty
      // Processing both seeded custom stations (if they were 0) and procedural ones
      const recipe = recipes.find(r => r.id === st.recipeId)
      if (recipe) {
        const hasInventory = Object.keys(st.inventory).length > 0

        if (!hasInventory) {
          // Seed inputs (enough for ~20-50 cycles)
          recipe.inputs.forEach(i => {
            st.inventory[i.wareId] = Math.max(1, Math.floor(i.amount * (20 + Math.random() * 30)))
          })
          // Seed output (some small starting stock, 10-30% of cap)
          if (recipe.productStorageCap > 0) {
            st.inventory[recipe.productId] = Math.max(1, Math.floor(recipe.productStorageCap * (0.1 + Math.random() * 0.2)))
          }
        }

        // Ensure reorder/reserve levels are set
        if (Object.keys(st.reorderLevel).length === 0) {
          recipe.inputs.forEach(i => st.reorderLevel[i.wareId] = i.amount * 20)
        }
        if (Object.keys(st.reserveLevel).length === 0 && recipe.productStorageCap > 0) {
          st.reserveLevel[recipe.productId] = recipe.productStorageCap * 0.2
        }
      }

      stations.push(st)

      // Add to corp assets
      if (ownership.ownerId) {
        const corp = corporations.find(c => c.id === ownership.ownerId)
        if (corp) corp.stationIds.push(finalId)
      }
    })

    // 2. Add remaining stations from sector layouts (procedural / blueprint based)
    // capable of handling stations not in the custom list
    for (const sector of UNIVERSE_SECTORS_XBTF) {
      const layout = getSectorLayoutById(sector.id)
      if (!layout) continue
      layout.stations.forEach((st, idx) => {
        const id = `${sector.id}_${slug(st.name, String(idx))}`
        if (existingIds.has(id)) return
        existingIds.add(id)

        // ownership
        const ownership = assignOwner({ name: st.name, sectorId: sector.id })

        // model path inference?
        let modelPath = st.modelPath
        const rid = pickRecipeId(st.name)

        const station: Station = {
          id,
          name: st.name,
          recipeId: rid,
          sectorId: sector.id,
          position: [st.position[0] * spacing, st.position[1] * spacing, st.position[2] * spacing],
          modelPath: modelPath,
          inventory: {}, // Start empty or seeded?
          reorderLevel: {},
          reserveLevel: {},
          ownerId: ownership.ownerId || undefined
        }

        // Seed resources if empty
        const recipe = recipes.find(r => r.id === rid)
        if (recipe) {
          recipe.inputs.forEach(i => {
            station.inventory[i.wareId] = Math.max(1, Math.floor(i.amount * (20 + Math.random() * 30)))
            // Init reorder level
            station.reorderLevel[i.wareId] = i.amount * 20
          })
          if (recipe.productStorageCap > 0) {
            station.inventory[recipe.productId] = Math.max(1, Math.floor(recipe.productStorageCap * (0.1 + Math.random() * 0.2)))
            // Init reserve level
            station.reserveLevel[recipe.productId] = recipe.productStorageCap * 0.2
          }
        }

        stations.push(station)

        if (ownership.ownerId) {
          const corp = corporations.find(c => c.id === ownership.ownerId)
          if (corp) corp.stationIds.push(id)
        }
      })
    }

    // Populate sector prices
    state.wares = wares
    state.recipes = recipes
    state.stations = stations
    state.sectorPrices = computeSectorPrices(stations, recipes, wares)

    // Corporations already initialized above, but we need to assign the updated list to state
    // But we copied INITIAL_CORPORATIONS, so we're good.

    // Initial fleet spawn configs
    const fleetConfigs = [
      ...INITIAL_FLEETS,
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
      let modelPath = (cfg as any).modelPath || '/models/00007.obj'
      if (cfg.shipType === 'Phoenix') modelPath = '/models/00140.obj'
      else if (cfg.shipType === 'Albatross') modelPath = '/models/00187.obj'
      else if (cfg.shipType === 'Osprey') modelPath = '/models/00141.obj'

      const fleet: NPCFleet = {
        id: `fleet_${genId()}`,
        name: `${cfg.shipType} ${cfg.ownerId ? corporations.find(c => c.id === cfg.ownerId)?.name?.split(' ')[0] || '' : 'Independent'}-${i + 1}`,
        shipType: cfg.shipType,
        modelPath: modelPath,
        race: (cfg as any).race || 'teladi',
        capacity: cfg.capacity,
        speed: cfg.speed,
        homeSectorId: cfg.homeSectorId,
        ownerId: cfg.ownerId,
        ownerType: cfg.ownerType,
        homeStationId: (cfg as any).homeStationId,
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

    // Ensure fleets actually start in their home sectors (and spread independents)
    fleets.forEach(rehomeFleet)

    state.corporations = corporations
    state.fleets = fleets
    remapLegacyStations()
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
          const spawnSector = getRaceHub(corp.race) // Default to corp/race home sector

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
        const shipyard = getRaceHub(corp.race)
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
        const spawnSector = pickIndependentStartSector()

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
    state.stations = nextStations
    state.sectorPrices = computeSectorPrices(nextStations, state.recipes, state.wares)

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

      if (routes.length === 0) {
        // console.log(`[Universe] No routes found for ${fleet.name} (checked ${state.stations.length} stations)`)
        return null
      }

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

      // Systemic Queue Cleanup (gentler)
      // If we detect a mismatch, try to resume instead of wiping commands.
      if (hasQueuedCommands && fleet.currentOrder) {
        const stuckDuration = now - (fleet.stateStartTime || now)
        if (stuckDuration > 300000) { // 5 minutes with an order and commands
          const ok = settleCurrentOrder(fleet)
          if (ok) continue
        }
      }

      if (hasQueuedCommands) {
        const stuckDuration = now - (fleet.stateStartTime || now)
        const isDesync = fleet.state === 'idle'
        const zombieLimit = fleet.behavior === 'construction' ? 900000 : 300000 // Construction TLs get a bigger window
        const isZombieTransit = fleet.state === 'in-transit' && stuckDuration > zombieLimit

        if (isDesync || isZombieTransit) {
          const cmd = fleet.commandQueue[0]
          // Nudge the fleet back into transit toward the current command's sector
          const targetSector = cmd?.targetSectorId || fleet.destinationSectorId || fleet.currentSectorId
          if (targetSector && targetSector !== fleet.currentSectorId) {
            fleet.destinationSectorId = targetSector
          }
          fleet.state = 'in-transit'
          fleet.stateStartTime = now
          // Do NOT clear the queue; let the frontend continue executing
          continue
        }
      }

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
        if (cmd.type === 'trade-sell' && now - (fleet.stateStartTime || now) > 300000) { // 5 minutes grace
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



      if (!hasQueuedCommands) {
        // Fleet is idle and needs work (either legitimate idle, or stuck with zombie order)

        // 1. STUCK CARGO RESCUE (Prioritize clearing cargo over new orders)
        // Check if fleet has cargo (stuck?)
        const cargoKeys = Object.keys(fleet.cargo)
        if (cargoKeys.length > 0 && cargoKeys.some(k => fleet.cargo[k] > 0)) {
          // If a trade order exists, give it a chance to resume instead of forcing storage
          if (fleet.currentOrder) {
            // Skip rescue, let the order be reissued below
          } else {
            // Fleet has cargo but no commands. Store it at a safe location!
            const totalCargo = cargoKeys.reduce((sum, k) => sum + (fleet.cargo[k] || 0), 0)

            // Only rescue if we have significant cargo (ignoring trace amounts < 10)
            if (totalCargo > 10) {
              // Find a storage station for this fleet
              let storageStation: Station | null = null

              if (fleet.ownerId) {
                // Corporation-owned ship: find owner's nearest station
                const corp = state.corporations.find(c => c.id === fleet.ownerId)
                if (corp && corp.stationIds.length > 0) {
                  // Prefer station in current sector, then any corp station
                  const corpStations = state.stations.filter(s => corp.stationIds.includes(s.id))
                  storageStation = corpStations.find(s => s.sectorId === fleet.currentSectorId)
                    || corpStations[0] || null
                }
              }

              if (!storageStation) {
                // Independent or no corp station found: use Trading Station (rental storage)
                // Find nearest Trading Station
                const tradingStations = state.stations.filter(s =>
                  s.recipeId === 'trading_station' || s.name.toLowerCase().includes('trading')
                )
                storageStation = tradingStations.find(s => s.sectorId === fleet.currentSectorId)
                  || tradingStations[0] || null
              }

              if (!storageStation) {
                // Fallback: any station in current sector
                storageStation = state.stations.find(s => s.sectorId === fleet.currentSectorId) || null
              }

              if (storageStation) {
                const isRental = !fleet.ownerId || !state.corporations.find(c => c.id === fleet.ownerId)?.stationIds.includes(storageStation!.id)
                console.log(`[Universe] Storing stuck cargo for ${fleet.name} at ${storageStation.name}${isRental ? ' (rental)' : ' (corp storage)'}`)

                // Issue commands: goto -> dock -> store-cargo -> undock
                issueCommand(fleet.id, {
                  type: 'goto-station',
                  targetStationId: storageStation.id,
                  targetSectorId: storageStation.sectorId
                })
                issueCommand(fleet.id, {
                  type: 'dock',
                  targetStationId: storageStation.id
                })
                issueCommand(fleet.id, {
                  type: 'store-cargo',
                  targetStationId: storageStation.id
                })
                issueCommand(fleet.id, {
                  type: 'undock',
                  targetStationId: storageStation.id
                })

                fleet.state = 'in-transit'
                fleet.stateStartTime = now
                continue
              }
            } else {
              // Clear trace amounts
              for (const k of cargoKeys) {
                if ((fleet.cargo[k] || 0) <= 10) {
                  delete fleet.cargo[k]
                }
              }
            }
          }
        }

        // 1.5 REQUEUE LOST TRANSIT (e.g., TLs with destination but empty queue)
        if (fleet.state === 'in-transit' && !hasQueuedCommands && fleet.destinationSectorId) {
          const path = findSectorPath(fleet.currentSectorId, fleet.destinationSectorId)
          if (path && path.length > 0) {
            const nextSector = path[0]
            issueCommand(fleet.id, { type: 'goto-gate', targetSectorId: nextSector })
            issueCommand(fleet.id, { type: 'use-gate', targetSectorId: nextSector })
            fleet.state = 'in-transit'
            fleet.stateStartTime = now
            continue
          } else if (path && path.length === 0) {
            // Already there
            fleet.state = 'idle'
            fleet.destinationSectorId = undefined
          }
        }

        // 2. REGULAR TRADE LOGIC (Only if no current order)
        if (!fleet.currentOrder) {

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
                // Issue explicit patrol order: Fly -> Dock -> Undock (simulating a patrol stop/visit)
                // This prevents the "fly to where I already am" loop and adds meaningful delay
                issueCommand(fleet.id, {
                  type: 'goto-station',
                  targetStationId: randomStation.id,
                  targetSectorId: fleet.currentSectorId,
                })
                issueCommand(fleet.id, {
                  type: 'dock',
                  targetStationId: randomStation.id
                })
                issueCommand(fleet.id, {
                  type: 'undock',
                  targetStationId: randomStation.id
                })

                fleet.state = 'in-transit'
                fleet.stateStartTime = now
                fleet.targetStationId = randomStation.id // Update this so we don't pick it again immediately
              }
            }
          } else if (fleet.behavior === 'construction') {
            // Construction logic: Mostly idle, occasionally move
            // For now, just stay put or move very rarely
            if (Math.random() < 0.05) {
              const sectorStations = state.stations.filter(s => s.sectorId === fleet.currentSectorId)
              if (sectorStations.length > 0) {
                const randomStation = sectorStations[Math.floor(Math.random() * sectorStations.length)]

                if (randomStation.id !== fleet.targetStationId) {
                  issueCommand(fleet.id, {
                    type: 'goto-station',
                    targetStationId: randomStation.id,
                    targetSectorId: fleet.currentSectorId
                  })
                  issueCommand(fleet.id, {
                    type: 'dock',
                    targetStationId: randomStation.id
                  })
                  issueCommand(fleet.id, {
                    type: 'undock',
                    targetStationId: randomStation.id
                  })

                  fleet.state = 'in-transit'
                  fleet.stateStartTime = now
                  fleet.targetStationId = randomStation.id
                }
              }
            }
          } else {
            // Trade logic
            const order = findBestTradeRoute(fleet)
            if (!order) {
              console.log(`[Universe] Idle: No profitable trade found for ${fleet.name}`)
            }
            if (order) {
              fleet.currentOrder = order

              // Helper: Issue path commands
              const issuePathCommands = (fromSector: string, toSector: string) => {
                if (fromSector === toSector) return
                const path = findSectorPath(fromSector, toSector)
                if (path) {
                  for (const nextSector of path) {
                    issueCommand(fleet.id, { type: 'goto-gate', targetSectorId: nextSector })
                    issueCommand(fleet.id, { type: 'use-gate', targetSectorId: nextSector })
                  }
                }
              }

              // Issue explicit granular commands sequence

              // 0. Travel to Buy Sector (if needed)
              issuePathCommands(fleet.currentSectorId, order.buySectorId)

              // 1. Go to Buy Station
              issueCommand(fleet.id, {
                type: 'goto-station',
                targetStationId: order.buyStationId,
                targetSectorId: order.buySectorId
              })
              // 2. Dock
              issueCommand(fleet.id, {
                type: 'dock',
                targetStationId: order.buyStationId
              })
              // 3. Load Cargo
              issueCommand(fleet.id, {
                type: 'load-cargo',
                targetStationId: order.buyStationId,
                wareId: order.buyWareId,
                amount: order.buyQty
              })
              // 4. Undock
              issueCommand(fleet.id, {
                type: 'undock',
                targetStationId: order.buyStationId
              })

              // 4.5. Travel to Sell Sector (if needed)
              issuePathCommands(order.buySectorId, order.sellSectorId)

              // 5. Go to Sell Station
              issueCommand(fleet.id, {
                type: 'goto-station',
                targetStationId: order.sellStationId,
                targetSectorId: order.sellSectorId
              })
              // 6. Dock
              issueCommand(fleet.id, {
                type: 'dock',
                targetStationId: order.sellStationId
              })
              // 7. Unload Cargo
              issueCommand(fleet.id, {
                type: 'unload-cargo',
                targetStationId: order.sellStationId,
                wareId: order.sellWareId,
                amount: order.sellQty
              })
              // 8. Undock
              issueCommand(fleet.id, {
                type: 'undock',
                targetStationId: order.sellStationId
              })

              fleet.state = 'in-transit' // Generic busy state
              fleet.stateStartTime = now
            }
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

  const settleCurrentOrder = (fleet: NPCFleet) => {
    const order = fleet.currentOrder
    if (!order) return false
    const station = state.stations.find(s => s.id === order.sellStationId)
    const wareId = order.sellWareId
    const carry = fleet.cargo[wareId] || 0
    if (!station || carry <= 0) return false

    const amount = Math.min(carry, order.sellQty)
    const sellPrice = state.sectorPrices[station.sectorId]?.[wareId] || order.sellPrice || (state.wares.find(w => w.id === wareId)?.basePrice || 0)
    const buyPrice = order.buyPrice || 0
    const revenue = amount * sellPrice
    const cost = amount * buyPrice
    const profit = revenue - cost

    fleet.cargo[wareId] = Math.max(0, carry - amount)
    station.inventory[wareId] = (station.inventory[wareId] || 0) + amount

    fleet.credits += revenue
    fleet.totalProfit += profit
    fleet.tripsCompleted++

    if (fleet.ownerId) {
      const corp = state.corporations.find(c => c.id === fleet.ownerId)
      if (corp) {
        const share = profit * (1 - fleet.profitShare)
        corp.credits += share
        corp.lifetimeProfit += share
        corp.lifetimeTrades++
      }
    }

    state.tradeLog.unshift({
      id: genId(),
      timestamp: Date.now(),
      fleetId: fleet.id,
      fleetName: fleet.name,
      wareId,
      wareName: order.sellWareName || wareId,
      quantity: amount,
      buyPrice,
      sellPrice,
      profit,
      buySectorId: order.buySectorId,
      sellSectorId: station.sectorId,
      buyStationName: order.buyStationName,
      sellStationName: station.name,
    })
    if (state.tradeLog.length > 100) state.tradeLog.length = 100

    fleet.currentOrder = undefined
    fleet.commandQueue = []
    fleet.destinationSectorId = undefined
    fleet.targetStationId = undefined
    fleet.state = 'idle'
    fleet.stateStartTime = Date.now()
    return true
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
        // Ship has left station
        // If we have more commands, we are now in-transit to the next target.
        // If queue is empty, we are truly idle.
        fleet.state = fleet.commandQueue.length > 0 ? 'in-transit' : 'idle'
        fleet.stateStartTime = report.timestamp || Date.now()
        break

      case 'queue-complete':
        console.log(`[Universe] Fleet ${fleet.name} finished queue. Resetting to IDLE.`)
        fleet.commandQueue = []
        fleet.currentOrder = undefined
        fleet.state = 'idle'
        fleet.destinationSectorId = undefined
        break

      case 'arrived-at-gate':
        fleet.state = 'in-transit'
        break

      case 'entered-sector':
        // Sector arrival: trust sectorId, drop consumed gate hops so we don't loop
        fleet.currentSectorId = report.sectorId
        fleet.destinationSectorId = undefined
        fleet.state = 'idle'
        fleet.stateStartTime = report.timestamp || Date.now()

        if (report.position) {
          fleet.position = report.position
        } else {
          // Fallback spawn near expected entry gate
          let spawnPos: [number, number, number] = [0, 0, 0]
          const offset = 2000 // Distance from gate center
          const GATE_DIST = 150000

          if (report.gateType === 'N') spawnPos = [0, 0, GATE_DIST - offset]       // arrived from south
          else if (report.gateType === 'S') spawnPos = [0, 0, -GATE_DIST + offset]  // arrived from north
          else if (report.gateType === 'W') spawnPos = [GATE_DIST - offset, 0, 0]   // arrived from east
          else if (report.gateType === 'E') spawnPos = [-GATE_DIST + offset, 0, 0]  // arrived from west
          else spawnPos = randomPos()

          fleet.position = spawnPos
        }

        // Trim any leading gate commands targeting the sector we just entered
        while (fleet.commandQueue.length > 0) {
          const cmd = fleet.commandQueue[0]
          if ((cmd.type === 'goto-gate' || cmd.type === 'use-gate') && cmd.targetSectorId === fleet.currentSectorId) {
            fleet.commandQueue.shift()
            continue
          }
          break
        }
        break

      case 'cargo-loaded':
        // Transaction: Buy from station
        if (report.wareId && report.amount && report.stationId) {
          const station = state.stations.find(s => s.id === report.stationId)
          // The order is now embedded in the queue, we don't strictly need currentOrder for the prices if we trust the queue,
          // but let's keep using fleet.currentOrder for the financials if available.
          const order = fleet.currentOrder

          if (station) {
            // Deduct from station, add to fleet
            const available = station.inventory[report.wareId] || 0
            const actualAmount = Math.min(report.amount, available)

            station.inventory[report.wareId] = Math.max(0, available - actualAmount)
            fleet.cargo[report.wareId] = (fleet.cargo[report.wareId] || 0) + actualAmount

            if (order) {
              fleet.credits -= actualAmount * order.buyPrice
            }

            // Do NOT clear queue or issue new commands. The queue has the next steps (undock -> fly -> dock -> sell).
            // We just finished loading, so we are still at the station (docked) until the undock command processes.
            // Note: FleetState uses 'docking' for both docking and docked states.
            fleet.state = 'docking'
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

      case 'cargo-stored':
        // Cargo stored at a station (corp storage or rental)
        if (report.wareId && report.amount && report.stationId) {
          const station = state.stations.find(s => s.id === report.stationId)

          if (station) {
            // Move cargo from ship to station inventory
            const carry = fleet.cargo[report.wareId] || 0
            const amt = Math.min(report.amount, carry)
            fleet.cargo[report.wareId] = Math.max(0, carry - amt)
            if (fleet.cargo[report.wareId] === 0) delete fleet.cargo[report.wareId]

            station.inventory[report.wareId] = (station.inventory[report.wareId] || 0) + amt

            // Check if this is rental storage (independent or non-corp station)
            const isRental = !fleet.ownerId ||
              !state.corporations.find(c => c.id === fleet.ownerId)?.stationIds.includes(station.id)

            if (isRental) {
              // Charge a small rental fee (5% of cargo value)
              const warePrice = state.sectorPrices[station.sectorId]?.[report.wareId] ||
                state.wares.find(w => w.id === report.wareId)?.basePrice || 100
              const storageFee = Math.floor(amt * warePrice * 0.05)
              fleet.credits = Math.max(0, fleet.credits - storageFee)
              console.log(`[Universe] ${fleet.name} paid ${storageFee} credits storage fee for ${amt} ${report.wareId}`)
            } else {
              console.log(`[Universe] ${fleet.name} stored ${amt} ${report.wareId} at corp station ${station.name}`)
            }

            fleet.currentOrder = undefined
            fleet.state = 'idle'
          }
        }
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
