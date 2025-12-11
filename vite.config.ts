import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import react from '@vitejs/plugin-react'
import { INITIAL_CORPORATIONS, INITIAL_FLEETS, type Ware, type Recipe } from './src/types/simulation'
import { UNIVERSE_SECTORS_XBTF } from './src/config/universe_xbtf'
import { getSectorLayoutById } from './src/config/sector'
import { CUSTOM_STATIONS } from './src/config/stations_custom'
import { WARES_CONFIG, RECIPES_CONFIG } from './src/config/economy'
import { SHIP_CATALOG } from './src/config/ship_catalog'
// fs and path are already imported at the top


type Station = {
  id: string
  name: string
  recipeId: string
  capabilities?: string[] // List of recipe IDs this station can perform (e.g., shipyard: ['build_vulture', 'build_toucan'])
  sectorId: string
  inventory: Record<string, number>
  reorderLevel: Record<string, number>
  reserveLevel: Record<string, number>
  productionProgress?: number
  position?: [number, number, number]
  modelPath?: string
  ownerId?: string
  population?: number;
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

  // Mines
  'mine_ore': { id: 'ore_mine', name: 'Ore Mine', cost: 588256, modelPath: '/models/00114.obj' },
  'mine_silicon': { id: 'silicon_mine', name: 'Silicon Mine', cost: 1118256, modelPath: '/models/00114.obj' },
  'mine_ice': { id: 'ice_mine', name: 'Ice Harvesting Facility', cost: 500000, modelPath: '/models/00114.obj' }, // Placeholder model

  // Pumps
  'pump_hydrogen': { id: 'hydrogen_pump', name: 'Hydrogen Pump', cost: 700000, modelPath: '/models/00283.obj' }, // Placeholder
  'pump_helium': { id: 'helium_pump', name: 'Helium Pump', cost: 750000, modelPath: '/models/00283.obj' },
  'pump_methane': { id: 'methane_pump', name: 'Methane Pump', cost: 800000, modelPath: '/models/00283.obj' },

  // Refineries (Tier 1)
  'refinery_water': { id: 'water_refinery', name: 'Water Refinery', cost: 400000, modelPath: '/models/00283.obj' },
  'refinery_ore': { id: 'ore_refinery', name: 'Ore Refinery', cost: 1500000, modelPath: '/models/00283.obj' },
  'foundry_teladianium': { id: 'teladianium_foundry', name: 'Teladianium Foundry', cost: 661104, modelPath: '/models/00283.obj' },
  'refinery_graphene': { id: 'graphene_refinery', name: 'Graphene Refinery', cost: 2000000, modelPath: '/models/00011.obj' },
  'factory_coolant': { id: 'coolant_factory', name: 'Superfluid Coolant Factory', cost: 1800000, modelPath: '/models/00011.obj' },
  'factory_antimatter': { id: 'antimatter_cell_factory', name: 'Antimatter Cell Factory', cost: 2500000, modelPath: '/models/00011.obj' },

  // Food (Tier 1 & 2)
  'flower_farm': { id: 'teladi_flower_farm', name: 'Flower Farm', cost: 461104, modelPath: '/models/00282.obj' },
  'oil_refinery': { id: 'teladi_oil_refinery', name: 'Sun Oil Refinery', cost: 1661104, modelPath: '/models/00283.obj' },
  'wheat_farm': { id: 'argon_wheat_farm', name: 'Wheat Farm', cost: 400000, modelPath: '/models/00182.obj' },
  'cattle_ranch': { id: 'argon_cattle_ranch', name: 'Cattle Ranch', cost: 500000, modelPath: '/models/00182.obj' },
  'cahoona_bakery': { id: 'cahoona_bakery', name: 'Cahoona Bakery', cost: 600000, modelPath: '/models/00183.obj' },
  'scruffin_farm': { id: 'scruffin_farm', name: 'Scruffin Farm', cost: 380000, modelPath: '/models/00272.obj' },
  'rastar_refinery': { id: 'rastar_refinery', name: 'Rastar Refinery', cost: 520000, modelPath: '/models/00273.obj' },
  'plankton_farm': { id: 'plankton_farm', name: 'Plankton Farm', cost: 350000, modelPath: '/models/00067.obj' },
  'bogas_plant': { id: 'bogas_plant', name: 'BoGas Factory', cost: 420000, modelPath: '/models/00011.obj' },
  'bofu_lab': { id: 'bofu_lab', name: 'BoFu Chemical Lab', cost: 520000, modelPath: '/models/00011.obj' },
  'argon_farm': { id: 'argon_farm', name: 'Argon Farm', cost: 400000, modelPath: '/models/00182.obj' },
  'paranid_farm': { id: 'paranid_farm', name: 'Paranid Farm', cost: 400000, modelPath: '/models/00276.obj' },
  'boron_bio_gas': { id: 'bogas_plant', name: 'BoGas Factory', cost: 420000, modelPath: '/models/00011.obj' },
  'boron_bofu': { id: 'bofu_lab', name: 'BoFu Chemical Lab', cost: 520000, modelPath: '/models/00011.obj' },

  // High Tech / Components (Tier 2/3)
  'factory_hull_parts': { id: 'hull_part_factory', name: 'Hull Part Factory', cost: 3500000, modelPath: '/models/00430.obj' },
  'factory_engine_parts': { id: 'engine_part_factory', name: 'Engine Component Factory', cost: 4500000, modelPath: '/models/00440.obj' },
  'factory_microchips': { id: 'chip_plant', name: 'Chip Plant', cost: 4000000, modelPath: '/models/00278.obj' },
  'factory_scanning_arrays': { id: 'scanning_array_factory', name: 'Scanning Array Factory', cost: 5000000, modelPath: '/models/00431.obj' },
  'factory_weapon_components': { id: 'weapon_component_factory', name: 'Weapon Component Factory', cost: 6000000, modelPath: '/models/00442.obj' },
  'factory_shield_components': { id: 'shield_component_factory', name: 'Shield Component Factory', cost: 6000000, modelPath: '/models/00442.obj' },
  'factory_quantum_tubes': { id: 'quantum_tube_fab', name: 'Quantum Tube Fab', cost: 5000000, modelPath: '/models/00420.obj' },
  'factory_advanced_composites': { id: 'advanced_composite_factory', name: 'Advanced Composite Factory', cost: 3000000, modelPath: '/models/00278.obj' },
  'factory_field_coils': { id: 'field_coil_factory', name: 'Field Coil Factory', cost: 3200000, modelPath: '/models/00430.obj' },
  'factory_smart_chips': { id: 'smart_chip_factory', name: 'Smart Chip Factory', cost: 2500000, modelPath: '/models/00280.obj' },

  // High Tech Legacy / Race Specific
  'chip_plant': { id: 'chip_plant', name: 'Chip Plant', cost: 1100000, modelPath: '/models/00278.obj' },
  'computer_plant': { id: 'computer_plant', name: 'Computer Plant', cost: 1000000, modelPath: '/models/00431.obj' },
  'quantum_tube_fab': { id: 'quantum_tube_fab', name: 'Quantum Tube Fab', cost: 900000, modelPath: '/models/00420.obj' },
  'teladi_quantum_tube_fab': { id: 'teladi_quantum_tube_fab', name: 'Teladi Quantum Tube Fab', cost: 900000, modelPath: '/models/00420.obj' },
  'argon_quantum_tube_fab': { id: 'argon_quantum_tube_fab', name: 'Argon Quantum Tube Fab', cost: 900000, modelPath: '/models/00232.obj' },
  'split_quantum_tube_fab': { id: 'split_quantum_tube_fab', name: 'Split Quantum Tube Fab', cost: 900000, modelPath: '/models/00237.obj' },
  'paranid_quantum_tube_fab': { id: 'paranid_quantum_tube_fab', name: 'Paranid Quantum Tube Fab', cost: 900000, modelPath: '/models/00213.obj' },
  'boron_chip_plant': { id: 'boron_chip_plant', name: 'Boron Chip Plant', cost: 1100000, modelPath: '/models/00280.obj' },

  // End Products
  'factory_claytronics': { id: 'claytronics_factory', name: 'Claytronics Factory', cost: 12000000, modelPath: '/models/00431.obj' },
  'factory_crystals': { id: 'crystal_fab_teladi', name: 'Crystal Fab', cost: 3000000, modelPath: '/models/00284.obj' },

  // Weapons
  'ire_forge': { id: 'ire_forge', name: 'IRE Forge', cost: 2861104, modelPath: '/models/00430.obj' },
  'hept_forge': { id: 'hept_forge', name: 'HEPT Forge', cost: 3200000, modelPath: '/models/00440.obj' },
  'pac_forge': { id: 'pac_forge', name: 'PAC Forge', cost: 2000000, modelPath: '/models/00442.obj' },
  'missile_mosquito': { id: 'missile_factory_mosquito', name: 'Mosquito Missile Factory', cost: 1000000, modelPath: '/models/00011.obj' },

  // Illegal
  'spaceweed_cycle': { id: 'dream_farm', name: 'Dream Farm', cost: 1200000, modelPath: '/models/00282.obj' },
  'bliss_place': { id: 'bliss_place', name: 'Bliss Place', cost: 1500000, modelPath: '/models/00282.obj' },

  // Infrastructure
  'equipment_dock': { id: 'equipment_dock', name: 'Equipment Dock', cost: 1500000, modelPath: '/models/00448.obj' },
  'trading_station': { id: 'trading_station', name: 'Trading Station', cost: 1200000, modelPath: '/models/00001.obj' },
  'shipyard': { id: 'shipyard', name: 'Shipyard', cost: 5000000, modelPath: '/models/00444.obj' },
  'pirate_station': { id: 'pirate_station', name: 'Pirate Station', cost: 1800000, modelPath: '/models/00397.obj' },
  'xenon_power': { id: 'xenon_power', name: 'Xenon Power Plant', cost: 900000, modelPath: '/models/00323.obj' },
  'planetary_trading_post': { id: 'planetary_hub', name: 'Planetary Trading Post', cost: 2000000, modelPath: '/models/00001.obj' }, // Use Trading Station model
  'orbital_habitat': { id: 'orbital_habitat', name: 'Orbital Habitat', cost: 1500000, modelPath: '/models/00001.obj' } // Use Trading Station model for now as well
}

// Ship Catalog imported from config


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
  lastReportAt?: number
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
    const modProd = Math.max(0.5, Math.min(2.0, reserve <= 0 ? 1 : 1 + (reserve - prodStock) / Math.max(reserve, 1)))
    sp[r.productId] = baseProd * modProd

    priceMap[st.sectorId] = sp
  }

  return priceMap
}

// Map legacy/generic recipe ids to race-specific ones so station type dictates recipe
const normalizeStationRecipes = (stations: Station[], recipes: Recipe[]) => {
  const recipeSet = new Set(recipes.map((r) => r.id))
  const alias: Record<string, string> = {
    ire_forge: 'ire_forge_teladi',
    hept_forge: 'hept_forge_split',
    quantum_tube_fab: 'quantum_tube_teladi',
    chip_plant: 'chip_plant_argon',
    crystal_fab: 'crystal_fab_teladi',
    shield_plant: 'shield_prod_25mw',
  }

  stations.forEach((st) => {
    if (recipeSet.has(st.recipeId)) return
    const mapped = alias[st.recipeId]
    if (mapped && recipeSet.has(mapped)) {
      st.recipeId = mapped
    } else if (recipeSet.has('logistics_hub')) {
      st.recipeId = 'logistics_hub'
    }
  })
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

  const markFleetHeartbeat = (fleet: NPCFleet, timestamp = Date.now()) => {
    fleet.lastReportAt = timestamp
  }

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
        state.wares = WARES_CONFIG
        state.recipes = RECIPES_CONFIG
        state.stations = loadedState.stations
        state.sectorPrices = Object.keys(loadedState.sectorPrices || {}).length > 0
          ? loadedState.sectorPrices
          : computeSectorPrices(loadedState.stations, loadedState.recipes, loadedState.wares)
        state.timeScale = 1 // Reset time scale on load
        state.elapsedTimeSec = loadedState.elapsedTimeSec
        state.corporations = loadedState.corporations
        state.fleets = (loadedState.fleets || []).map(f => ({
          ...f,
          commandQueue: Array.isArray(f.commandQueue) ? f.commandQueue : [],
          lastReportAt: f.lastReportAt || f.stateStartTime || Date.now()
        }))
        state.tradeLog = loadedState.tradeLog || []
        remapLegacyStations()

        // PATCH: Ensure Shipyards have capabilities and ship inventory
        state.stations.forEach(st => {
          if (st.recipeId === 'shipyard' || st.name.toLowerCase().includes('shipyard') || st.name.toLowerCase().includes('wharf')) {
            // 1. Ensure Capabilities
            if (!st.capabilities || st.capabilities.length === 0) {
              st.capabilities = Object.keys(SHIP_CATALOG).map(k => `build_${k}`);
              console.log(`[Universe] Patched capabilities for ${st.name}`);
            }

            // 2. Ensure Inventory Keys for Ships
            st.capabilities.forEach(cap => {
              const shipKey = cap.replace('build_', 'ship_');
              if (typeof st.inventory[shipKey] === 'undefined') {
                st.inventory[shipKey] = 0;
                console.log(`[Universe] Patched inventory key ${shipKey} for ${st.name}`);
              }
            });

            // 3. Ensure Build Resources
            ['energy_cells', 'hull_parts', 'computer_components', 'quantum_tubes', 'microchips'].forEach(res => {
              if (!st.inventory[res]) {
                st.inventory[res] = 500;
              }
            });
          }
        });

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
    // Wares based on actual Teladi sector stations
    const wares = WARES_CONFIG

    // Recipes
    const recipes = RECIPES_CONFIG
    // Load custom stations
    const stations: Station[] = []
    const spacing = 30
    const slug = (name: string, fallback: string) => {
      const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      return s || fallback
    }

    const pickRecipeId = (name: string, sectorId: string): string => {
      const n = name.toLowerCase()
      // Determine Race from SECTOR
      let race = 'teladi'
      if (sectorId.includes('argon') || sectorId.includes('cloudbase') || sectorId.includes('president') || sectorId.includes('home') || sectorId.includes('red') || sectorId.includes('three') || sectorId.includes('power') || sectorId.includes('antigone') || sectorId.includes('herron') || sectorId.includes('hole') || sectorId.includes('wall') || sectorId.includes('ore') || sectorId.includes('light')) race = 'argon'
      else if (sectorId.includes('kingdom') || sectorId.includes('rolk') || sectorId.includes('que') || sectorId.includes('menelaus') || sectorId.includes('atreus') || sectorId.includes('lucky')) race = 'boron'
      else if (sectorId.includes('paranid') || sectorId.includes('priest') || sectorId.includes('emp') || sectorId.includes('duke') || sectorId.includes('trinity')) race = 'paranid'
      else if (sectorId.includes('family') || sectorId.includes('thuruk') || sectorId.includes('chin') || sectorId.includes('cho') || sectorId.includes('rhonkar') || sectorId.includes('ghinn')) race = 'split'
      else if (sectorId.includes('xenon')) race = 'xenon'

      // Map to Race Specific Recipes
      if (n.includes('solar power') || n.includes('spp')) return `spp_${race}`

      // Crystal Fabs
      if (n.includes('crystal')) return `crystal_fab_${race}`

      // High Tech / Weapons
      if (n.includes('quantum')) return `quantum_tube_${race === 'boron' ? 'boron' : race === 'teladi' ? 'teladi' : 'argon'}` // fallback for now
      if (n.includes('chip') || n.includes('microchip')) return `chip_plant_${race === 'boron' ? 'boron' : race === 'split' ? 'split' : 'argon'}` // Split have no chip plant in list? they do.

      if (n.includes('computer')) return 'computer_plant'

      // Components
      if (n.includes('hull part')) return race === 'teladi' ? 'hull_part_factory_teladi' : 'hull_part_factory'
      if (n.includes('engine part') || n.includes('engine component')) return 'engine_part_factory'
      if (n.includes('weapon component')) return 'weapon_component_factory'
      if (n.includes('shield component')) return 'shield_component_factory'
      if (n.includes('scanning array')) return 'scanning_array_factory'
      if (n.includes('smart chip')) return 'smart_chip_factory'
      if (n.includes('advanced composite')) return 'advanced_composite_factory'
      if (n.includes('field coil')) return 'field_coil_factory'
      if (n.includes('antimatter')) return 'antimatter_cell_factory'
      if (n.includes('superfluid') || n.includes('coolant')) return 'coolant_factory'
      if (n.includes('graphene')) return 'graphene_refinery'
      if (n.includes('refined metal')) return 'ore_refinery'
      if (n.includes('water')) return 'water_refinery'

      if (n.includes('shield')) {
        if (n.includes('1mw') || n.includes('1 mw')) return 'shield_prod_1mw'
        if (n.includes('25mw') || n.includes('25 mw')) return 'shield_prod_25mw'
        return 'shield_prod_25mw' // default
      }

      // Specific Foods
      if (n.includes('flower')) return 'flower_farm'
      if (n.includes('dream') || n.includes('swamp')) return 'dream_farm'
      if (n.includes('bliss')) return 'bliss_place'
      if (n.includes('sun oil') || n.includes('oil refinery')) return 'sun_oil_refinery'
      if (n.includes('teladianium')) return 'teladianium_foundry'

      if (n.includes('ore mine')) return 'ore_mine'
      if (n.includes('silicon')) return 'silicon_mine'
      if (n.includes('ice')) return 'ice_mine'

      // Pumps
      if (n.includes('hydrogen')) return 'hydrogen_pump'
      if (n.includes('helium')) return 'helium_pump'
      if (n.includes('methane')) return 'methane_pump'

      if (n.includes('cattle') || n.includes('argon farm')) return 'argon_cattle_ranch'
      if (n.includes('cahoona')) return 'cahoona_bakery'
      if (n.includes('wheat')) return 'argon_wheat_farm'

      if (n.includes('plankton')) return 'plankton_farm'
      if (n.includes('bogas')) return 'bogas_plant'
      if (n.includes('bofu')) return 'bofu_lab'
      if (n.includes('stott')) return 'stott_mixery'

      if (n.includes('scruffin')) return 'scruffin_farm'
      if (n.includes('chelt')) return 'chelt_aquarium'
      if (n.includes('rastar')) return 'rastar_refinery'
      if (n.includes('massom')) return 'massom_mill'

      if (n.includes('soyfarm') || n.includes('soya')) return 'soyfarm'
      if (n.includes('soyery')) return 'soyery'
      if (n.includes('snail')) return 'snail_ranch'
      if (n.includes('majaglit')) return 'majaglit_factory'

      // Lasers
      if (n.includes('ire') || n.includes('impulse')) return `ire_forge_${race === 'argon' ? 'argon' : 'teladi'}`
      if (n.includes('pac') || n.includes('particle')) return `pac_forge_${race === 'boron' ? 'boron' : 'boron'}` // Boron known for PACs
      if (n.includes('hept') || n.includes('plasma')) return `hept_forge_${race === 'split' ? 'split' : 'paranid'}`

      if (n.includes('equipment dock') || n.includes('trading station')) return 'logistics_hub'
      if (n.includes('shipyard')) return 'shipyard'
      if (n.includes('missile')) return 'missile_factory_mosquito'

      if (n.includes('planetary') || n.includes('trading post')) return `planetary_hub_${race}`
      if (n.includes('habitat')) return `orbital_habitat_${race}`

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

      // If recipeId is unknown, remap based on station name/race
      let recipeId = cs.recipeId
      if (!recipes.find(r => r.id === recipeId)) {
        const guessed = pickRecipeId(cs.name, cs.sectorId)
        recipeId = recipes.find(r => r.id === guessed) ? guessed : 'logistics_hub'
      }



      // Determine capabilities for Shipyards
      let capabilities: string[] | undefined;
      if (recipeId === 'shipyard' || cs.name.toLowerCase().includes('shipyard') || cs.name.toLowerCase().includes('wharf')) {
        capabilities = Object.keys(SHIP_CATALOG).map(k => `build_${k}`);
      }

      const st: Station = {
        id: finalId,
        name: cs.name,
        recipeId: recipeId,
        capabilities: capabilities, // Assign capabilities
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

        // Ensure capabilities are represented in inventory (ships)
        if (st.capabilities) {
          st.capabilities.forEach(cap => {
            const shipKey = cap.replace('build_', 'ship_');
            if (typeof st.inventory[shipKey] === 'undefined') {
              st.inventory[shipKey] = 0; // Initialize key so UI sees it
            }
          });

          // Also ensure there are resources to BUILD ships so they don't stay at 0 forever
          // Shipyards need Hull Parts, Computer Components, Energy Cells, etc.
          // Since we don't have a rigid universal recipe for 'shipyard' yet (it uses dynamic capabilities),
          // we should seed generic ship building resources if missing.
          ['energy_cells', 'hull_parts', 'computer_components', 'quantum_tubes', 'microchips'].forEach(res => {
            if (!st.inventory[res]) st.inventory[res] = 500;
          });
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
        const rid = pickRecipeId(st.name, sector.id)

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

      // 3. Add Population Infrastructure (Planetary Hubs & Habitats)
      // One Planetary Trading Post per sector (Source)
      const planetLinkID = `${sector.id}_planetary_hub`
      if (!existingIds.has(planetLinkID)) {
        existingIds.add(planetLinkID)
        const race = pickRecipeId('planetary_hub', sector.id).split('_').pop() || 'teladi'

        const station: Station = {
          id: planetLinkID,
          name: `Planetary Trading Post`,
          recipeId: `planetary_hub_${race}`,
          sectorId: sector.id,
          position: [0, -10000, 0], // Deep "planet" location
          modelPath: '/models/00001.obj', // Trading station model
          inventory: {},
          reorderLevel: {},
          reserveLevel: {},
          ownerId: undefined, // Independent / Government
          // Random population: 5M to 100M
          population: Math.floor(5000000 + Math.random() * 95000000)
        }
        // Seed
        const r = recipes.find(rec => rec.id === station.recipeId)
        if (r) {
          r.inputs.forEach(i => { station.inventory[i.wareId] = i.amount * 50; station.reorderLevel[i.wareId] = i.amount * 100 })
          station.inventory[r.productId] = 0
          station.reserveLevel[r.productId] = 0 // Sell immediately
        }
        stations.push(station)
      }

      // Random Orbital Habitats (Sink)
      if (Math.random() < 0.6) { // 60% chance per sector
        const habId = `${sector.id}_habitat_${genId()}`
        const race = pickRecipeId('orbital_habitat', sector.id).split('_').pop() || 'teladi'
        const station: Station = {
          id: habId,
          name: `Orbital Habitat ${genId().substring(0, 3).toUpperCase()}`,
          recipeId: `orbital_habitat_${race}`,
          sectorId: sector.id,
          position: randomPos(),
          modelPath: '/models/00001.obj',
          inventory: {},
          reorderLevel: {},
          reserveLevel: {},
          ownerId: undefined, // Independent
          // Random population: 2k to 20k
          population: Math.floor(2000 + Math.random() * 18000)
        }
        // Seed
        const r = recipes.find(rec => rec.id === station.recipeId)
        if (r) {
          r.inputs.forEach(i => { station.inventory[i.wareId] = i.amount * 10; station.reorderLevel[i.wareId] = i.amount * 50 })
        }
        stations.push(station)

        // Assign to independent or a corp?
        const candidates = corporations.filter(c => c.race === race)
        if (candidates.length > 0 && Math.random() < 0.7) {
          const c = candidates[Math.floor(Math.random() * candidates.length)]
          station.ownerId = c.id
          c.stationIds.push(station.id)
          station.name = `${c.name.split(' ')[0]} Habitat ${genId().substring(0, 3)}`
        }
      }
    }

    // Populate sector prices
    normalizeStationRecipes(stations, recipes)
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
        lastReportAt: Date.now(),
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
            lastReportAt: now,
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
              capabilities: job.stationType === 'shipyard' ? ['build_vulture', 'build_toucan', 'build_express', 'build_buster', 'build_discoverer'] : undefined,
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
        // Purchase new trader - find a shipyard selling Vultures
        const shipyards = state.stations.filter(st => st.capabilities && st.capabilities.includes('build_vulture'))

        let chosenShipyard: Station | null = null
        let price: number = SHIP_CATALOG.vulture.cost

        // Prefer race-aligned shipyard, then any
        const raceYards = shipyards.filter(_st => {
          // Heuristic: map shipyard model race or owner race (not strictly tracked in blueprint but by name/model)
          // Simple fallback: all shipyards sell all ships for now.
          return true
        })

        // Find one with stock
        for (const yard of raceYards) {
          const stock = yard.inventory['ship_vulture'] || 0
          if (stock >= 1) {
            // Check price
            const p = state.sectorPrices[yard.sectorId]?.['ship_vulture'] || SHIP_CATALOG.vulture.cost
            if (corp.credits >= p) {
              chosenShipyard = yard
              price = p
              break
            }
          }
        }

        if (chosenShipyard) {
          // BUY SHIP
          chosenShipyard.inventory['ship_vulture']--
          corp.credits -= price

          // Spawn it at the shipyard
          const newFleet: NPCFleet = {
            id: `fleet_${genId()}`,
            name: `${corp.name.split(' ')[0]} Trader ${genId().substring(0, 4)}`,
            shipType: 'Vulture',
            modelPath: SHIP_CATALOG.vulture.modelPath,
            race: corp.race,
            capacity: SHIP_CATALOG.vulture.capacity,
            speed: SHIP_CATALOG.vulture.speed,
            homeSectorId: chosenShipyard.sectorId,
            ownerId: corp.id,
            ownerType: corp.type,
            behavior: 'corp-logistics',
            autonomy: 0.5,
            profitShare: 0.15,
            currentSectorId: chosenShipyard.sectorId,
            position: chosenShipyard.position || [0, 0, 0], // Spawn at station
            state: 'undocking', // Start undocking!
            stateStartTime: now,
            lastReportAt: now,
            cargo: {},
            credits: 10000,
            commandQueue: [],
            totalProfit: 0,
            tripsCompleted: 0
          }
          // Add undock command
          newFleet.commandQueue.push({
            id: genId(),
            type: 'undock',
            targetStationId: chosenShipyard.id,
            createdAt: now
          })

          state.fleets.push(newFleet)
          corp.fleetIds.push(newFleet.id)

          console.log(`[CorpAI] ${corp.name} BOUGHT ${newFleet.name} from ${chosenShipyard.name} for ${price.toFixed(0)}Cr (Stock left: ${chosenShipyard.inventory['ship_vulture']})`)
        }
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

        // Randomly pick ship type (mostly Vultures, some TPs)
        const rand = Math.random()
        let type = 'Vulture'
        let model = SHIP_CATALOG.vulture.modelPath
        let cap: number = SHIP_CATALOG.vulture.capacity
        let spd: number = SHIP_CATALOG.vulture.speed

        if (rand < 0.2) {
          type = 'Express'
          model = SHIP_CATALOG.express.modelPath
          cap = SHIP_CATALOG.express.capacity
          spd = SHIP_CATALOG.express.speed
        } else if (rand < 0.4) {
          type = 'Toucan'
          model = SHIP_CATALOG.toucan.modelPath
          cap = SHIP_CATALOG.toucan.capacity
          spd = SHIP_CATALOG.toucan.speed
        } else {
          // Vulture default
          // Small chance of Albatross for heavy haulers? No, TLs are special.
        }

        const newTrader: NPCFleet = {
          id: `fleet_${genId()}`,
          name: `Independent ${genId().substring(0, 4)}`,
          shipType: type,
          modelPath: model,
          race: 'teladi',
          capacity: cap,
          speed: spd * (0.9 + Math.random() * 0.2), // Slight variation
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
          lastReportAt: now,
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

      // DYNAMIC PRODUCTION LOGIC (for Shipyards/Factories with multiple capabilities)
      if (st.capabilities && st.capabilities.length > 0 && st.productionProgress === 0) {
        // Decide what to build next based on inventory levels (build what we are low on)
        // Check current recipe product stock
        const currentStock = st.inventory[r.productId] || 0
        const currentCap = r.productStorageCap || 10

        // If current product is nearly full (>80%), consider switching
        if (currentStock / currentCap > 0.8) {
          // Find a candidate recipe with lower stock percentage
          let bestCandidate = st.recipeId
          let lowestRatio = 1.0

          for (const capId of st.capabilities) {
            const capR = recipeById.get(capId)
            if (!capR) continue
            const stock = st.inventory[capR.productId] || 0
            const cap = capR.productStorageCap || 10
            const ratio = stock / cap
            if (ratio < lowestRatio) {
              lowestRatio = ratio
              bestCandidate = capId
            }
          }

          if (bestCandidate !== st.recipeId) {
            // Switch recipe!
            st.recipeId = bestCandidate
            // Initialize reserves for new inputs if needed
            // console.log(`[Production] ${st.name} switching line to ${bestCandidate} (Stock: ${(lowestRatio*100).toFixed(0)}%)`)
            continue // Skip this tick to allow initialization
          }
        }
      }

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

      // Allow stations to trade a slice of their current stock even if they're below their ideal reserve.
      // This prevents newly-seeded stations with large reserve targets from never exporting anything.
      const getAvailable = (stock: number, reserve: number) => {
        if (stock <= 0) return 0
        const softReserve = Math.min(reserve || 0, stock * 0.5)
        return Math.max(0, stock - softReserve)
      }

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
              const available = getAvailable(seller.inventory[input.wareId] || 0, seller.reserveLevel[input.wareId] || 0)
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
          const available = getAvailable(homeSt.inventory[productId] || 0, homeSt.reserveLevel[productId] || 0)
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
            const available = getAvailable(st.inventory[ware.id] || 0, st.reserveLevel[ware.id] || 0)
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

      if (hasQueuedCommands) {
        const head = fleet.commandQueue[0]
        const lastReportAt = fleet.lastReportAt || fleet.stateStartTime || now
        const silentFor = now - lastReportAt
        const isGateHop = head && (head.type === 'goto-gate' || head.type === 'use-gate' || head.type === 'move-to-sector')
        const staleLimit = fleet.behavior === 'construction' ? 30000 : 45000

        if (isGateHop && head?.targetSectorId && head.targetSectorId !== fleet.currentSectorId && silentFor > staleLimit) {
          const path = findSectorPath(fleet.currentSectorId, head.targetSectorId)
          const hopTarget = path && path.length > 0 ? path[0] : head.targetSectorId
          const layout = getSectorLayoutById(hopTarget)
          const gate = layout?.gates?.[0]
          const spawnPos: [number, number, number] = gate
            ? [gate.position[0] * 30, gate.position[1] * 30, gate.position[2] * 30 + 2000]
            : randomPos()

          fleet.currentSectorId = hopTarget
          fleet.position = spawnPos
          fleet.state = 'idle'
          fleet.stateStartTime = now
          markFleetHeartbeat(fleet, now)

          while (fleet.commandQueue.length > 0) {
            const cmd = fleet.commandQueue[0]
            if ((cmd.type === 'goto-gate' || cmd.type === 'use-gate' || cmd.type === 'move-to-sector') && cmd.targetSectorId === hopTarget) {
              fleet.commandQueue.shift()
              continue
            }
            break
          }
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

    fleet.lastReportAt = report.timestamp || Date.now()
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
        if (req.method === 'POST' && url.startsWith('/__universe/command')) {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', () => {
            try {
              const cmd = JSON.parse(body)
              if (cmd.command === 'buy-ship') {
                const { stationId, wareId } = cmd
                const station = u.state.stations.find(s => s.id === stationId)
                if (station) {
                  const stock = station.inventory[wareId] || 0
                  const shipKey = wareId.replace('ship_', '') as keyof typeof SHIP_CATALOG
                  const shipInfo = SHIP_CATALOG[shipKey]
                  // Price check
                  const price = u.state.sectorPrices[station.sectorId]?.[wareId] || u.state.wares.find(w => w.id === wareId)?.basePrice || 100000

                  if (stock >= 1 && shipInfo) {
                    station.inventory[wareId]--
                    // Deduct player credits logic omitted (frontend display only for now, logic trusts frontend command for single player)

                    const newFleet: NPCFleet = {
                      id: `player_fleet_${Math.random().toString(36).substr(2, 9)}`,
                      name: `${shipInfo.name} (Player)`,
                      shipType: shipInfo.name,
                      modelPath: shipInfo.modelPath,
                      race: 'teladi', // Default to Teladi to satisfy RaceType
                      capacity: shipInfo.capacity,
                      speed: shipInfo.speed,
                      homeSectorId: station.sectorId,
                      ownerId: 'player',
                      ownerType: 'independent',
                      behavior: 'freelance',
                      autonomy: 0,
                      profitShare: 1,
                      currentSectorId: station.sectorId,
                      position: station.position || [0, 0, 0],
                      state: 'undocking',
                      stateStartTime: Date.now(),
                      lastReportAt: Date.now(),
                      cargo: {},
                      credits: 0,
                      commandQueue: [{
                        id: Math.random().toString(36).substr(2, 9), type: 'undock', targetStationId: station.id, createdAt: Date.now()
                      }],
                      totalProfit: 0,
                      tripsCompleted: 0
                    }
                    u.state.fleets.push(newFleet)
                    console.log(`[Universe] Player bought ${shipInfo.name} from ${station.name}`)
                    res.statusCode = 200
                    res.end(JSON.stringify({ success: true, fleetId: newFleet.id, price }))
                    return
                  }
                }
              }
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid command' }))
            } catch (e) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Server error' }))
            }
          })
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
