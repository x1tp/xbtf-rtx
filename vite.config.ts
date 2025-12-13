import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import 'dotenv/config'
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
  costPaid?: number
  fundedAt?: number
  lastFundingLogAt?: number
  createdAt: number
  source?: 'llm' | 'npc'
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
  source?: 'llm' | 'npc' | 'system'
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
  ingameTimeSec?: number
  fleetOwnerId?: string | null
  wareId: string; wareName: string; quantity: number
  buyPrice: number; sellPrice: number; profit: number
  buySectorId: string; sellSectorId: string
  buyStationId?: string; sellStationId?: string
  buyStationName: string; sellStationName: string
  buyStationOwnerId?: string | null; sellStationOwnerId?: string | null
}

type EconomyHistoryEntry = {
  timestamp: number
  totalStock: Record<string, number>
  avgPrices: Record<string, number>
  totalCredits: number
  totalAssetValue: number
}

type UniverseState = {
  wares: Ware[]; recipes: Recipe[]; stations: Station[]; sectorPrices: Record<string, Record<string, number>>; timeScale: number; acc: number; elapsedTimeSec: number
  // Fleet simulation
  corporations: Corporation[]; fleets: NPCFleet[]; tradeLog: TradeLogEntry[]; lastTickTime: number
  // Optional corp-issued work orders that any trader can fulfill for a bonus.
  workOrders?: WorkOrder[]
  // Dynamic economy
  lastTraderSpawnCheck?: number
}

type WorkOrderStatus = 'open' | 'assigned' | 'completed' | 'cancelled' | 'expired'
type WorkOrder = {
  id: string
  corpId: string
  title: string
  wareId: string
  qtyTotal: number
  qtyRemaining: number
  buyStationId: string
  sellStationId: string
  bonusPerUnit: number
  escrowRemaining: number
  status: WorkOrderStatus
  assignedFleetId?: string | null
  createdAtMs: number
  expiresAtMs?: number | null
}

// Derive sector price map from station inventories/reserves
const computeSectorPrices = (stations: Station[], recipes: Recipe[], wares: Ware[]) => {
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const priceMap: Record<string, Record<string, number>> = {}
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const getModRange = (wareId: string) => {
    // Energy Cells are intentionally less volatile: they are a ubiquitous utility ware and
    // extreme price swings cause the trade AI to over-focus on them.
    if (wareId === 'energy_cells') return { min: 0.85, max: 1.25 }
    return { min: 0.5, max: 2.0 }
  }

  for (const st of stations) {
    const r = recipeById.get(st.recipeId)
    if (!r) continue
    const sp = priceMap[st.sectorId] || {}

    // Price inputs higher when low, lower when stocked
    for (const x of r.inputs) {
      const base = wares.find((w) => w.id === x.wareId)?.basePrice || 1
      const stock = st.inventory[x.wareId] || 0
      const rl = st.reorderLevel[x.wareId] || 0
      const { min, max } = getModRange(x.wareId)
      const mod = clamp(rl <= 0 ? 1 : 1 + (rl - stock) / Math.max(rl, 1), min, max)
      sp[x.wareId] = base * mod
    }

    // Price products lower when lots in reserve, higher when scarce
    const baseProd = wares.find((w) => w.id === r.productId)?.basePrice || 1
    const prodStock = st.inventory[r.productId] || 0
    const reserve = st.reserveLevel[r.productId] || 0
    const { min: minProd, max: maxProd } = getModRange(r.productId)
    const modProd = clamp(reserve <= 0 ? 1 : 1 + (reserve - prodStock) / Math.max(reserve, 1), minProd, maxProd)
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
    // Blueprint keys from STATION_BLUEPRINTS (not recipe IDs).
    factory_hull_parts: 'hull_part_factory',
    factory_engine_parts: 'engine_part_factory',
    factory_microchips: 'chip_plant',
    factory_scanning_arrays: 'scanning_array_factory',
    factory_weapon_components: 'weapon_component_factory',
    factory_shield_components: 'shield_component_factory',
    factory_quantum_tubes: 'quantum_tube_fab',
    factory_advanced_composites: 'advanced_composite_factory',
    factory_field_coils: 'field_coil_factory',
    factory_smart_chips: 'smart_chip_factory',
    factory_claytronics: 'claytronics_factory',
    factory_crystals: 'crystal_fab_teladi',
    oil_refinery: 'sun_oil_refinery',
  }

  stations.forEach((st) => {
    const n = String(st.name || '').toLowerCase()
    // Repair common bad-normalizations where a station got defaulted to logistics_hub but the name indicates a real factory.
    if (st.recipeId === 'logistics_hub') {
      if (n.includes('shield component') && recipeSet.has('shield_component_factory')) {
        st.recipeId = 'shield_component_factory'
      } else if ((n.includes('1mw') || n.includes('1 mw')) && n.includes('shield') && recipeSet.has('shield_prod_1mw')) {
        st.recipeId = 'shield_prod_1mw'
      } else if ((n.includes('25mw') || n.includes('25 mw')) && n.includes('shield') && recipeSet.has('shield_prod_25mw')) {
        st.recipeId = 'shield_prod_25mw'
      }
    }

    if (recipeSet.has(st.recipeId)) return
    const mapped = alias[st.recipeId]
    if (mapped && recipeSet.has(mapped)) {
      st.recipeId = mapped
    } else if (recipeSet.has('logistics_hub')) {
      st.recipeId = 'logistics_hub'
    }
  })
}

const patchShipyards = (stations: Station[], recipes: Recipe[], opts: { seedShipStock: boolean }) => {
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const defaultShipStock: Record<string, number> = {
    ship_vulture: 4,
    ship_albatross: 1,
    ship_express: 3,
    ship_toucan: 3,
    ship_buster: 2,
    ship_discoverer: 3,
  }

  for (const st of stations) {
    const isShipyard =
      st.recipeId === 'shipyard' ||
      String(st.name || '').toLowerCase().includes('shipyard') ||
      String(st.name || '').toLowerCase().includes('wharf')

    if (!isShipyard) continue

    // 1) Ensure capabilities exist
    if (!st.capabilities || st.capabilities.length === 0) {
      st.capabilities = Object.keys(SHIP_CATALOG).map((k) => `build_${k}`)
    }

    // 2) Ensure inventory keys for ships exist + optionally seed stock for new games
    for (const cap of st.capabilities) {
      const shipKey = cap.replace('build_', 'ship_')
      const hasKey = Object.prototype.hasOwnProperty.call(st.inventory, shipKey)
      if (!hasKey) st.inventory[shipKey] = 0
      if (opts.seedShipStock) {
        const desired = defaultShipStock[shipKey]
        if (typeof desired === 'number' && (st.inventory[shipKey] || 0) <= 0) st.inventory[shipKey] = desired
      } else {
        // For loaded saves, avoid "refilling" ships; only seed when the key was missing.
        if (!hasKey) {
          const desired = defaultShipStock[shipKey]
          if (typeof desired === 'number') st.inventory[shipKey] = desired
        }
      }
    }

    // 3) Ensure the station is running a real production recipe (shipyard is a station-type, not a recipe).
    if (!recipeById.has(st.recipeId)) {
      const capRecipe = (st.capabilities || []).find((capId) => recipeById.has(capId))
      if (capRecipe) st.recipeId = capRecipe
      else if (recipeById.has('build_vulture')) st.recipeId = 'build_vulture'
    }

    // 4) Ensure build resources + reorder levels so traders will supply shipyards.
    st.reorderLevel = st.reorderLevel || {}
    const caps = Array.isArray(st.capabilities) ? st.capabilities : []
    for (const capId of caps) {
      const r = recipeById.get(capId)
      if (!r) continue
      for (const inp of r.inputs || []) {
        const prev = Number(st.reorderLevel[inp.wareId] || 0)
        const next = Math.max(prev, Math.max(1, Math.floor(Number(inp.amount || 0) * 20)))
        st.reorderLevel[inp.wareId] = next
        if (typeof st.inventory[inp.wareId] === 'undefined') st.inventory[inp.wareId] = 0
      }
    }
  }
}

function createUniverse() {
  const state: UniverseState = { wares: [], recipes: [], stations: [], sectorPrices: {}, timeScale: 1, acc: 0, elapsedTimeSec: 0, corporations: [], fleets: [], tradeLog: [], workOrders: [], lastTickTime: Date.now() }

  type CorpAILogKind = 'context' | 'plan' | 'decision' | 'actions' | 'error'
  type CorpAILogEntry = {
    id: number
    atMs: number
    ingameTimeSec: number
    corpId: string
    kind: CorpAILogKind
    data: any
  }
  let corpAILogNextId = 1
  const corpAILogs: CorpAILogEntry[] = []
  const CORP_AI_LOGS_FILE = path.resolve(process.cwd(), 'saves', 'corp_ai_logs.json')
  let corpAILogsPersistTimer: any = null

  const persistCorpAILogsNow = () => {
    try {
      const saveDir = path.resolve(process.cwd(), 'saves')
      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir)

      const corpIds = new Set(state.corporations.map(c => c.id))
      const logs = corpAILogs.filter(e => corpIds.size === 0 || corpIds.has(e.corpId)).slice(-2000)
      const payload = {
        version: 1,
        atMs: Date.now(),
        nextId: corpAILogNextId,
        logs,
      }
      fs.writeFileSync(CORP_AI_LOGS_FILE, JSON.stringify(payload, null, 2))
    } catch (e) {
      console.warn('[CorpAI] Failed to persist logs:', (e as any)?.message || e)
    }
  }

  const schedulePersistCorpAILogs = () => {
    if (process.env.CORP_AUTOPILOT_PERSIST_LOGS === 'false') return
    if (corpAILogsPersistTimer) return
    corpAILogsPersistTimer = setTimeout(() => {
      corpAILogsPersistTimer = null
      persistCorpAILogsNow()
    }, 250)
  }

  const clearPersistedCorpAILogs = () => {
    try {
      if (fs.existsSync(CORP_AI_LOGS_FILE)) fs.unlinkSync(CORP_AI_LOGS_FILE)
    } catch {
      // ignore
    }
  }

  const getCorpExternalStationSales = (corpId: string, windowSec: number) => {
    const nowMs = Date.now()
    const windowMs = Math.max(0, windowSec) * 1000
    const inWindow = (t: any) => (windowMs <= 0 ? true : (Number(t?.timestamp || 0) >= nowMs - windowMs))

    let total = 0
    let totalCount = 0
    let windowTotal = 0
    let windowCount = 0
    const byWareWindow = new Map<string, number>()

    for (const t of state.tradeLog) {
      const sellerStationOwnerId = (t as any)?.buyStationOwnerId ?? null
      const buyerFleetOwnerId = (t as any)?.fleetOwnerId ?? null
      if (sellerStationOwnerId !== corpId) continue
      if (buyerFleetOwnerId === corpId) continue // internal purchase

      const qty = Number((t as any)?.quantity || 0)
      const buyPrice = Number((t as any)?.buyPrice || 0)
      const revenue = Math.max(0, qty * buyPrice)
      if (revenue <= 0) continue

      total += revenue
      totalCount += 1

      if (inWindow(t)) {
        windowTotal += revenue
        windowCount += 1
        const wareId = String((t as any)?.wareId || 'unknown')
        byWareWindow.set(wareId, (byWareWindow.get(wareId) || 0) + revenue)
      }
    }

    return {
      corpId,
      windowSec,
      externalStationSalesTotal: Math.floor(total),
      externalStationSalesTradesTotal: totalCount,
      externalStationSalesWindow: Math.floor(windowTotal),
      externalStationSalesTradesWindow: windowCount,
      byWareWindow: Array.from(byWareWindow.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([wareId, revenue]) => ({ wareId, revenue: Math.floor(revenue) })),
    }
  }

  const loadPersistedCorpAILogs = () => {
    try {
      if (!fs.existsSync(CORP_AI_LOGS_FILE)) return
      const raw = fs.readFileSync(CORP_AI_LOGS_FILE, 'utf-8')
      const data: any = JSON.parse(raw || '{}')
      const logs = Array.isArray(data?.logs) ? data.logs : []
      const nextId = Number(data?.nextId || 0)

      const corpIds = new Set(state.corporations.map(c => c.id))
      const filtered: CorpAILogEntry[] = logs
        .map((e: any) => ({
          id: Number(e?.id || 0),
          atMs: Number(e?.atMs || Date.now()),
          ingameTimeSec: Number(e?.ingameTimeSec || 0),
          corpId: String(e?.corpId || ''),
          kind: String(e?.kind || 'context') as CorpAILogKind,
          data: e?.data,
        }))
        .filter((e: CorpAILogEntry) => e.id > 0 && e.corpId && (corpIds.size === 0 || corpIds.has(e.corpId)))
        .slice(-2000)

      corpAILogs.length = 0
      corpAILogs.push(...filtered)
      corpAILogNextId = Math.max(
        1,
        Number.isFinite(nextId) && nextId > 0 ? nextId : (filtered.reduce((m, e) => Math.max(m, e.id), 0) + 1),
      )
    } catch (e) {
      console.warn('[CorpAI] Failed to load persisted logs:', (e as any)?.message || e)
    }
  }

  const pushCorpLog = (corpId: string, kind: CorpAILogKind, data: any) => {
    corpAILogs.push({
      id: corpAILogNextId++,
      atMs: Date.now(),
      ingameTimeSec: state.elapsedTimeSec,
      corpId,
      kind,
      data,
    })
    if (corpAILogs.length > 2000) corpAILogs.splice(0, corpAILogs.length - 2000)
    schedulePersistCorpAILogs()
  }

  type CorpAILiveState = {
    corpId: string
    status: 'idle' | 'running' | 'done' | 'error'
    startedAtMs: number
    updatedAtMs: number
    pass: number
    text: string
    error?: string
  }
  const corpAILive = new Map<string, CorpAILiveState>()
  const setCorpLive = (corpId: string, patch: Partial<CorpAILiveState>) => {
    const prev = corpAILive.get(corpId) || {
      corpId,
      status: 'idle' as const,
      startedAtMs: Date.now(),
      updatedAtMs: Date.now(),
      pass: 0,
      text: '',
    }
    const next: CorpAILiveState = {
      ...prev,
      ...patch,
      corpId,
      updatedAtMs: Date.now(),
    }
    corpAILive.set(corpId, next)
  }
  const getCorpLive = (corpId: string) => corpAILive.get(corpId) || null

  const getCorpLogs = (corpId: string, sinceId: number) => {
    // If the user starts a new game or the server restarts, log ids reset.
    // When the client keeps an old `since`, allow it to recover by treating it as 0.
    let sid = Number.isFinite(sinceId) ? sinceId : 0
    if (sid >= corpAILogNextId) sid = 0
    return corpAILogs.filter((e) => e.corpId === corpId && e.id > sid)
  }

  const parseEnvList = (v: string | undefined) =>
    String(v || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

  // If no explicit exclusive list is provided, default to the autopilot corp ids.
  // This prevents "NPC traders start moving before the LLM responds" when a user
  // enables autopilot but forgets to also set the exclusive list.
  const explicitExclusive = parseEnvList(process.env.CORP_AUTOPILOT_EXCLUSIVE_CORP_IDS)
  const defaultExclusive =
    process.env.CORP_AUTOPILOT_ENABLED !== 'false'
      ? parseEnvList(process.env.CORP_AUTOPILOT_CORP_IDS || 'teladi_company')
      : []
  const llmExclusiveCorpIds = new Set(explicitExclusive.length > 0 ? explicitExclusive : defaultExclusive)
  const isLLMExclusiveCorp = (corpId?: string | null) => Boolean(corpId) && llmExclusiveCorpIds.has(String(corpId))

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

  // Economy history (kept out of `state` to avoid bloating autosaves)
  const ECONOMY_SNAPSHOT_INTERVAL_MS = 10_000
  const ECONOMY_HISTORY_LIMIT = 2160 // 6h @ 10s
  const economyHistory: EconomyHistoryEntry[] = []
  let economyHistorySessionId = genId()
  let lastEconomySnapshotAt = 0

  const captureEconomySnapshot = (nowMs: number): EconomyHistoryEntry => {
    const entry: EconomyHistoryEntry = {
      timestamp: nowMs,
      totalStock: {},
      avgPrices: {},
      totalCredits: 0,
      totalAssetValue: 0,
    }

    // Init maps
    for (const w of state.wares) {
      entry.totalStock[w.id] = 0
      entry.avgPrices[w.id] = 0
    }

    // Sum station stock
    for (const st of state.stations) {
      for (const [wid, qty] of Object.entries(st.inventory)) {
        if (typeof entry.totalStock[wid] === 'number') entry.totalStock[wid] += qty
      }
    }

    // Sum fleet cargo + credits
    for (const fleet of state.fleets) {
      for (const [wid, qty] of Object.entries(fleet.cargo)) {
        if (typeof entry.totalStock[wid] === 'number') entry.totalStock[wid] += qty
      }
      entry.totalCredits += fleet.credits || 0
    }

    // Average prices across all sectors
    const priceCounts: Record<string, number> = {}
    for (const sectorPriceMap of Object.values(state.sectorPrices)) {
      for (const [wid, price] of Object.entries(sectorPriceMap)) {
        if (typeof entry.avgPrices[wid] === 'number') {
          entry.avgPrices[wid] += price
          priceCounts[wid] = (priceCounts[wid] || 0) + 1
        }
      }
    }

    for (const w of state.wares) {
      if ((priceCounts[w.id] || 0) > 0) entry.avgPrices[w.id] /= priceCounts[w.id]
      else entry.avgPrices[w.id] = w.basePrice
    }

    let stockValue = 0
    for (const w of state.wares) {
      stockValue += (entry.totalStock[w.id] || 0) * (entry.avgPrices[w.id] || 0)
    }
    entry.totalAssetValue = stockValue + entry.totalCredits

    return entry
  }

  const resetEconomyHistory = () => {
    economyHistory.length = 0
    economyHistorySessionId = genId()
    lastEconomySnapshotAt = 0
  }

  const maybeSnapshotEconomy = (nowMs = Date.now()) => {
    if (nowMs - lastEconomySnapshotAt < ECONOMY_SNAPSHOT_INTERVAL_MS) return
    lastEconomySnapshotAt = nowMs
    economyHistory.push(captureEconomySnapshot(nowMs))
    if (economyHistory.length > ECONOMY_HISTORY_LIMIT) {
      economyHistory.splice(0, economyHistory.length - ECONOMY_HISTORY_LIMIT)
    }
  }

  const getEconomyHistory = (opts?: { since?: number; limit?: number }) => {
    const since = opts?.since || 0
    const limit = opts?.limit || 0
    let entries = since > 0 ? economyHistory.filter(e => e.timestamp > since) : economyHistory
    if (limit > 0 && entries.length > limit) entries = entries.slice(entries.length - limit)
    return { sessionId: economyHistorySessionId, economyHistory: entries }
  }

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
    resetEconomyHistory()
    corpAILogs.length = 0
    corpAILogNextId = 1
    ;(state as any)._corpAutopilotLastRunSec = {}
    ;(state as any)._corpAutopilotInFlight = {}

    if (options?.fresh) {
      clearPersistedCorpAILogs()
    }

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
        state.workOrders = Array.isArray((loadedState as any).workOrders) ? (loadedState as any).workOrders : []
        remapLegacyStations()

        // Ensure newly-added default corps exist in older saves.
        try {
          const existing = new Set(state.corporations.map(c => c.id))
          const needed = ['teladi_shieldworks']
          for (const id of needed) {
            if (existing.has(id)) continue
            const template = INITIAL_CORPORATIONS.find(c => c.id === id)
            if (!template) continue
            state.corporations.push(JSON.parse(JSON.stringify(template)))
            console.log(`[Universe] Added missing default corporation: ${id}`)
          }
        } catch {
          // ignore
        }

        // Ensure Shieldworks has at least some shield production stations.
        try {
          const shieldCorpId = 'teladi_shieldworks'
          const corp = state.corporations.find((c) => c.id === shieldCorpId)
          if (corp) {
            const ensureStation = (sectorId: string, recipeId: string, name: string) => {
              const r = state.recipes.find((rec: any) => rec.id === recipeId)
              if (!r) return null

              const exists = state.stations.some((s: any) => s.ownerId === shieldCorpId && s.recipeId === recipeId)
              if (exists) return null

              let id = `${sectorId}_${slug(name, genId())}`
              let k = 2
              while (state.stations.some((s: any) => s.id === id)) {
                id = `${sectorId}_${slug(name, genId())}_${k++}`
              }

              const inv: Record<string, number> = {}
              const reorder: Record<string, number> = {}
              const reserve: Record<string, number> = {}
              for (const i of r.inputs || []) {
                inv[i.wareId] = Math.max(1, Math.floor(i.amount * 40))
                reorder[i.wareId] = Math.max(1, Math.floor(i.amount * 60))
              }
              if (r.productStorageCap > 0) {
                inv[r.productId] = Math.max(0, Math.floor(r.productStorageCap * 0.15))
                reserve[r.productId] = Math.max(0, Math.floor(r.productStorageCap * 0.25))
              }

              const st: Station = {
                id,
                name: `${corp.name.split(' ')[0]} ${name}`,
                recipeId,
                sectorId,
                position: randomPos(),
                modelPath: '/models/00442.obj',
                inventory: inv,
                reorderLevel: reorder,
                reserveLevel: reserve,
                ownerId: shieldCorpId,
              }
              state.stations.push(st)
              corp.stationIds = Array.isArray(corp.stationIds) ? corp.stationIds : []
              corp.stationIds.push(st.id)
              return st
            }

            ensureStation('seizewell', 'shield_component_factory', 'Shield Component Factory')
            ensureStation('seizewell', 'shield_prod_1mw', '1MW Shield Plant')
            ensureStation('teladi_gain', 'shield_prod_25mw', '25MW Shield Plant')

            normalizeStationRecipes(state.stations, state.recipes)
            state.sectorPrices = computeSectorPrices(state.stations, state.recipes, state.wares)
          }
        } catch {
          // ignore
        }

        // Ensure Shieldworks has at least one trader fleet.
        try {
          const shieldCorpId = 'teladi_shieldworks'
          const corp: any = state.corporations.find((c) => c.id === shieldCorpId)
          if (corp) {
            corp.fleetIds = Array.isArray(corp.fleetIds) ? corp.fleetIds : []
            const hasFleet = state.fleets.some((f: any) => f?.ownerId === shieldCorpId)
            if (!hasFleet) {
              const now = Date.now()
              const fleet: NPCFleet = {
                id: `fleet_${genId()}`,
                name: `${corp.name.split(' ')[0]} Trader ${genId().substring(0, 4)}`,
                shipType: 'Vulture',
                modelPath: SHIP_CATALOG.vulture.modelPath,
                race: corp.race || 'teladi',
                capacity: SHIP_CATALOG.vulture.capacity,
                speed: SHIP_CATALOG.vulture.speed,
                homeSectorId: 'seizewell',
                ownerId: shieldCorpId,
                ownerType: corp.type || 'guild',
                behavior: 'corp-logistics',
                autonomy: 0.7,
                profitShare: 0.15,
                currentSectorId: 'seizewell',
                position: randomPos(),
                state: 'idle',
                stateStartTime: now,
                lastReportAt: now,
                cargo: {},
                credits: 10000,
                commandQueue: [],
                totalProfit: 0,
                tripsCompleted: 0
              }
              state.fleets.push(fleet)
              corp.fleetIds.push(fleet.id)
              console.log('[Universe] Added Shieldworks trader fleet.')
            }
          }
        } catch {
          // ignore
        }

        // If corp is LLM-exclusive, drop any legacy NPC construction jobs/TLs so only LLM drives expansion.
        for (const corp of state.corporations) {
          if (!isLLMExclusiveCorp(corp.id)) continue
          if (!corp.aiState) continue

          const before = corp.aiState.pendingConstructions.length
          corp.aiState.pendingConstructions = corp.aiState.pendingConstructions.filter((j: any) => j?.source === 'llm')
          const after = corp.aiState.pendingConstructions.length

          const keepBuilderIds = new Set<string>(corp.aiState.pendingConstructions.map((j: any) => String(j.builderShipId || '')).filter(Boolean))
          const removedConstructionFleets = state.fleets.filter((f: any) =>
            f?.ownerId === corp.id &&
            f?.behavior === 'construction' &&
            !keepBuilderIds.has(String(f.id))
          )

          if (removedConstructionFleets.length > 0) {
            state.fleets = state.fleets.filter((f: any) => !(f?.ownerId === corp.id && f?.behavior === 'construction' && !keepBuilderIds.has(String(f.id))))
            corp.fleetIds = (corp.fleetIds || []).filter((id: string) => !removedConstructionFleets.some((f: any) => f.id === id))
          }

          if (before !== after) {
            console.log(`[LLM] Purged ${before - after} NPC construction jobs for exclusive corp ${corp.id}`)
          }
          if (removedConstructionFleets.length > 0) {
            console.log(`[LLM] Removed ${removedConstructionFleets.length} construction fleets for exclusive corp ${corp.id}`)
          }
        }

        // PATCH: Ensure Shipyards have capabilities, build recipes, and starting ship stock keys.
        patchShipyards(state.stations, state.recipes, { seedShipStock: false })

        console.log(`[Universe] State restored! ${state.stations.length} stations, ${state.fleets.length} fleets.`)
        loadPersistedCorpAILogs()
        maybeSnapshotEconomy(Date.now())
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
    clearPersistedCorpAILogs()
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

      // If a shipyard got recipeId=shipyard (station-type), ensure it runs an actual build recipe.
      if ((recipeId === 'shipyard' || cs.name.toLowerCase().includes('shipyard') || cs.name.toLowerCase().includes('wharf')) && !recipes.find(r => r.id === recipeId)) {
        if (recipes.find(r => r.id === 'build_vulture')) recipeId = 'build_vulture'
        else if (capabilities) {
          const capRecipe = capabilities.find((capId) => recipes.find(r => r.id === capId))
          if (capRecipe) recipeId = capRecipe
        }
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
          ['energy_cells', 'hull_parts', 'engine_parts', 'computer_components', 'quantum_tubes', 'microchips', '1mw_shield', '25mw_shield'].forEach(res => {
            if (!st.inventory[res]) st.inventory[res] = 500;
          });
        }

        // Ensure reorder/reserve levels are set
        if (Object.keys(st.reorderLevel).length === 0) {
          recipe.inputs.forEach(i => st.reorderLevel[i.wareId] = i.amount * 20)
        }
        // For shipyards, also add reorder levels for all build-capability inputs so the trade AI supplies them.
        if (st.capabilities && st.capabilities.length > 0) {
          st.capabilities.forEach(capId => {
            const capR = recipes.find(r => r.id === capId)
            if (!capR) return
            capR.inputs.forEach(i => {
              const prev = Number(st.reorderLevel[i.wareId] || 0)
              st.reorderLevel[i.wareId] = Math.max(prev, i.amount * 20)
              if (typeof st.inventory[i.wareId] === 'undefined') st.inventory[i.wareId] = 0
            })
          })
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
    patchShipyards(stations, recipes, { seedShipStock: true })

    // Ensure Shieldworks starts with shield fabs (deterministic seed, avoids random ownership misses).
    try {
      const shieldCorpId = 'teladi_shieldworks'
      const corp = corporations.find((c) => c.id === shieldCorpId) || null
      if (corp) {
        const ensureStation = (sectorId: string, recipeId: string, name: string) => {
          const r = recipes.find((rec: any) => rec.id === recipeId)
          if (!r) return null
          const exists = stations.some((s: any) => s.ownerId === shieldCorpId && s.recipeId === recipeId)
          if (exists) return null

          const baseName = `${corp.name.split(' ')[0]} ${name}`
          let id = `${sectorId}_${slug(baseName, genId())}`
          let k = 2
          while (stations.some((s: any) => s.id === id)) id = `${sectorId}_${slug(baseName, genId())}_${k++}`

          const inv: Record<string, number> = {}
          const reorder: Record<string, number> = {}
          const reserve: Record<string, number> = {}
          for (const i of r.inputs || []) {
            inv[i.wareId] = Math.max(1, Math.floor(i.amount * 40))
            reorder[i.wareId] = Math.max(1, Math.floor(i.amount * 60))
          }
          if (r.productStorageCap > 0) {
            inv[r.productId] = Math.max(0, Math.floor(r.productStorageCap * 0.15))
            reserve[r.productId] = Math.max(0, Math.floor(r.productStorageCap * 0.25))
          }

          const st: Station = {
            id,
            name: baseName,
            recipeId,
            sectorId,
            position: randomPos(),
            modelPath: '/models/00442.obj',
            inventory: inv,
            reorderLevel: reorder,
            reserveLevel: reserve,
            ownerId: shieldCorpId,
          }
          stations.push(st)
          corp.stationIds.push(st.id)
          return st
        }

        ensureStation('seizewell', 'shield_component_factory', 'Shield Component Factory')
        ensureStation('seizewell', 'shield_prod_1mw', '1MW Shield Plant')
        ensureStation('teladi_gain', 'shield_prod_25mw', '25MW Shield Plant')
      }
    } catch {
      // ignore
    }

    state.wares = wares
    state.recipes = recipes
    state.stations = stations
    state.sectorPrices = computeSectorPrices(stations, recipes, wares)
    state.workOrders = []

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

    // Ensure Shieldworks starts with at least one trader fleet.
    try {
      const shieldCorpId = 'teladi_shieldworks'
      const corp = corporations.find((c) => c.id === shieldCorpId) || null
      if (corp) {
        const hasFleet = fleets.some((f) => f.ownerId === shieldCorpId)
        if (!hasFleet) {
          const now = Date.now()
          const fleet: NPCFleet = {
            id: `fleet_${genId()}`,
            name: `${corp.name.split(' ')[0]} Trader ${genId().substring(0, 4)}`,
            shipType: 'Vulture',
            modelPath: SHIP_CATALOG.vulture.modelPath,
            race: corp.race,
            capacity: SHIP_CATALOG.vulture.capacity,
            speed: SHIP_CATALOG.vulture.speed,
            homeSectorId: 'seizewell',
            ownerId: corp.id,
            ownerType: corp.type,
            behavior: 'corp-logistics',
            autonomy: 0.7,
            profitShare: 0.15,
            currentSectorId: 'seizewell',
            position: randomPos(),
            state: 'idle',
            stateStartTime: now,
            lastReportAt: now,
            cargo: {},
            credits: 10000,
            commandQueue: [],
            totalProfit: 0,
            tripsCompleted: 0,
          }
          fleets.push(fleet)
          corp.fleetIds.push(fleet.id)
        }
      }
    } catch {
      // ignore
    }

    remapLegacyStations()
    state.tradeLog = []
    state.acc = 0
    state.elapsedTimeSec = 0
    state.lastTickTime = Date.now()
    maybeSnapshotEconomy(Date.now())
  }

  // ============ Corporation AI Logic ============
  const runCorporationAI = () => {
    const now = Date.now()

    state.corporations.forEach(corp => {
      const llmExclusive = isLLMExclusiveCorp(corp.id)
      // Initialize AI state if missing
      if (!corp.aiState) {
        corp.aiState = { lastExpansionCheck: now, currentGoal: 'expand', pendingConstructions: [] }
      }
      const ai = corp.aiState

      // Manage Pending Constructions
      for (let i = ai.pendingConstructions.length - 1; i >= 0; i--) {
        const job = ai.pendingConstructions[i]
        const jobSource = job.source || 'npc'

        if (job.status === 'planning') {
          if (llmExclusive && jobSource !== 'llm') {
            // LLM-exclusive corp: ignore legacy NPC jobs.
            continue
          }
          const blueprint = STATION_BLUEPRINTS[job.stationType]
          if (!blueprint) {
            console.warn(`[CorpAI] Unknown station type ${job.stationType} for job ${job.id}; dropping.`)
            ai.pendingConstructions.splice(i, 1)
            continue
          }

          if (jobSource === 'llm' && !job.costPaid) {
            if (corp.credits < blueprint.cost) {
              if (!job.lastFundingLogAt || now - job.lastFundingLogAt > 60000) {
                pushCorpLog(corp.id, 'actions', {
                  type: 'construction_waiting_funds',
                  stationType: job.stationType,
                  targetSectorId: job.targetSectorId,
                  cost: blueprint.cost,
                  credits: corp.credits,
                })
                job.lastFundingLogAt = now
              }
              continue
            }
            corp.credits -= blueprint.cost
            job.costPaid = blueprint.cost
            job.fundedAt = now
            pushCorpLog(corp.id, 'actions', {
              type: 'construction_funded',
              stationType: job.stationType,
              targetSectorId: job.targetSectorId,
              cost: blueprint.cost,
              credits: corp.credits,
            })
          }

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
            issueCommand(tl.id, { type: 'goto-gate', targetSectorId: nextSector, source: jobSource })
            issueCommand(tl.id, { type: 'use-gate', targetSectorId: nextSector, source: jobSource })
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
          if (llmExclusive && jobSource !== 'llm') {
            continue
          }
          // Check if TL is there
          const tl = state.fleets.find(f => f.id === job.builderShipId)
          if (!tl) {
            console.warn(`[CorpAI] Builder ship ${job.builderShipId} not found for job ${job.id}. Resetting to PLANNING.`)
            job.status = 'planning' // Retry
            continue
          }


          if (tl.currentSectorId === job.targetSectorId) {
            const blueprint = STATION_BLUEPRINTS[job.stationType]
            if (!blueprint) {
              console.warn(`[CorpAI] Unknown station type ${job.stationType} for job ${job.id}; dropping.`)
              ai.pendingConstructions.splice(i, 1)
              continue
            }

            if (jobSource === 'llm' && !job.costPaid) {
              if (corp.credits < blueprint.cost) {
                if (!job.lastFundingLogAt || now - job.lastFundingLogAt > 60000) {
                  pushCorpLog(corp.id, 'actions', {
                    type: 'construction_waiting_funds',
                    stationType: job.stationType,
                    targetSectorId: job.targetSectorId,
                    cost: blueprint.cost,
                    credits: corp.credits,
                  })
                  job.lastFundingLogAt = now
                }
                tl.commandQueue = []
                tl.state = 'idle'
                continue
              }
              corp.credits -= blueprint.cost
              job.costPaid = blueprint.cost
              job.fundedAt = now
              pushCorpLog(corp.id, 'actions', {
                type: 'construction_funded',
                stationType: job.stationType,
                targetSectorId: job.targetSectorId,
                cost: blueprint.cost,
                credits: corp.credits,
              })
            }

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
              issueCommand(tl.id, { type: 'goto-gate', targetSectorId: nextSector, source: jobSource })
              issueCommand(tl.id, { type: 'use-gate', targetSectorId: nextSector, source: jobSource })
              tl.state = 'in-transit'
              tl.destinationSectorId = job.targetSectorId
              tl.stateStartTime = now
              const pathStr = [tl.currentSectorId, ...path].join(' -> ')
              console.log(`[CorpAI] TL ${tl.name} path: ${pathStr}`)
            }
          }
        }
        else if (job.status === 'building') {
          if (llmExclusive && jobSource !== 'llm') {
            continue
          }
          // DEPLOY
          const blueprint = STATION_BLUEPRINTS[job.stationType]
          if (blueprint) {
            const recipeSet = new Set(state.recipes.map((r) => r.id))
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
                if (job.stationType === 'oil_refinery' && recipeSet.has('sun_oil_refinery')) return 'sun_oil_refinery'
                // If the blueprint key isn't itself a recipe id (e.g. factory_shield_components),
                // prefer the blueprint's id when it matches a recipe (e.g. shield_component_factory).
                if (recipeSet.has(job.stationType)) return job.stationType
                if (recipeSet.has(blueprint.id)) return blueprint.id
                return recipeSet.has('logistics_hub') ? 'logistics_hub' : job.stationType
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

      // If LLM-exclusive, stop NPC corp from making new decisions.
      // We still process existing pending constructions so LLM-queued builds execute.
      if (llmExclusive) return

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
              costPaid: blueprint.cost,
              fundedAt: now,
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
    sweepWorkOrders()

    // Run AI
    runCorporationAI()
    spawnSoleTraders()
    runTraderPromotion()

    // ============ LLM Corp Autopilot (every N in-game seconds) ============
    const autopilotEnabled = process.env.CORP_AUTOPILOT_ENABLED !== 'false' && Boolean(process.env.OPENROUTER_API_KEY)
    if (autopilotEnabled) {
      const periodSec = Number(process.env.CORP_AUTOPILOT_PERIOD_SEC || '3600') || 3600
      const corpIds = String(process.env.CORP_AUTOPILOT_CORP_IDS || 'teladi_company')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      ;(state as any)._corpAutopilotLastRunSec = (state as any)._corpAutopilotLastRunSec || {}
      ;(state as any)._corpAutopilotInFlight = (state as any)._corpAutopilotInFlight || {}
      const lastRunMap: Record<string, number> = (state as any)._corpAutopilotLastRunSec
      const inFlightMap: Record<string, boolean> = (state as any)._corpAutopilotInFlight

      for (const corpId of corpIds) {
        const last = typeof lastRunMap[corpId] === 'number' ? lastRunMap[corpId] : -Infinity
        if (state.elapsedTimeSec - last < periodSec) continue
        if (inFlightMap[corpId]) continue

        inFlightMap[corpId] = true
        lastRunMap[corpId] = state.elapsedTimeSec

        void (async () => {
          try {
            await runCorpControllerStep({ corpId, reason: `autopilot @ t=${state.elapsedTimeSec}s` })
          } catch (e: any) {
            pushCorpLog(corpId, 'error', e?.message || 'autopilot_error')
          } finally {
            inFlightMap[corpId] = false
          }
        })()
      }
    }

    // ============ Fleet Tick Logic ============
    const now = Date.now()

    // Prevent dog-piling: reserve supply/demand as orders are assigned this tick.
    // This avoids many traders selecting the exact same best route simultaneously.
    const reservedSupply = new Map<string, number>() // key: stationId:wareId -> reserved export qty
    const reservedDemand = new Map<string, number>() // key: stationId:wareId -> reserved import qty
    const resKey = (stationId: string, wareId: string) => `${stationId}:${wareId}`
    const getRes = (m: Map<string, number>, k: string) => m.get(k) || 0
    const addRes = (m: Map<string, number>, stationId: string, wareId: string, qty: number) => {
      if (!Number.isFinite(qty) || qty <= 0) return
      const k = resKey(stationId, wareId)
      m.set(k, getRes(m, k) + qty)
    }

  // Helper: Find best trade route for a fleet
  const findBestTradeRoute = (fleet: NPCFleet): TradeOrder | null => {
      const routes: { buyStation: Station; sellStation: Station; wareId: string; profit: number; qty: number; score: number; buyPrice: number; sellPrice: number }[] = []

      // Prefer corp-issued work orders for independent traders.
      const isIndependent = !fleet.ownerId
      if (isIndependent && Array.isArray(state.workOrders) && state.workOrders.length > 0) {
        const now = Date.now()
        let best: { wo: WorkOrder; buyStation: Station; sellStation: Station; qty: number; buyPrice: number; sellPrice: number; expectedProfit: number } | null = null

        const getWare = (wareId: string) => state.wares.find(w => w.id === wareId)
        for (const wo of state.workOrders) {
          if (!wo || wo.status === 'completed' || wo.status === 'cancelled' || wo.status === 'expired') continue
          if (wo.expiresAtMs && wo.expiresAtMs <= now) continue
          if (wo.qtyRemaining <= 0) continue
          if (wo.assignedFleetId && wo.assignedFleetId !== fleet.id) continue
          if (!wo.assignedFleetId && wo.status === 'assigned') continue

          const buyStation = state.stations.find(s => s.id === wo.buyStationId)
          const sellStation = state.stations.find(s => s.id === wo.sellStationId)
          if (!buyStation || !sellStation) continue

          const ware = getWare(wo.wareId)
          const volume = ware?.volume || 1
          const maxByCapacity = Math.max(0, Math.floor(fleet.capacity / Math.max(1, volume)))
          if (maxByCapacity <= 0) continue

          const buyPrice = state.sectorPrices[buyStation.sectorId]?.[wo.wareId] || ware?.basePrice || 0
          const sellPrice = state.sectorPrices[sellStation.sectorId]?.[wo.wareId] || ware?.basePrice || 0
          const maxAffordable = buyPrice > 0 ? Math.floor(fleet.credits / buyPrice) : maxByCapacity
          const qty = Math.max(0, Math.min(wo.qtyRemaining, maxByCapacity, maxAffordable, buyStation.inventory[wo.wareId] || 0))
          if (qty <= 0) continue

          const expectedProfit = ((sellPrice - buyPrice) + wo.bonusPerUnit) * qty
          if (!best || expectedProfit > best.expectedProfit) {
            best = { wo, buyStation, sellStation, qty, buyPrice, sellPrice, expectedProfit }
          }
        }

        if (best) {
          const o: any = {
            id: genId(),
            buyStationId: best.buyStation.id,
            buyStationName: best.buyStation.name,
            buySectorId: best.buyStation.sectorId,
            buyWareId: best.wo.wareId,
            buyWareName: state.wares.find(w => w.id === best.wo.wareId)?.name || best.wo.wareId,
            buyQty: best.qty,
            buyPrice: best.buyPrice,
            sellStationId: best.sellStation.id,
            sellStationName: best.sellStation.name,
            sellSectorId: best.sellStation.sectorId,
            sellWareId: best.wo.wareId,
            sellWareName: state.wares.find(w => w.id === best.wo.wareId)?.name || best.wo.wareId,
            sellQty: best.qty,
            sellPrice: best.sellPrice,
            expectedProfit: best.expectedProfit,
            createdAt: now,
            _workOrderId: best.wo.id,
            _workOrderBonusPerUnit: best.wo.bonusPerUnit,
          }
          return o as TradeOrder
        }
      }

      // Allow stations to trade a slice of their current stock even if they're below their ideal reserve.
      // This prevents newly-seeded stations with large reserve targets from never exporting anything.
      const getAvailable = (stock: number, reserve: number) => {
        if (stock <= 0) return 0
        const softReserve = Math.min(reserve || 0, stock * 0.5)
        return Math.max(0, stock - softReserve)
      }

      const getWare = (wareId: string) => state.wares.find(w => w.id === wareId)
      const getAvailableAdjusted = (st: Station, wareId: string) => {
        const stock = st.inventory[wareId] || 0
        const reserve = st.reserveLevel[wareId] || 0
        const raw = getAvailable(stock, reserve)
        return Math.max(0, raw - getRes(reservedSupply, resKey(st.id, wareId)))
      }
      const getNeedAdjusted = (st: Station, wareId: string) => {
        const need = (st.reorderLevel[wareId] || 0) - (st.inventory[wareId] || 0)
        return Math.max(0, need - getRes(reservedDemand, resKey(st.id, wareId)))
      }

      const getStationOwner = (st: Station) => st.ownerId || null
      const isSameOwner = (a: string | null, b: string | null) => Boolean(a) && a === b
      const applyExternalMargin = (seller: Station, buyer: Station, wareId: string, buyPrice: number, sellPrice: number) => {
        // Ensure a minimum profit margin on non-internal trades so traders don't perform "free work"
        // when sector prices happen to be equal.
        const sellerOwner = getStationOwner(seller)
        const buyerOwner = getStationOwner(buyer)
        if (isSameOwner(sellerOwner, buyerOwner)) return { sellPrice, profitPerUnit: sellPrice - buyPrice }

        if (sellPrice <= buyPrice) {
          const base = getWare(wareId)?.basePrice || 100
          const minAbs = Math.max(1, base * 0.02) // at least 1 Cr or 2% of base
          sellPrice = buyPrice + minAbs
        }
        return { sellPrice, profitPerUnit: sellPrice - buyPrice }
      }

      const estimateTradeSeconds = (fromSectorId: string, toSectorId: string, qty: number, wareVolume: number) => {
        const path = findSectorPath(fromSectorId, toSectorId)
        if (path === null) return Infinity
        const hops = path.length
        const speed = Math.max(0.1, fleet.speed || 1)
        const transit = (hops * FLEET_CONSTANTS.BASE_JUMP_TIME) / speed
        const transfer = ((qty * Math.max(1, wareVolume)) / 1000) * FLEET_CONSTANTS.TRANSFER_TIME_PER_1000
        const dockCycle = FLEET_CONSTANTS.DOCK_TIME * 2
        return transit + transfer + dockCycle
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
            const need = getNeedAdjusted(homeSt, input.wareId)
            if (need <= 0) continue

            // Find selling stations
            for (const seller of state.stations) {
              if (seller.id === homeSt.id) continue
              const sellerRecipe = recipeById.get(seller.recipeId)
              if (!sellerRecipe || sellerRecipe.productId !== input.wareId) continue
              const available = getAvailableAdjusted(seller, input.wareId)
              if (available <= 0) continue

              const ware = getWare(input.wareId)
              const maxQtyByVolume = Math.max(0, Math.floor((fleet.capacity || 0) / Math.max(1, ware?.volume || 1)))
              const qty = Math.min(available, need, maxQtyByVolume)
              if (qty <= 0) continue
              const buyPrice = (state.sectorPrices[seller.sectorId]?.[input.wareId] || state.wares.find(w => w.id === input.wareId)?.basePrice || 100)
              let sellPrice = buyPrice * 1.1 // Supply markup (service fee)
              const adjusted = applyExternalMargin(seller, homeSt, input.wareId, buyPrice, sellPrice)
              sellPrice = adjusted.sellPrice
              const profit = adjusted.profitPerUnit * qty
              if (profit > FLEET_CONSTANTS.MIN_PROFIT_MARGIN) {
                const eta = estimateTradeSeconds(seller.sectorId, homeSt.sectorId, qty, ware?.volume || 1)
                const score = profit / Math.max(1, eta)
                routes.push({ buyStation: seller, sellStation: homeSt, wareId: input.wareId, profit, qty, score, buyPrice, sellPrice })
              }
            }
          }
        } else {
          // station-distribute: sell home station's products
          const productId = recipe.productId
          const available = getAvailableAdjusted(homeSt, productId)
          if (available > 0) {
            // Find buyers
            for (const buyer of state.stations) {
              if (buyer.id === homeSt.id) continue
              const buyerRecipe = recipeById.get(buyer.recipeId)
              if (!buyerRecipe) continue
              const needsProduct = buyerRecipe.inputs.some(i => i.wareId === productId)
              if (!needsProduct) continue
              const buyerNeed = getNeedAdjusted(buyer, productId)
              if (buyerNeed <= 0) continue

              const ware = getWare(productId)
              const maxQtyByVolume = Math.max(0, Math.floor((fleet.capacity || 0) / Math.max(1, ware?.volume || 1)))
              const qty = Math.min(available, buyerNeed, maxQtyByVolume)
              if (qty <= 0) continue
              const sellPrice = (state.sectorPrices[buyer.sectorId]?.[productId] || state.wares.find(w => w.id === productId)?.basePrice || 100)
              let buyPrice = sellPrice * 0.9
              // For distribution routes, the "seller" is home station and the buyer is the destination.
              // Apply a minimum external margin so we don't do free deliveries.
              const adjusted = applyExternalMargin(homeSt, buyer, productId, buyPrice, sellPrice)
              const profit = adjusted.profitPerUnit * qty
              if (profit > FLEET_CONSTANTS.MIN_PROFIT_MARGIN) {
                const eta = estimateTradeSeconds(homeSt.sectorId, buyer.sectorId, qty, ware?.volume || 1)
                const score = profit / Math.max(1, eta)
                routes.push({ buyStation: homeSt, sellStation: buyer, wareId: productId, profit, qty, score, buyPrice, sellPrice: adjusted.sellPrice })
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
            const available = getAvailableAdjusted(st, ware.id)
            return available > 0
          })

          // Find buyers (consumers needing this ware)
          const buyers = state.stations.filter(st => {
            const r = recipeById.get(st.recipeId)
            if (!r) return false
            const needsWare = r.inputs.some(i => i.wareId === ware.id)
            if (!needsWare) return false
            const need = getNeedAdjusted(st, ware.id)
            return need > 0
          })

          for (const seller of sellers) {
            for (const buyer of buyers) {
              if (seller.id === buyer.id) continue
              const available = getAvailableAdjusted(seller, ware.id)
              const need = getNeedAdjusted(buyer, ware.id)
              const maxQtyByVolume = Math.max(0, Math.floor((fleet.capacity || 0) / Math.max(1, ware.volume || 1)))
              const qty = Math.min(available, need, maxQtyByVolume)
              if (qty <= 0) continue

              const buyPrice = state.sectorPrices[seller.sectorId]?.[ware.id] || ware.basePrice
              let sellPrice = state.sectorPrices[buyer.sectorId]?.[ware.id] || ware.basePrice
              const adjusted = applyExternalMargin(seller, buyer, ware.id, buyPrice, sellPrice)
              sellPrice = adjusted.sellPrice
              const profit = adjusted.profitPerUnit * qty
              if (profit > FLEET_CONSTANTS.MIN_PROFIT_MARGIN) {
                const eta = estimateTradeSeconds(seller.sectorId, buyer.sectorId, qty, ware.volume || 1)
                const score = profit / Math.max(1, eta)
                if (Number.isFinite(score) && score > 0) {
                  routes.push({ buyStation: seller, sellStation: buyer, wareId: ware.id, profit, qty, score, buyPrice, sellPrice })
                }
              }
            }
          }
        }
      }

      if (routes.length === 0) {
        // console.log(`[Universe] No routes found for ${fleet.name} (checked ${state.stations.length} stations)`)
        return null
      }

      // Pick best route (profit per second, with some randomness for variety)
      // Tiny jitter to avoid deterministic ties producing identical orders across fleets.
      // (Reservations handle most dog-piling; this just breaks exact score ties.)
      routes.sort((a, b) => (b.score + Math.random() * 1e-6) - (a.score + Math.random() * 1e-6))
      const pick = routes[Math.floor(Math.random() * Math.min(3, routes.length))]

      return {
        id: genId(),
        buyStationId: pick.buyStation.id,
        buyStationName: pick.buyStation.name,
        buySectorId: pick.buyStation.sectorId,
        buyWareId: pick.wareId,
        buyWareName: getWareName(pick.wareId),
        buyQty: pick.qty,
        buyPrice: pick.buyPrice,
        sellStationId: pick.sellStation.id,
        sellStationName: pick.sellStation.name,
        sellSectorId: pick.sellStation.sectorId,
        sellWareId: pick.wareId,
        sellWareName: getWareName(pick.wareId),
        sellQty: pick.qty,
        sellPrice: pick.sellPrice,
        expectedProfit: pick.profit,
        createdAt: now,
      }
    }

    // Process each fleet
    for (const fleet of state.fleets) {
      const llmExclusiveTradingFleet =
        isLLMExclusiveCorp(fleet.ownerId) &&
        (fleet.behavior === 'station-supply' ||
          fleet.behavior === 'station-distribute' ||
          fleet.behavior === 'corp-logistics' ||
          fleet.behavior === 'freelance' ||
          fleet.behavior === 'guild-assigned')
      const llmExclusiveFleet = isLLMExclusiveCorp(fleet.ownerId)
      // Autonomous mode: if fleet has commands queued, let frontend handle it
      // Backend only issues new commands when queue is empty
      let hasQueuedCommands = fleet.commandQueue.length > 0

      if (llmExclusiveFleet && fleet.behavior !== 'construction') {
        const orderSource = (fleet.currentOrder as any)?._source
        const hasLLMCommand = fleet.commandQueue.some((c: any) => c?.source === 'llm')
        // Hard stop: exclusive corps can only move on LLM-tagged commands/orders.
        if (orderSource !== 'llm' && !hasLLMCommand) {
          if (fleet.state !== 'idle' || fleet.destinationSectorId || fleet.targetStationId) {
            fleet.destinationSectorId = undefined
            fleet.targetStationId = undefined
            fleet.state = 'idle'
            fleet.stateStartTime = now
          }
        }
        if (hasQueuedCommands && !hasLLMCommand && orderSource !== 'llm') {
          fleet.commandQueue = []
          fleet.currentOrder = undefined
          fleet.destinationSectorId = undefined
          fleet.targetStationId = undefined
          fleet.state = 'idle'
          fleet.stateStartTime = now
          hasQueuedCommands = false
        }
      }

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

        if (llmExclusiveFleet && fleet.behavior !== 'construction') {
          const hasLLMCommand = fleet.commandQueue.some((c: any) => c?.source === 'llm')
          const orderSource = (fleet.currentOrder as any)?._source
          if (!hasLLMCommand && orderSource !== 'llm') {
            // Don’t let legacy queues drive exclusive corp fleets.
            fleet.commandQueue = []
            fleet.currentOrder = undefined
            fleet.destinationSectorId = undefined
            fleet.targetStationId = undefined
            fleet.state = 'idle'
            fleet.stateStartTime = now
            continue
          }
        }

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

            const sellerOwner = fleet.ownerId ? String(fleet.ownerId) : null
            const buyerOwner = station.ownerId || null
            const isInternalSale = Boolean(sellerOwner) && sellerOwner === buyerOwner

            // Credit revenue (transaction-based)
            const sellPrice = state.sectorPrices[station.sectorId]?.[wareId] || state.wares.find(w => w.id === wareId)?.basePrice || 0
            const revenue = amount * sellPrice
            if (!isInternalSale && revenue > 0) {
              const buyerCorp = buyerOwner ? state.corporations.find(c => c.id === buyerOwner) : undefined
              const sellerCorp = sellerOwner ? state.corporations.find(c => c.id === sellerOwner) : undefined
              if (buyerCorp && buyerOwner !== sellerOwner) buyerCorp.credits -= revenue
              if (sellerCorp) sellerCorp.credits += revenue
              else fleet.credits += revenue
            }

            // Log trade for visibility
            state.tradeLog.unshift({
              id: genId(),
              timestamp: now,
              ingameTimeSec: state.elapsedTimeSec,
              fleetId: fleet.id,
              fleetName: fleet.name,
              fleetOwnerId: sellerOwner,
              wareId,
              wareName: state.wares.find(w => w.id === wareId)?.name || wareId,
              quantity: amount,
              buyPrice: 0,
              sellPrice,
              profit: isInternalSale ? 0 : revenue,
              buySectorId: fleet.currentSectorId,
              sellSectorId: station.sectorId,
              sellStationId: station.id,
              buyStationName: fleet.targetStationId || 'unknown',
              sellStationName: station.name,
              buyStationOwnerId: null,
              sellStationOwnerId: station.ownerId || null,
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
          if (llmExclusiveFleet && (fleet.currentOrder as any)?._source !== 'llm') {
            // Don’t auto-recover movement for exclusive corps unless it’s an LLM-issued order.
            fleet.destinationSectorId = undefined
            fleet.targetStationId = undefined
            fleet.state = 'idle'
            fleet.stateStartTime = now
            continue
          }
          const path = findSectorPath(fleet.currentSectorId, fleet.destinationSectorId)
          if (path && path.length > 0) {
            const nextSector = path[0]
            issueCommand(fleet.id, { type: 'goto-gate', targetSectorId: nextSector, source: llmExclusiveFleet ? 'llm' : 'npc' })
            issueCommand(fleet.id, { type: 'use-gate', targetSectorId: nextSector, source: llmExclusiveFleet ? 'llm' : 'npc' })
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
          if (llmExclusiveFleet && fleet.behavior !== 'construction') {
            // LLM-exclusive corps: do not auto-run patrol/trade when idle.
            continue
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
            if (llmExclusiveTradingFleet) {
              // LLM-controlled corp: do not auto-assign trade orders here.
              // The autopilot (or manual LLM runs) will decide when/where to trade.
              continue
            }
            // Trade logic
            const order = findBestTradeRoute(fleet)
            if (!order) {
              console.log(`[Universe] Idle: No profitable trade found for ${fleet.name}`)
            }
            if (order) {
              // If this is a corp-issued work order, claim it for this fleet (best-effort).
              const woId = String((order as any)?._workOrderId || '')
              if (woId && Array.isArray(state.workOrders)) {
                const wo = state.workOrders.find(w => w.id === woId)
                if (wo && (wo.status === 'open' || (wo.status === 'assigned' && wo.assignedFleetId === fleet.id))) {
                  wo.status = 'assigned'
                  wo.assignedFleetId = fleet.id
                }
              }

              fleet.currentOrder = order

              // Reserve supply/demand so later fleets this tick don't pick the identical leg.
              addRes(reservedSupply, order.buyStationId, order.buyWareId, order.buyQty)
              addRes(reservedDemand, order.sellStationId, order.sellWareId, order.sellQty)

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

  const saveGameAfterAICycle = () => {
    if (process.env.CORP_AUTOPILOT_SAVE_AFTER_STEP === 'false') return
    saveGame()
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
    maybeSnapshotEconomy(Date.now())
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

  const recomputeSectorPrices = () => {
    state.sectorPrices = computeSectorPrices(state.stations, state.recipes, state.wares)
  }

  const sweepWorkOrders = () => {
    const now = Date.now()
    state.workOrders = Array.isArray(state.workOrders) ? state.workOrders : []

    for (const wo of state.workOrders) {
      if (!wo || typeof wo !== 'object') continue
      if (wo.status === 'completed' || wo.status === 'cancelled' || wo.status === 'expired') continue

      const expired = Boolean(wo.expiresAtMs) && Number(wo.expiresAtMs) <= now
      const corp = state.corporations.find(c => c.id === wo.corpId)
      if (expired || !corp) {
        // Expire and refund any remaining escrow.
        if (corp && wo.escrowRemaining > 0) corp.credits += wo.escrowRemaining
        wo.escrowRemaining = 0
        wo.status = expired ? 'expired' : 'cancelled'
        wo.assignedFleetId = null
        continue
      }

      // If assigned fleet vanished, release the order back to open.
      if (wo.status === 'assigned' && wo.assignedFleetId) {
        const f = state.fleets.find(ff => ff.id === wo.assignedFleetId)
        if (!f) {
          wo.assignedFleetId = null
          wo.status = 'open'
        }
      }
    }
  }

  const setStationReorderLevel = (corpId: string, stationId: string, wareId: string, reorderLevel: number) => {
    const st = state.stations.find(s => s.id === stationId)
    if (!st) return { ok: false as const, error: 'station_not_found' }
    if (st.ownerId !== corpId) return { ok: false as const, error: 'station_not_owned_by_corp' }
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) return { ok: false as const, error: 'invalid_reorder_level' }

    st.reorderLevel[wareId] = Math.floor(reorderLevel)
    recomputeSectorPrices()
    return { ok: true as const }
  }

  const setStationReserveLevel = (corpId: string, stationId: string, wareId: string, reserveLevel: number) => {
    const st = state.stations.find(s => s.id === stationId)
    if (!st) return { ok: false as const, error: 'station_not_found' }
    if (st.ownerId !== corpId) return { ok: false as const, error: 'station_not_owned_by_corp' }
    if (!Number.isFinite(reserveLevel) || reserveLevel < 0) return { ok: false as const, error: 'invalid_reserve_level' }

    st.reserveLevel[wareId] = Math.floor(reserveLevel)
    recomputeSectorPrices()
    return { ok: true as const }
  }

  const setCorpGoal = (corpId: string, goal: string) => {
    const corp = state.corporations.find(c => c.id === corpId)
    if (!corp) return { ok: false as const, error: 'corp_not_found' }

    const allowed = new Set(['stabilize', 'expand', 'war', 'consolidate'])
    if (!allowed.has(goal)) return { ok: false as const, error: 'invalid_goal' }

    corp.aiState = corp.aiState || { lastExpansionCheck: 0, currentGoal: 'consolidate', pendingConstructions: [] }
    ;(corp.aiState as any).currentGoal = goal
    return { ok: true as const }
  }

  const assignTradeOrderToFleet = (corpId: string, fleetId: string, buyStationId: string, sellStationId: string, wareId: string, qty: number) => {
    const fleet = state.fleets.find(f => f.id === fleetId)
    if (!fleet) return { ok: false as const, error: 'fleet_not_found' }
    if (fleet.ownerId !== corpId) return { ok: false as const, error: 'fleet_not_owned_by_corp' }

    const buyStation = state.stations.find(s => s.id === buyStationId)
    const sellStation = state.stations.find(s => s.id === sellStationId)
    if (!buyStation || !sellStation) return { ok: false as const, error: 'station_not_found' }

    const ware = state.wares.find(w => w.id === wareId)
    if (!ware) return { ok: false as const, error: 'ware_not_found' }

    const available = Math.max(0, buyStation.inventory[wareId] || 0)
    if (available <= 0) return { ok: false as const, error: 'no_stock_at_buy_station' }

    const maxByCapacity = Math.max(0, Math.floor(fleet.capacity / Math.max(1, ware.volume || 1)))
    const desiredQty = Number.isFinite(qty) ? Math.floor(qty) : 0
    const finalQty = Math.max(1, Math.min(desiredQty || Math.min(available, maxByCapacity), available, maxByCapacity))
    if (finalQty <= 0) return { ok: false as const, error: 'invalid_qty' }

    const now = Date.now()
    const buyPrice = state.sectorPrices[buyStation.sectorId]?.[wareId] ?? ware.basePrice
    const sellPrice = state.sectorPrices[sellStation.sectorId]?.[wareId] ?? ware.basePrice
    const expectedProfit = Math.max(0, (sellPrice - buyPrice) * finalQty)

    const order = {
      id: genId(),
      buyStationId,
      buyStationName: buyStation.name,
      buySectorId: buyStation.sectorId,
      buyWareId: wareId,
      buyWareName: ware.name,
      buyQty: finalQty,
      buyPrice,
      sellStationId,
      sellStationName: sellStation.name,
      sellSectorId: sellStation.sectorId,
      sellWareId: wareId,
      sellWareName: ware.name,
      sellQty: finalQty,
      sellPrice,
      expectedProfit,
      createdAt: now,
    } as any
    order._source = 'llm'

    const issuePathCommands = (fromSectorId: string, toSectorId: string) => {
      const path = findSectorPath(fromSectorId, toSectorId) || []
      for (const nextSector of path) {
        issueCommand(fleet.id, { type: 'goto-gate', targetSectorId: nextSector, source: 'llm' })
        issueCommand(fleet.id, { type: 'use-gate', targetSectorId: nextSector, source: 'llm' })
      }
    }

    fleet.currentOrder = order
    fleet.commandQueue = []

    issuePathCommands(fleet.currentSectorId, buyStation.sectorId)
    issueCommand(fleet.id, { type: 'goto-station', targetStationId: buyStation.id, targetSectorId: buyStation.sectorId, source: 'llm' })
    issueCommand(fleet.id, { type: 'dock', targetStationId: buyStation.id, source: 'llm' })
    issueCommand(fleet.id, { type: 'load-cargo', targetStationId: buyStation.id, wareId, amount: finalQty, source: 'llm' })
    issueCommand(fleet.id, { type: 'undock', targetStationId: buyStation.id, source: 'llm' })

    issuePathCommands(buyStation.sectorId, sellStation.sectorId)
    issueCommand(fleet.id, { type: 'goto-station', targetStationId: sellStation.id, targetSectorId: sellStation.sectorId, source: 'llm' })
    issueCommand(fleet.id, { type: 'dock', targetStationId: sellStation.id, source: 'llm' })
    issueCommand(fleet.id, { type: 'unload-cargo', targetStationId: sellStation.id, wareId, amount: finalQty, source: 'llm' })
    issueCommand(fleet.id, { type: 'undock', targetStationId: sellStation.id, source: 'llm' })

    fleet.state = 'in-transit'
    fleet.stateStartTime = now
    fleet.destinationSectorId = buyStation.sectorId
    fleet.targetStationId = buyStation.id

    return { ok: true as const, order }
  }

  const getCorpControlContext = (corpId: string) => {
    const corp = state.corporations.find(c => c.id === corpId) || null
    const corpName = corp?.name || corpId
    const getOwnerName = (ownerId?: string | null) => {
      if (!ownerId) return null
      const c = state.corporations.find(cc => cc.id === ownerId)
      return c ? c.name : ownerId
    }
    const corpStations = state.stations.filter(s => s.ownerId === corpId).map(s => ({
      id: s.id,
      name: s.name,
      sectorId: s.sectorId,
      recipeId: s.recipeId,
      ownerId: s.ownerId || null,
      isOwnedByCorp: true,
      inventory: s.inventory,
      reorderLevel: s.reorderLevel,
      reserveLevel: s.reserveLevel,
    }))
    const corpFleets = state.fleets.filter(f => f.ownerId === corpId).map(f => ({
      id: f.id,
      name: f.name,
      shipType: f.shipType,
      capacity: f.capacity,
      currentSectorId: f.currentSectorId,
      behavior: f.behavior,
      state: f.state,
      cargo: f.cargo,
      credits: f.credits,
      currentOrder: f.currentOrder || null,
      currentOrderMeta: (() => {
        const o: any = f.currentOrder
        if (!o) return null
        const buyStation = state.stations.find(s => s.id === o.buyStationId)
        const sellStation = state.stations.find(s => s.id === o.sellStationId)
        const buyOwnerId = buyStation?.ownerId || null
        const sellOwnerId = sellStation?.ownerId || null
        const isInternalTransfer = Boolean(buyOwnerId) && buyOwnerId === corpId && Boolean(sellOwnerId) && sellOwnerId === corpId
        const kind =
          isInternalTransfer ? 'internal_transfer'
            : (sellOwnerId === corpId ? 'import_to_corp'
              : (buyOwnerId === corpId ? 'export_from_corp'
                : 'external_trade'))
        const creditNote =
          isInternalTransfer
            ? 'Internal stock movement: no credit profit is recorded (0 profit expected).'
            : 'External trade: credits can change when selling to non-corp owners.'
        return {
          buyStationId: o.buyStationId,
          sellStationId: o.sellStationId,
          buyStationName: buyStation?.name || o.buyStationName || null,
          sellStationName: sellStation?.name || o.sellStationName || null,
          buySectorId: buyStation?.sectorId || o.buySectorId || null,
          sellSectorId: sellStation?.sectorId || o.sellSectorId || null,
          buyOwnerId,
          sellOwnerId,
          buyOwnerName: getOwnerName(buyOwnerId),
          sellOwnerName: getOwnerName(sellOwnerId),
          kind,
          isInternalTransfer,
          creditNote,
        }
      })(),
    }))
    const wares = state.wares.map(w => ({ id: w.id, name: w.name, basePrice: w.basePrice, volume: w.volume }))
    const workOrders = (Array.isArray(state.workOrders) ? state.workOrders : [])
      .filter(w => w && w.corpId === corpId)
      .slice(0, 25)
      .map(w => ({
        id: w.id,
        status: w.status,
        title: w.title,
        wareId: w.wareId,
        qtyRemaining: w.qtyRemaining,
        bonusPerUnit: w.bonusPerUnit,
        escrowRemaining: w.escrowRemaining,
        buyStationId: w.buyStationId,
        sellStationId: w.sellStationId,
        assignedFleetId: w.assignedFleetId || null,
        expiresAtMs: w.expiresAtMs || null,
      }))
    return {
      corp,
      wares,
      stations: corpStations,
      fleets: corpFleets,
      sectorPrices: state.sectorPrices,
      corpStationIds: corpStations.map(s => s.id),
      workOrders,
      tradeAccounting: {
        corpId,
        corpName,
        notes: [
          'Corp-owned stations are listed in stations[] and corpStationIds[].',
          'Trades where BOTH buy and sell stations are corp-owned are internal transfers: they DO NOT generate credit profit and will show 0 profit.',
          'External trades (selling to a station not owned by the corp) can generate credit profit for the corp.',
        ],
      },
    }
  }

  const getCorpAutopilotContext = (corpId: string) => {
    const base = getCorpControlContext(corpId)
    if (!base.corp) return base

    const llmPlan = (base.corp as any)?.aiState?.llmPlan || null

    const relevantWareIds = new Set<string>()
    for (const st of base.stations) {
      for (const k of Object.keys(st.inventory || {})) relevantWareIds.add(k)
      for (const k of Object.keys(st.reorderLevel || {})) relevantWareIds.add(k)
      for (const k of Object.keys(st.reserveLevel || {})) relevantWareIds.add(k)
    }

    const waresById = new Map(state.wares.map(w => [w.id, w]))
    const relevantWares = Array.from(relevantWareIds)
      .filter(id => waresById.has(id))
      .slice(0, 30)
      .map(id => {
        const w = waresById.get(id)!
        return { id: w.id, name: w.name, basePrice: w.basePrice, volume: w.volume }
      })

    const marketStations = state.stations.slice(0, 400).map(st => {
      const inv: Record<string, number> = {}
      for (const w of relevantWares) {
        const q = st.inventory?.[w.id] || 0
        if (q > 0) inv[w.id] = q
      }
      return {
        id: st.id,
        name: st.name,
        sectorId: st.sectorId,
        ownerId: st.ownerId || null,
        isOwnedByCorp: st.ownerId === corpId,
        recipeId: st.recipeId,
        inventory: inv,
      }
    })

    const shipCatalog = Object.entries(SHIP_CATALOG)
      .slice(0, 12)
      .map(([id, info]) => ({
        id,
        wareId: `ship_${id}`,
        name: info.name,
        cost: info.cost,
        capacity: info.capacity,
        speed: info.speed,
      }))

    const buildableByCapability = (cap: string) => String(cap || '').startsWith('build_')
    const shipyards = state.stations
      .filter(st => Array.isArray(st.capabilities) && st.capabilities.some(buildableByCapability))
      .slice(0, 60)
      .map(st => {
        const available: any[] = []
        for (const cap of Array.isArray(st.capabilities) ? st.capabilities : []) {
          if (!buildableByCapability(cap)) continue
          const shipKey = cap.replace('build_', '')
          const wareId = `ship_${shipKey}`
          const stock = Number(st.inventory?.[wareId] || 0)
          const price = Number(state.sectorPrices?.[st.sectorId]?.[wareId] || (SHIP_CATALOG as any)?.[shipKey]?.cost || 0)
          if (stock > 0) available.push({ wareId, stock, price })
        }
        return {
          id: st.id,
          name: st.name,
          sectorId: st.sectorId,
          ownerId: st.ownerId || null,
          capabilities: st.capabilities,
          availableShips: available,
        }
      })

    return {
      ...base,
      now: { ingameTimeSec: state.elapsedTimeSec, timeScale: state.timeScale, llmExclusive: isLLMExclusiveCorp(corpId) },
      llmPlan,
      relevantWares,
      marketStations,
      shipCatalog,
      shipyards,
      recentTrades: state.tradeLog.slice(0, 80),
    }
  }

  const sanitizeShortText = (s: any, maxLen: number) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim()
    if (!t) return ''
    return t.length > maxLen ? t.slice(0, maxLen) : t
  }

  const ensureCorpLLMPlan = (corpId: string) => {
    const corp: any = state.corporations.find((c: any) => c.id === corpId)
    if (!corp) return null
    corp.aiState = corp.aiState || { lastExpansionCheck: Date.now(), currentGoal: 'consolidate', pendingConstructions: [] }
    corp.aiState.llmPlan = corp.aiState.llmPlan || {
      strategy: '',
      todos: [] as any[],
      lastOutcomes: [] as any[],
      updatedAt: Date.now(),
    }
    return corp.aiState.llmPlan as any
  }

  const updateCorpLLMPlan = (corpId: string, patch: any) => {
    const plan = ensureCorpLLMPlan(corpId)
    if (!plan) return { ok: false as const, error: 'corp_not_found' }

    if (typeof patch?.strategy === 'string') {
      plan.strategy = sanitizeShortText(patch.strategy, 280)
    }

    if (Array.isArray(patch?.todos)) {
      const existing = new Map<string, any>()
      for (const t of Array.isArray(plan.todos) ? plan.todos : []) {
        if (t && typeof t.id === 'string' && t.id) existing.set(String(t.id), t)
      }

      const out: any[] = []
      const maxTodos = 20
      for (const raw of patch.todos.slice(0, maxTodos)) {
        const id = sanitizeShortText(raw?.id || raw?.title || '', 64) || genId()
        const title = sanitizeShortText(raw?.title, 120)
        if (!title) continue
        const statusRaw = String(raw?.status || 'open').toLowerCase()
        const status = statusRaw === 'done' || statusRaw === 'doing' || statusRaw === 'blocked' ? statusRaw : 'open'
        const notes = sanitizeShortText(raw?.notes, 220)
        const prev = existing.get(id) || null
        out.push({
          id,
          title,
          status,
          notes,
          createdAt: typeof prev?.createdAt === 'number' ? prev.createdAt : Date.now(),
          updatedAt: Date.now(),
        })
      }
      plan.todos = out
    }

    plan.lastOutcomes = Array.isArray(plan.lastOutcomes) ? plan.lastOutcomes : []
    plan.updatedAt = Date.now()
    return { ok: true as const, plan }
  }

  const getSectorRoute = (fromSectorId: string, toSectorId: string) => {
    const from = String(fromSectorId || '')
    const to = String(toSectorId || '')
    if (!from || !to) return { ok: false as const, error: 'missing_ids' }
    const path = findSectorPath(from, to)
    if (!path) return { ok: false as const, error: 'no_path' }
    const hops = path.length
    const etaSec = hops * FLEET_CONSTANTS.BASE_JUMP_TIME
    return { ok: true as const, fromSectorId: from, toSectorId: to, hops, etaSec, path }
  }

  const estimateTradeEta = (fleetId: string, buyStationId: string, sellStationId: string, qty: number) => {
    const fleet = state.fleets.find(f => f.id === fleetId)
    const buyStation = state.stations.find(s => s.id === buyStationId)
    const sellStation = state.stations.find(s => s.id === sellStationId)
    if (!fleet) return { ok: false as const, error: 'fleet_not_found' }
    if (!buyStation) return { ok: false as const, error: 'buy_station_not_found' }
    if (!sellStation) return { ok: false as const, error: 'sell_station_not_found' }

    const qtyN = Math.max(0, Math.floor(Number(qty) || 0))
    const routeToBuy = getSectorRoute(fleet.currentSectorId, buyStation.sectorId)
    const routeToSell = getSectorRoute(buyStation.sectorId, sellStation.sectorId)
    if (!routeToBuy.ok) return { ok: false as const, error: 'no_path_to_buy' }
    if (!routeToSell.ok) return { ok: false as const, error: 'no_path_to_sell' }

    const transferTicks = Math.max(1, Math.ceil(qtyN / 1000))
    const transferSec = transferTicks * FLEET_CONSTANTS.TRANSFER_TIME_PER_1000
    const dockUndockPerStopSec = FLEET_CONSTANTS.DOCK_TIME * 2

    const travelSec = routeToBuy.etaSec + routeToSell.etaSec
    const handlingSec = dockUndockPerStopSec * 2 + transferSec * 2
    const etaSec = travelSec + handlingSec

    return {
      ok: true as const,
      fleetId,
      buyStationId,
      sellStationId,
      qty: qtyN,
      hops: routeToBuy.hops + routeToSell.hops,
      etaSec,
      breakdown: {
        travelSec,
        dockUndockSec: dockUndockPerStopSec * 2,
        transferSec: transferSec * 2,
        routeToBuy,
        routeToSell,
      },
    }
  }

  const buyVultureTraderForCorp = (corpId: string) => {
    const now = Date.now()
    const corp = state.corporations.find(c => c.id === corpId)
    if (!corp) return { ok: false as const, error: 'corp_not_found' }

    const shipyards = state.stations.filter(st => st.capabilities && st.capabilities.includes('build_vulture'))
    let chosenShipyard: Station | null = null
    let price: number = SHIP_CATALOG.vulture.cost

    for (const yard of shipyards) {
      const stock = yard.inventory['ship_vulture'] || 0
      if (stock < 1) continue
      const p = state.sectorPrices[yard.sectorId]?.['ship_vulture'] || SHIP_CATALOG.vulture.cost
      if (corp.credits >= p) {
        chosenShipyard = yard
        price = p
        break
      }
    }

    if (!chosenShipyard) return { ok: false as const, error: 'no_shipyard_with_stock_or_insufficient_credits' }

    chosenShipyard.inventory['ship_vulture'] = Math.max(0, (chosenShipyard.inventory['ship_vulture'] || 0) - 1)
    corp.credits -= price

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
      position: chosenShipyard.position || [0, 0, 0],
      state: 'undocking',
      stateStartTime: now,
      lastReportAt: now,
      cargo: {},
      credits: 10000,
      commandQueue: [{
        id: genId(),
        type: 'undock',
        targetStationId: chosenShipyard.id,
        createdAt: now
      }],
      totalProfit: 0,
      tripsCompleted: 0
    }

    state.fleets.push(newFleet)
    corp.fleetIds.push(newFleet.id)

    return { ok: true as const, fleetId: newFleet.id, price, shipyardId: chosenShipyard.id }
  }

  const queueStationConstruction = (corpId: string, stationType: string, targetSectorId: string) => {
    const now = Date.now()
    const corp = state.corporations.find(c => c.id === corpId)
    if (!corp) return { ok: false as const, error: 'corp_not_found' }

    const rawType = String(stationType || '').trim()
    if (!rawType) return { ok: false as const, error: 'unknown_station_type' }

    const resolveRecipeIdFromBlueprintKey = (blueprintKey: string) => {
      if (blueprintKey === 'spp_cycle') return 'spp_teladi'
      if (blueprintKey === 'spp_argon' || blueprintKey === 'spp_split' || blueprintKey === 'spp_paranid' || blueprintKey === 'spp_boron') return 'spp_teladi'
      if (blueprintKey === 'mine_silicon') return 'silicon_mine'
      if (blueprintKey === 'mine_ore') return 'ore_mine'
      if (blueprintKey === 'equipment_dock') return 'logistics_hub'
      if (blueprintKey === 'trading_station') return 'logistics_hub'
      if (blueprintKey === 'xenon_power') return 'spp_teladi'
      return blueprintKey
    }

    const preferredBlueprintForRecipe: Record<string, string> = {
      logistics_hub: 'trading_station',
      spp_teladi: 'spp_cycle',
      ore_mine: 'mine_ore',
      silicon_mine: 'mine_silicon',
    }

    // Accept blueprint key, blueprint id, or the resulting recipe id (common in STATE_JSON).
    let blueprintKey = preferredBlueprintForRecipe[rawType] || rawType
    let blueprint = STATION_BLUEPRINTS[blueprintKey]

    if (!blueprint) {
      const matchByBlueprintId = Object.entries(STATION_BLUEPRINTS).find(([, bp]) => String((bp as any)?.id || '') === rawType)
      if (matchByBlueprintId) {
        blueprintKey = matchByBlueprintId[0]
        blueprint = matchByBlueprintId[1]
      }
    }

    if (!blueprint) {
      const matchByRecipeId = Object.keys(STATION_BLUEPRINTS).find((key) => resolveRecipeIdFromBlueprintKey(key) === rawType)
      if (matchByRecipeId) {
        blueprintKey = matchByRecipeId
        blueprint = STATION_BLUEPRINTS[blueprintKey]
      }
    }
    if (!blueprint) return { ok: false as const, error: 'unknown_station_type' }
    if (!SECTOR_GRAPH[targetSectorId]) return { ok: false as const, error: 'unknown_target_sector' }

    corp.aiState = corp.aiState || { lastExpansionCheck: now, currentGoal: 'consolidate', pendingConstructions: [] }
    corp.aiState.pendingConstructions.push({
      id: genId(),
      stationType: blueprintKey,
      targetSectorId,
      status: 'planning',
      createdAt: now,
      source: 'llm',
    })
    return { ok: true as const }
  }

  const postWorkOrder = (corpId: string, args: any) => {
    const now = Date.now()
    const corp = state.corporations.find(c => c.id === corpId)
    if (!corp) return { ok: false as const, error: 'corp_not_found' }

    const wareId = String(args?.wareId || '').trim()
    const qty = Math.floor(Number(args?.qty || 0))
    const buyStationId = String(args?.buyStationId || '').trim()
    const sellStationId = String(args?.sellStationId || '').trim()
    const bonusPerUnit = Number(args?.bonusPerUnit || 0)
    const expiresInSec = Number(args?.expiresInSec || 0)
    const title = String(args?.title || `${wareId} delivery`).trim()

    if (!wareId || !state.wares.some(w => w.id === wareId)) return { ok: false as const, error: 'unknown_ware' }
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false as const, error: 'invalid_qty' }
    if (!Number.isFinite(bonusPerUnit) || bonusPerUnit <= 0) return { ok: false as const, error: 'invalid_bonus' }
    const buyStation = state.stations.find(s => s.id === buyStationId)
    const sellStation = state.stations.find(s => s.id === sellStationId)
    if (!buyStation) return { ok: false as const, error: 'buy_station_not_found' }
    if (!sellStation) return { ok: false as const, error: 'sell_station_not_found' }
    if (sellStation.ownerId !== corpId) return { ok: false as const, error: 'sell_station_not_owned_by_corp' }

    const escrow = Math.floor(qty * bonusPerUnit)
    if (corp.credits < escrow) return { ok: false as const, error: 'insufficient_credits_for_escrow' }
    corp.credits -= escrow

    const wo: WorkOrder = {
      id: `wo_${genId()}`,
      corpId,
      title: title || `${wareId} delivery`,
      wareId,
      qtyTotal: qty,
      qtyRemaining: qty,
      buyStationId,
      sellStationId,
      bonusPerUnit,
      escrowRemaining: escrow,
      status: 'open',
      assignedFleetId: null,
      createdAtMs: now,
      expiresAtMs: Number.isFinite(expiresInSec) && expiresInSec > 0 ? now + Math.floor(expiresInSec * 1000) : null,
    }
    state.workOrders = Array.isArray(state.workOrders) ? state.workOrders : []
    state.workOrders.unshift(wo)
    if (state.workOrders.length > 200) state.workOrders.length = 200

    pushCorpLog(corpId, 'actions', {
      type: 'post_work_order',
      workOrderId: wo.id,
      title: wo.title,
      wareId,
      qty,
      bonusPerUnit,
      escrow,
      buyStationId,
      sellStationId,
    })

    return { ok: true as const, workOrderId: wo.id, escrow }
  }

  const buildTools = () => ([
    {
      type: 'function',
      function: {
        name: 'update_llm_plan',
        description: 'Update the long-horizon strategy + TODO list for this corp controller. This does not execute an in-world order.',
        parameters: {
          type: 'object',
          properties: {
            strategy: { type: 'string' },
            todos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  status: { type: 'string', description: 'open|doing|blocked|done' },
                  notes: { type: 'string' },
                },
                required: ['title'],
              },
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_sector_route',
        description: 'Query the sector route (gate hops) and ETA between two sectors. Read-only; use before assigning long trades.',
        parameters: {
          type: 'object',
          properties: {
            fromSectorId: { type: 'string' },
            toSectorId: { type: 'string' },
          },
          required: ['fromSectorId', 'toSectorId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_trade_eta',
        description: 'Estimate total time (seconds) for a specific fleet to buy at one station then sell at another. Read-only.',
        parameters: {
          type: 'object',
          properties: {
            fleetId: { type: 'string' },
            buyStationId: { type: 'string' },
            sellStationId: { type: 'string' },
            qty: { type: 'number' },
          },
          required: ['fleetId', 'buyStationId', 'sellStationId', 'qty'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_station_reorder_level',
        description: 'Set station reorder level (input demand threshold) for a ware at a corp-owned station.',
        parameters: {
          type: 'object',
          properties: {
            stationId: { type: 'string' },
            wareId: { type: 'string' },
            reorderLevel: { type: 'number' },
          },
          required: ['stationId', 'wareId', 'reorderLevel'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_station_reserve_level',
        description: 'Set station reserve level (product stock target) for a ware at a corp-owned station.',
        parameters: {
          type: 'object',
          properties: {
            stationId: { type: 'string' },
            wareId: { type: 'string' },
            reserveLevel: { type: 'number' },
          },
          required: ['stationId', 'wareId', 'reserveLevel'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'assign_trade',
        description: 'Assign a specific trade run to a corp-owned fleet: buy ware at buyStation then sell at sellStation.',
        parameters: {
          type: 'object',
          properties: {
            fleetId: { type: 'string' },
            buyStationId: { type: 'string' },
            sellStationId: { type: 'string' },
            wareId: { type: 'string' },
            qty: { type: 'number' },
          },
          required: ['fleetId', 'buyStationId', 'sellStationId', 'wareId', 'qty'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'set_corp_goal',
        description: "Set the corp AI goal. Allowed: stabilize, expand, war, consolidate.",
        parameters: {
          type: 'object',
          properties: { goal: { type: 'string' } },
          required: ['goal'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_trader_vulture',
        description: 'Buy a Vulture trader for the corp from any shipyard that has stock; spawns fleet and deducts credits.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'queue_station_construction',
        description: 'Queue construction of a new station type in a sector (corp AI will hire TL and deploy when funded).',
        parameters: {
          type: 'object',
          properties: {
            stationType: { type: 'string' },
            targetSectorId: { type: 'string' },
          },
          required: ['stationType', 'targetSectorId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'post_work_order',
        description: 'Post a paid work order (contract) that independent traders can fulfill; corp escrows the bonus and pays it on delivery to the destination station.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short title shown to traders.' },
            wareId: { type: 'string' },
            qty: { type: 'number' },
            buyStationId: { type: 'string', description: 'Where the contractor should buy the ware.' },
            sellStationId: { type: 'string', description: 'Where the contractor should deliver the ware.' },
            bonusPerUnit: { type: 'number', description: 'Extra payment per unit delivered (in addition to normal station trade).' },
            expiresInSec: { type: 'number', description: 'Optional expiry window in seconds.' },
          },
          required: ['wareId', 'qty', 'buyStationId', 'sellStationId', 'bonusPerUnit'],
        },
      },
    },
  ])

  const runCorpControllerStep = async (opts: {
    corpId: string
    reason: string
    messages?: { role: 'user' | 'assistant'; content: string }[]
  }) => {
    const corpId = opts.corpId
    const key = process.env.OPENROUTER_API_KEY
    const shieldworksModel =
      corpId === 'teladi_shieldworks'
        ? (process.env.OPENROUTER_MODEL_SHIELDWORKS || process.env.OPENROUTER_MODEL_2)
        : undefined
    const model = (shieldworksModel && shieldworksModel.trim())
      ? shieldworksModel.trim()
      : (process.env.OPENROUTER_MODEL || 'mistralai/devstral-2512:free')
    if (!key) return { ok: false as const, error: 'missing_openrouter_key' }

    const contextBase = getCorpAutopilotContext(corpId)
    if (!contextBase.corp) return { ok: false as const, error: 'corp_not_found' }

    // Lightweight estimate (chars/4) for reporting only; avoids pulling in a tokenizer dependency.
    const contextForLog: any = { ...contextBase, _meta: { contextChars: 0, contextTokensEstimated: 0 } }
    let contextJson = JSON.stringify(contextForLog)
    contextForLog._meta.contextChars = contextJson.length
    contextForLog._meta.contextTokensEstimated = Math.max(1, Math.ceil(contextForLog._meta.contextChars / 4))
    contextJson = JSON.stringify(contextForLog)

    pushCorpLog(corpId, 'context', contextForLog)
    pushCorpLog(
      corpId,
      'decision',
      `STATUS: running LLM (${model}); context ≈ ${Number(contextForLog._meta.contextTokensEstimated).toLocaleString()} tokens (${Number(contextForLog._meta.contextChars).toLocaleString()} chars)…`,
    )

    const maxWorldActionsPerStep = Math.max(0, Number(process.env.CORP_AUTOPILOT_MAX_ACTIONS_PER_STEP || '1') || 1)

    const corpFocus =
      corpId === 'teladi_shieldworks'
        ? [
            'SPECIALIZATION: You run Teladi Shieldworks. Your job is to expand and operate shield manufacturing.',
            'Prioritize building Shield Component Factories and Shield Plants (1MW/25MW/5MW/125MW where available) and keep them supplied.',
            'When calling queue_station_construction, you may use either the blueprint key or the recipe id. Example: stationType=factory_shield_components (or shield_component_factory).',
            'Primary customers are Shipyards and Equipment Docks; sell finished shields externally for profit.',
            'Use `shipyards` in STATE_JSON to see ship stock and prices; ensure shield component supply supports ship production demand.',
          ].join('\n')
        : ''

    const system = [
      'You are an Taladi, your goal is profitssss.',
      'You receive current world state as JSON and may take actions using tools.',
      'Do not ask questions; decide whether to act now.',
      'Maintain a short long-horizon strategy and TODO list; update it with update_llm_plan when it changes.',
      'If you call update_llm_plan, immediately attempt the highest-priority TODO using in-world tools in the same step (unless impossible, then reply DONE).',
      'If your corp lacks enough traders to keep stations supplied, use post_work_order to pay independent traders a bonus for delivering needed wares to your stations.',
      'When you need travel time or distance, call get_sector_route / get_trade_eta first. After receiving results, decide actions in a later pass.',
      'After you receive route/ETA tool results, you must either take an in-world action (e.g., assign_trade) or reply DONE.',
      'IMPORTANT: Internal transfers between two corp-owned stations do not generate credit profit; only do them to balance stock. Prefer external trades for profit.',
      'If acting and you have multiple idle corp-logistics fleets, assign multiple trades in priority order until you reach the action limit.',
      `IMPORTANT: You may execute at most ${maxWorldActionsPerStep} in-world order(s) in this step.`,
      'Never invent IDs; only use IDs from the provided JSON.',
      'Write a short DECISION + RATIONALE summary. Do not reveal chain-of-thought.',
      ...(corpFocus ? [corpFocus] : []),
    ].join('\\n')

    const tools = buildTools()

    const sanitizedMessages = (opts.messages || [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)

    const userKick = sanitizedMessages.length > 0 ? null : { role: 'user', content: `Scheduled step: ${opts.reason}. Decide what to do (or do nothing).` }

    const callOpenRouter = async (messages: any[], opts?: { streamPass?: number }) => {
      const allowFallbacksBase = process.env.OPENROUTER_ALLOW_FALLBACKS !== 'false'
      const allowFallbacks =
        corpId === 'teladi_shieldworks'
          ? (process.env.OPENROUTER_ALLOW_FALLBACKS_SHIELDWORKS === 'true')
          : allowFallbacksBase
      const streamEnabled = process.env.CORP_AUTOPILOT_STREAM_DECISION === 'true'
      const streamThis = streamEnabled && typeof opts?.streamPass === 'number' && opts.streamPass > 0
      const openrouterBody = {
        model,
        provider: { allow_fallbacks: allowFallbacks },
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        stream: streamThis,
      }

      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
          'x-title': process.env.OPENROUTER_APP_NAME || 'xbtf-rtx',
          'http-referer': process.env.OPENROUTER_SITE_URL || 'http://localhost',
          ...(streamThis ? { accept: 'text/event-stream' } : {}),
        },
        body: JSON.stringify(openrouterBody),
      })

      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        throw new Error(`openrouter_http_${r.status}${txt ? `: ${txt.slice(0, 300)}` : ''}`)
      }

      if (!streamThis) {
        const data: any = await r.json().catch(() => ({} as any))
        const msg = data?.choices?.[0]?.message || {}
        const usedModel = typeof data?.model === 'string' ? data.model : model
        if (usedModel && usedModel !== model) {
          pushCorpLog(corpId, 'decision', `INFO: OpenRouter routed model=${usedModel} (requested ${model})`)
          if (!allowFallbacks) throw new Error(`openrouter_model_mismatch:${usedModel}`)
        }
        return {
          assistantMessage: typeof msg?.content === 'string' ? msg.content : '',
          toolCalls: Array.isArray(msg?.tool_calls) ? msg.tool_calls : [],
          usedModel,
        }
      }

      const contentType = String(r.headers.get('content-type') || '')
      if (!contentType.toLowerCase().includes('text/event-stream')) {
        // Some providers/models ignore `stream: true` and return a normal JSON response.
        const data: any = await r.json().catch(() => ({} as any))
        const msg = data?.choices?.[0]?.message || {}
        const usedModel = typeof data?.model === 'string' ? data.model : model
        if (usedModel && usedModel !== model) {
          pushCorpLog(corpId, 'decision', `INFO: OpenRouter routed model=${usedModel} (requested ${model})`)
          if (!allowFallbacks) throw new Error(`openrouter_model_mismatch:${usedModel}`)
        }
        const assistantMessage = typeof msg?.content === 'string' ? msg.content : ''
        setCorpLive(corpId, { status: 'running', pass: Number(opts?.streamPass || 0), text: assistantMessage })
        return {
          assistantMessage,
          toolCalls: Array.isArray(msg?.tool_calls) ? msg.tool_calls : [],
          usedModel,
        }
      }

      // Streaming: accumulate deltas (content + tool_calls) while updating a live buffer for the UI.
      const reader = r.body?.getReader()
      if (!reader) throw new Error('stream_no_body')
      const decoder = new TextDecoder()

      let buffer = ''
      let assistantMessage = ''
      const toolCallsByIndex: any[] = []
      let usedModel = model
      let lastLivePush = 0

      const pushLive = (force?: boolean) => {
        const now = Date.now()
        if (!force && now - lastLivePush < 150) return
        lastLivePush = now
        setCorpLive(corpId, { status: 'running', pass: Number(opts?.streamPass || 0), text: assistantMessage })
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const lines = part.split('\n').map(l => l.trim()).filter(Boolean)
          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const payload = line.slice('data:'.length).trim()
            if (!payload) continue
            if (payload === '[DONE]') {
              pushLive(true)
              continue
            }
            let json: any = null
            try { json = JSON.parse(payload) } catch { json = null }
            if (!json) continue

            if (typeof json?.model === 'string') usedModel = json.model
            const delta = json?.choices?.[0]?.delta || {}
            if (typeof delta?.content === 'string') {
              assistantMessage += delta.content
              pushLive()
            }
            const deltaToolCalls = Array.isArray(delta?.tool_calls) ? delta.tool_calls : []
            for (const tc of deltaToolCalls) {
              const idx = Number(tc?.index)
              if (!Number.isFinite(idx) || idx < 0) continue
              toolCallsByIndex[idx] = toolCallsByIndex[idx] || { id: tc?.id || genId(), type: 'function', function: { name: '', arguments: '' } }
              if (tc?.id) toolCallsByIndex[idx].id = tc.id
              const fn = tc?.function || {}
              if (typeof fn?.name === 'string') toolCallsByIndex[idx].function.name = fn.name
              if (typeof fn?.arguments === 'string') toolCallsByIndex[idx].function.arguments += fn.arguments
            }
          }
        }
      }

      const toolCalls = toolCallsByIndex.filter(Boolean)
      setCorpLive(corpId, { status: 'done', pass: Number(opts?.streamPass || 0), text: assistantMessage })
      if (usedModel && usedModel !== model) {
        pushCorpLog(corpId, 'decision', `INFO: OpenRouter routed model=${usedModel} (requested ${model})`)
        if (!allowFallbacks) throw new Error(`openrouter_model_mismatch:${usedModel}`)
      }
      return { assistantMessage, toolCalls, usedModel }
    }

    const parseInlineToolCalls = (text: string) => {
      const out: any[] = []
      const allowed = new Set([
        'update_llm_plan',
        'get_sector_route',
        'get_trade_eta',
        'set_station_reorder_level',
        'set_station_reserve_level',
        'assign_trade',
        'set_corp_goal',
        'buy_trader_vulture',
        'queue_station_construction',
        'post_work_order',
      ])

      const lines = String(text || '').split(/\r?\n/)
      let pendingName: string | null = null

      const add = (name: string, rawArgs: string) => {
        if (!allowed.has(name)) return
        const trimmed = (rawArgs || '').trim()
        // Light validation: must parse as JSON object.
        try {
          const parsed = JSON.parse(trimmed || '{}')
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
        } catch {
          return
        }
        out.push({ id: genId(), type: 'function', function: { name, arguments: trimmed } })
      }

      for (const rawLine of lines) {
        const line = String(rawLine || '').trim()
        if (!line) continue

        // Match "toolName{...}" or "toolName {...}" on one line.
        const oneLine = line.match(/^([a-z_]+)\s*(\{.*\})\s*$/i)
        if (oneLine) {
          const name = String(oneLine[1] || '')
          const rawArgs = String(oneLine[2] || '')
          add(name, rawArgs)
          pendingName = null
          continue
        }

        // Match "some text ... toolName{...}" embedded in a line.
        if (line.includes('{') && line.includes('}')) {
          for (const name of allowed) {
            const idx = line.toLowerCase().indexOf(name)
            if (idx < 0) continue
            const braceStart = line.indexOf('{', idx + name.length)
            const braceEnd = line.lastIndexOf('}')
            if (braceStart < 0 || braceEnd <= braceStart) continue
            const rawArgs = line.slice(braceStart, braceEnd + 1)
            add(name, rawArgs)
          }
          pendingName = null
        }

        // Match "toolName" on its own line, JSON on next line.
        if (allowed.has(line)) {
          pendingName = line
          continue
        }
        if (pendingName && line.startsWith('{') && line.endsWith('}')) {
          add(pendingName, line)
          pendingName = null
          continue
        }
        pendingName = null
      }

      return out
    }

    const looksLikeIntent = (s: string) => {
      const t = (s || '').toLowerCase()
      return (
        t.includes('i will') ||
        t.includes("i'll") ||
        t.includes('assign') ||
        t.includes('queue') ||
        t.includes('buy ') ||
        t.includes('set ') ||
        t.includes('order ') ||
        // Models sometimes "write" tool calls as text instead of emitting tool_calls.
        t.includes('get_sector_route') ||
        t.includes('get_trade_eta')
      )
    }

    let maxPasses = Math.max(1, Number(process.env.CORP_AUTOPILOT_MAX_PASSES || '3') || 3)
    const maxExtraPasses = Math.max(0, Number(process.env.CORP_AUTOPILOT_MAX_EXTRA_PASSES || '4') || 4)
    const maxPassesHard = maxPasses + maxExtraPasses
    const maxQueryRounds = Math.max(1, Number(process.env.CORP_AUTOPILOT_MAX_QUERY_ROUNDS || '2') || 2)
    const conversation: any[] = [
      { role: 'system', content: system },
      { role: 'system', content: `STATE_JSON=${contextJson}` },
      ...(userKick ? [userKick] : []),
      ...sanitizedMessages,
    ]

    let assistantMessage = ''
    let finalToolCalls: any[] = []
    let toolExecutionNudges = 0
    const maxToolExecutionNudges = 2
    let queryRounds = 0

    let followupsGranted = 0
    setCorpLive(corpId, { status: 'running', startedAtMs: Date.now(), pass: 0, text: '' })
    for (let pass = 1; pass <= maxPasses; pass++) {
      setCorpLive(corpId, { status: 'running', pass, text: '' })
      let resp: any
      try {
        resp = await callOpenRouter(conversation, { streamPass: pass })
      } catch (e: any) {
        setCorpLive(corpId, { status: 'error', pass, error: e?.message || 'llm_stream_error' })
        throw e
      }
      assistantMessage = resp.assistantMessage || ''
      let toolCalls = Array.isArray(resp.toolCalls) ? resp.toolCalls : []
      if (toolCalls.length === 0 && assistantMessage) {
        const parsed = parseInlineToolCalls(assistantMessage)
        if (parsed.length > 0) {
          toolCalls = parsed
          pushCorpLog(corpId, 'decision', `INFO: recovered ${parsed.length} tool call(s) from plain text.`)
        }
      }
      // Ensure every tool call has a stable id so tool output can reference it.
      for (const tc of toolCalls) {
        if (!tc || typeof tc !== 'object') continue
        if (!tc.id) tc.id = genId()
      }
      // Ensure the live buffer reflects the final text even when streaming is disabled.
      setCorpLive(corpId, { status: 'running', pass, text: assistantMessage })

      if (resp.usedModel && resp.usedModel !== model) {
        pushCorpLog(corpId, 'decision', `INFO: OpenRouter routed model=${resp.usedModel} (requested ${model})`)
      }

      const assistantMsg: any = { role: 'assistant', content: assistantMessage }
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls
      conversation.push(assistantMsg)

      if (assistantMessage) {
        pushCorpLog(corpId, 'decision', pass === 1 ? assistantMessage : `PASS ${pass}/${maxPasses}:\n${assistantMessage}`)
      }

      // If the model wrote an intent but didn't call tools, add a nudge and try another pass.
      if (toolExecutionNudges < maxToolExecutionNudges && toolCalls.length === 0 && assistantMessage && looksLikeIntent(assistantMessage)) {
        toolExecutionNudges++
        conversation.push({
          role: 'user',
          content:
            'Implement the decision now by calling tools. You may call assign_trade / set_station_reorder_level / set_station_reserve_level / buy_trader_vulture / queue_station_construction / set_corp_goal / update_llm_plan. Do NOT call get_sector_route/get_trade_eta again in this step. If no action is possible, reply DONE.',
        })
        // Ensure we always leave room for a follow-up pass.
        if (pass === maxPasses && maxPasses < maxPassesHard) {
          maxPasses++
          followupsGranted++
          pushCorpLog(corpId, 'decision', `INFO: extending pass budget (${followupsGranted}/${maxExtraPasses}) to allow tool execution.`)
        }
        continue
      }

      const nonWorldToolNames = new Set(['update_llm_plan', 'get_sector_route', 'get_trade_eta'])
      const hasPlanUpdate = toolCalls.some((c: any) => String(c?.function?.name || '') === 'update_llm_plan')

      const queryCalls = toolCalls.filter((c: any) => {
        const name = String(c?.function?.name || '')
        return name === 'get_sector_route' || name === 'get_trade_eta'
      })

      // If the model only updated a plan (no in-world action tools), nudge it to execute the first TODO immediately.
      if (queryCalls.length === 0 && hasPlanUpdate) {
        const worldCalls = toolCalls.filter((c: any) => !nonWorldToolNames.has(String(c?.function?.name || '')))
        if (worldCalls.length === 0 && toolExecutionNudges < maxToolExecutionNudges) {
          toolExecutionNudges++
          conversation.push({
            role: 'user',
            content:
              'You updated the plan. Now execute the highest-priority TODO immediately using in-world tools (assign_trade / set_station_reorder_level / set_station_reserve_level / buy_trader_vulture / queue_station_construction / set_corp_goal). Do NOT call get_sector_route/get_trade_eta again this step. If it is impossible right now (e.g., no idle fleets / no valid trade), reply DONE.',
          })
          if (pass === maxPasses && maxPasses < maxPassesHard) {
            maxPasses++
            followupsGranted++
            pushCorpLog(corpId, 'decision', `INFO: extending pass budget (${followupsGranted}/${maxExtraPasses}) to execute TODO.`)
          }
          continue
        }
      }

      if (queryCalls.length > 0) {
        queryRounds++
        if (queryRounds > maxQueryRounds) {
          pushCorpLog(corpId, 'decision', `INFO: query round limit reached (${maxQueryRounds}); skipping further route/ETA tools this step.`)
          for (const call of queryCalls.slice(0, 8)) {
            const name = String(call?.function?.name || '')
            pushCorpLog(corpId, 'decision', `TOOL ${name}: error: query_round_limit_exceeded`)
            conversation.push({
              role: 'tool',
              tool_call_id: String(call?.id || genId()),
              name,
              content: JSON.stringify({ ok: false, error: 'query_round_limit_exceeded' }),
            })
          }
          conversation.push({
            role: 'user',
            content:
              'You have enough route/ETA info for this step. Now call one or more in-world action tools: assign_trade / set_station_reorder_level / set_station_reserve_level / buy_trader_vulture / queue_station_construction / set_corp_goal. You may also update_llm_plan. Do NOT call get_sector_route/get_trade_eta again this step. If no action is possible, reply DONE.',
          })
          if (pass === maxPasses && maxPasses < maxPassesHard) {
            maxPasses++
            followupsGranted++
            pushCorpLog(corpId, 'decision', `INFO: extending pass budget (${followupsGranted}/${maxExtraPasses}) to allow post-tool decision.`)
          }
          continue
        }

        for (const call of queryCalls.slice(0, 8)) {
          const name = String(call?.function?.name || '')
          const rawArgs = call?.function?.arguments
          let args: any = {}
          try { args = JSON.parse(rawArgs || '{}') } catch { args = {} }

          let result: any = { ok: false, error: 'unknown_tool' }
          if (name === 'get_sector_route') {
            result = getSectorRoute(String(args.fromSectorId || ''), String(args.toSectorId || ''))
          } else if (name === 'get_trade_eta') {
            result = estimateTradeEta(String(args.fleetId || ''), String(args.buyStationId || ''), String(args.sellStationId || ''), Number(args.qty))
          }

          const short =
            name === 'get_sector_route'
              ? (result.ok ? `route ${result.fromSectorId} -> ${result.toSectorId}: ${result.hops} hops, ~${result.etaSec}s` : `route error: ${result.error}`)
              : (result.ok ? `eta fleet=${result.fleetId}: ${result.hops} hops, ~${result.etaSec}s` : `eta error: ${result.error}`)
          pushCorpLog(corpId, 'decision', `TOOL ${name}: ${short}`)

          conversation.push({
            role: 'tool',
            tool_call_id: String(call?.id || genId()),
            name,
            content: JSON.stringify(result),
          })
        }
        conversation.push({
          role: 'user',
          content:
            'Using the tool results above, now call one or more in-world action tools: assign_trade / set_station_reorder_level / set_station_reserve_level / buy_trader_vulture / queue_station_construction / set_corp_goal. You may also update_llm_plan. Do NOT call get_sector_route/get_trade_eta again this step. If no action is possible, reply DONE.',
        })
        // Ensure we always leave room for the model to act after seeing tool results.
        if (pass === maxPasses && maxPasses < maxPassesHard) {
          maxPasses++
          followupsGranted++
          pushCorpLog(corpId, 'decision', `INFO: extending pass budget (${followupsGranted}/${maxExtraPasses}) to allow post-tool decision.`)
        }
        continue
      }

      finalToolCalls = toolCalls
      break
    }
    setCorpLive(corpId, { status: 'done', pass: 0, text: assistantMessage })

    const appliedActions: any[] = []
    let worldActionsUsed = 0
    const nonWorldTools = new Set(['update_llm_plan', 'get_sector_route', 'get_trade_eta'])
    const isWorldAction = (toolName: string) => !nonWorldTools.has(toolName)
    const maxToolCalls = 16

    for (const call of finalToolCalls.slice(0, maxToolCalls)) {
      const name = call?.function?.name
      const rawArgs = call?.function?.arguments
      let args: any = {}
      try { args = JSON.parse(rawArgs || '{}') } catch { args = {} }

      if (isWorldAction(String(name || '')) && worldActionsUsed >= maxWorldActionsPerStep) continue

      if (name === 'update_llm_plan') {
        const out = updateCorpLLMPlan(corpId, args)
        appliedActions.push({ type: name, ok: out.ok, plan: out.ok ? out.plan : undefined, error: out.ok ? undefined : out.error })
        if (out.ok) pushCorpLog(corpId, 'plan', out.plan)
      } else if (name === 'get_sector_route') {
        const out = getSectorRoute(String(args.fromSectorId || ''), String(args.toSectorId || ''))
        appliedActions.push({ type: name, ok: out.ok, fromSectorId: (out as any).fromSectorId, toSectorId: (out as any).toSectorId, hops: (out as any).hops, etaSec: (out as any).etaSec, error: out.ok ? undefined : (out as any).error })
      } else if (name === 'get_trade_eta') {
        const out = estimateTradeEta(String(args.fleetId || ''), String(args.buyStationId || ''), String(args.sellStationId || ''), Number(args.qty))
        appliedActions.push({ type: name, ok: out.ok, fleetId: (out as any).fleetId, hops: (out as any).hops, etaSec: (out as any).etaSec, error: out.ok ? undefined : (out as any).error })
      } else if (name === 'set_station_reorder_level') {
        const stationId = String(args.stationId || '')
        const wareId = String(args.wareId || '')
        const reorderLevel = Number(args.reorderLevel)
        const out = setStationReorderLevel(corpId, stationId, wareId, reorderLevel)
        appliedActions.push({ type: name, ok: out.ok, stationId, wareId, reorderLevel: Math.floor(reorderLevel), error: out.ok ? undefined : (out as any).error })
        if (out.ok) worldActionsUsed++
      } else if (name === 'set_station_reserve_level') {
        const stationId = String(args.stationId || '')
        const wareId = String(args.wareId || '')
        const reserveLevel = Number(args.reserveLevel)
        const out = setStationReserveLevel(corpId, stationId, wareId, reserveLevel)
        appliedActions.push({ type: name, ok: out.ok, stationId, wareId, reserveLevel: Math.floor(reserveLevel), error: out.ok ? undefined : (out as any).error })
        if (out.ok) worldActionsUsed++
      } else if (name === 'assign_trade') {
        const fleetId = String(args.fleetId || '')
        const buyStationId = String(args.buyStationId || '')
        const sellStationId = String(args.sellStationId || '')
        const wareId = String(args.wareId || '')
        const qty = Number(args.qty)
        const out = assignTradeOrderToFleet(corpId, fleetId, buyStationId, sellStationId, wareId, qty)
        appliedActions.push({ type: name, ok: out.ok, fleetId, buyStationId, sellStationId, wareId, qty: Math.floor(qty), error: out.ok ? undefined : (out as any).error })
        if (out.ok) worldActionsUsed++
      } else if (name === 'set_corp_goal') {
        const goal = String(args.goal || '')
        const out = setCorpGoal(corpId, goal)
        appliedActions.push({ type: name, ok: out.ok, corpId, goal, error: out.ok ? undefined : (out as any).error })
        if (out.ok) worldActionsUsed++
      } else if (name === 'buy_trader_vulture') {
        const out = buyVultureTraderForCorp(corpId)
        appliedActions.push({ type: name, ok: out.ok, fleetId: (out as any).fleetId, price: (out as any).price, shipyardId: (out as any).shipyardId, error: out.ok ? undefined : (out as any).error })
        if (out.ok) worldActionsUsed++
      } else if (name === 'queue_station_construction') {
        const stationType = String(args.stationType || '')
        const targetSectorId = String(args.targetSectorId || '')
        const out = queueStationConstruction(corpId, stationType, targetSectorId)
        appliedActions.push({ type: name, ok: out.ok, stationType, targetSectorId, error: out.ok ? undefined : (out as any).error })
        if (out.ok) worldActionsUsed++
      } else if (name === 'post_work_order') {
        const out = postWorkOrder(corpId, args)
        appliedActions.push({ type: name, ok: out.ok, workOrderId: (out as any).workOrderId, escrow: (out as any).escrow, error: out.ok ? undefined : (out as any).error })
        if (out.ok) worldActionsUsed++
      }
    }

    pushCorpLog(corpId, 'actions', appliedActions)

    // Persist a tiny "what happened" trail for long-horizon planning.
    try {
      const corp: any = state.corporations.find((c: any) => c.id === corpId)
      if (corp) {
        corp.aiState = corp.aiState || { lastExpansionCheck: Date.now(), currentGoal: 'consolidate', pendingConstructions: [] }
        corp.aiState.llmPlan = corp.aiState.llmPlan || { strategy: '', todos: [], lastOutcomes: [], updatedAt: Date.now() }
        const outcomes = Array.isArray(corp.aiState.llmPlan.lastOutcomes) ? corp.aiState.llmPlan.lastOutcomes : []
        for (const a of appliedActions.slice(0, 8)) {
          if (!a || typeof a.type !== 'string') continue
          outcomes.unshift({ ingameTimeSec: state.elapsedTimeSec, type: a.type, ok: Boolean(a.ok) })
        }
        corp.aiState.llmPlan.lastOutcomes = outcomes.slice(0, 20)
        corp.aiState.llmPlan.updatedAt = Date.now()
      }
    } catch {
      // ignore
    }

    saveGameAfterAICycle()
    return { ok: true as const, assistantMessage, appliedActions }
  }

  const settleCurrentOrder = (fleet: NPCFleet) => {
    const order = fleet.currentOrder
    if (!order) return false
    const station = state.stations.find(s => s.id === order.sellStationId)
    const buyStation = state.stations.find(s => s.id === order.buyStationId)
    const wareId = order.sellWareId
    const carry = fleet.cargo[wareId] || 0
    if (!station || !buyStation || carry <= 0) return false

    const getCorp = (id?: string | null) => (id ? state.corporations.find(c => c.id === id) : undefined)
    const isTrackedCorp = (id: string | null) => Boolean(id) && Boolean(getCorp(id))
    const sellerOwner = fleet.ownerId ? String(fleet.ownerId) : null
    const buyerOwner = station.ownerId || null
    const isInternalSale = Boolean(sellerOwner) && sellerOwner === buyerOwner

    const amount = Math.min(carry, order.sellQty)
    const sellPrice = state.sectorPrices[station.sectorId]?.[wareId] || order.sellPrice || (state.wares.find(w => w.id === wareId)?.basePrice || 0)
    const buyPrice = order.buyPrice || 0
    const revenue = amount * sellPrice
    const cost = amount * buyPrice
    const trackedBuyCost = Number((order as any)._buyCost || cost)
    const netForSellerOwner = isInternalSale ? 0 : (revenue - trackedBuyCost)

    fleet.cargo[wareId] = Math.max(0, carry - amount)
    station.inventory[wareId] = (station.inventory[wareId] || 0) + amount

    if (!isInternalSale && revenue > 0) {
      // If the buyer is a tracked corp, it pays; seller receives (corp or fleet).
      if (isTrackedCorp(buyerOwner) && buyerOwner !== sellerOwner) {
        const corp = getCorp(buyerOwner)
        if (corp) corp.credits -= revenue
      }
      if (sellerOwner) {
        const corp = getCorp(sellerOwner)
        if (corp) corp.credits += revenue
      } else {
        fleet.credits += revenue
        fleet.totalProfit += netForSellerOwner
      }
    }
    fleet.tripsCompleted++

    // Work order bonus payout (independent traders only).
    if (!sellerOwner) {
      const woId = String((order as any)?._workOrderId || '')
      if (woId && Array.isArray(state.workOrders)) {
        const wo = state.workOrders.find(w => w.id === woId)
        if (wo && wo.status !== 'completed' && wo.status !== 'cancelled' && wo.status !== 'expired') {
          if (wo.sellStationId === station.id && wo.wareId === wareId) {
            const deliverQty = Math.max(0, Math.min(amount, wo.qtyRemaining))
            const bonus = Math.floor(deliverQty * wo.bonusPerUnit)
            const paid = Math.max(0, Math.min(bonus, wo.escrowRemaining))
            if (paid > 0) {
              fleet.credits += paid
              wo.escrowRemaining -= paid
            }
            wo.qtyRemaining = Math.max(0, wo.qtyRemaining - deliverQty)
            if (wo.qtyRemaining <= 0) {
              wo.status = 'completed'
              wo.assignedFleetId = null
              const corp = state.corporations.find(c => c.id === wo.corpId)
              if (corp && wo.escrowRemaining > 0) corp.credits += wo.escrowRemaining
              wo.escrowRemaining = 0
            } else {
              wo.status = 'open'
              wo.assignedFleetId = null
            }
          }
        }
      }
    }

    if (fleet.ownerId) {
      const corp = state.corporations.find(c => c.id === fleet.ownerId)
      if (corp) {
        corp.lifetimeTrades++
        corp.lifetimeProfit += netForSellerOwner
      }
    }

    state.tradeLog.unshift({
      id: genId(),
      timestamp: Date.now(),
      ingameTimeSec: state.elapsedTimeSec,
      fleetId: fleet.id,
      fleetName: fleet.name,
      fleetOwnerId: sellerOwner,
      wareId,
      wareName: order.sellWareName || wareId,
      quantity: amount,
      buyPrice,
      sellPrice,
      profit: netForSellerOwner,
      buySectorId: order.buySectorId,
      sellSectorId: station.sectorId,
      buyStationId: order.buyStationId,
      sellStationId: station.id,
      buyStationName: order.buyStationName,
      sellStationName: station.name,
      buyStationOwnerId: buyStation.ownerId || null,
      sellStationOwnerId: station.ownerId || null,
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

    const getCorp = (id?: string | null) => (id ? state.corporations.find(c => c.id === id) : undefined)
    const getOwnerIdForFleet = (f: NPCFleet) => (f.ownerId ? String(f.ownerId) : null)
    const isTrackedCorp = (id: string | null) => Boolean(id) && Boolean(getCorp(id))
    const applyCashDelta = (ownerId: string | null, delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) return
      if (ownerId) {
        const corp = getCorp(ownerId)
        if (corp) corp.credits += delta
        return
      }
      // Independent trader cash
      fleet.credits += delta
    }
    const creditCorpIfTracked = (ownerId: string | null, amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return
      if (isTrackedCorp(ownerId)) applyCashDelta(ownerId, amount)
    }

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
              const buyerOwner = getOwnerIdForFleet(fleet) // null => independent, non-null => corp pays
              const sellerOwner = station.ownerId || null
              const isInternalPurchase = Boolean(buyerOwner) && buyerOwner === sellerOwner
              const unitPrice = order.buyPrice || 0
              const cost = actualAmount * unitPrice

              // Track order cost to compute net later at sale/consumption time
              ;(order as any)._buyCost = ((order as any)._buyCost || 0) + (isInternalPurchase ? 0 : cost)
              ;(order as any)._buyQtyActual = ((order as any)._buyQtyActual || 0) + actualAmount

              if (!isInternalPurchase && cost > 0) {
                // Buyer pays, seller (if corp-owned) receives.
                applyCashDelta(buyerOwner, -cost)
                // Credit the station owner if it's a tracked corp (e.g., corp-to-corp trade)
                if (sellerOwner !== buyerOwner) creditCorpIfTracked(sellerOwner, cost)
              }
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

            const sellerOwner = getOwnerIdForFleet(fleet)
            const buyerOwner = station.ownerId || null
            const isInternalSale = Boolean(sellerOwner) && sellerOwner === buyerOwner

            const revenue = report.amount * sellPrice
            const cost = report.amount * buyPrice

            // What did the seller (fleet owner) actually pay on the buy transaction(s)?
            const trackedBuyCost = order ? Number((order as any)._buyCost || 0) : cost
            const netForSellerOwner = isInternalSale ? 0 : (revenue - trackedBuyCost)

            if (!isInternalSale && revenue > 0) {
              // Buyer pays (if tracked corp-owned station), seller receives (corp or independent).
              if (isTrackedCorp(buyerOwner) && buyerOwner !== sellerOwner) applyCashDelta(buyerOwner, -revenue)
              applyCashDelta(sellerOwner, revenue)
            }

            // Work order bonus payout (independent traders only).
            if (!sellerOwner) {
              const woId = String((order as any)?._workOrderId || '')
              if (woId && Array.isArray(state.workOrders)) {
                const wo = state.workOrders.find(w => w.id === woId)
                if (wo && wo.status !== 'completed' && wo.status !== 'cancelled' && wo.status !== 'expired') {
                  if (wo.sellStationId === station.id && wo.wareId === report.wareId) {
                    const deliverQty = Math.max(0, Math.min(report.amount, wo.qtyRemaining))
                    const bonus = Math.floor(deliverQty * wo.bonusPerUnit)
                    const paid = Math.max(0, Math.min(bonus, wo.escrowRemaining))
                    if (paid > 0) {
                      fleet.credits += paid
                      wo.escrowRemaining -= paid
                    }
                    wo.qtyRemaining = Math.max(0, wo.qtyRemaining - deliverQty)
                    if (wo.qtyRemaining <= 0) {
                      wo.status = 'completed'
                      wo.assignedFleetId = null
                      const corp = state.corporations.find(c => c.id === wo.corpId)
                      if (corp && wo.escrowRemaining > 0) corp.credits += wo.escrowRemaining
                      wo.escrowRemaining = 0
                      pushCorpLog(wo.corpId, 'actions', { type: 'work_order_completed', workOrderId: wo.id })
                    } else {
                      wo.status = 'open'
                      wo.assignedFleetId = null
                    }
                  }
                }
              }
            }

            // Profit tracking is only meaningful for independent fleets.
            if (!sellerOwner) {
              fleet.totalProfit += netForSellerOwner
            }
            fleet.tripsCompleted++

            // Log trade
            state.tradeLog.unshift({
              id: genId(),
              timestamp: Date.now(),
              ingameTimeSec: state.elapsedTimeSec,
              fleetId: fleet.id,
              fleetName: fleet.name,
              fleetOwnerId: sellerOwner,
              wareId: report.wareId,
              wareName: order ? order.sellWareName : getWareName(report.wareId),
              quantity: report.amount,
              buyPrice: buyPrice,
              sellPrice: sellPrice,
              profit: netForSellerOwner,
              buySectorId: order ? order.buySectorId : 'unknown',
              sellSectorId: order ? order.sellSectorId : station.sectorId,
              buyStationId: order ? order.buyStationId : undefined,
              sellStationId: station.id,
              buyStationName: order ? order.buyStationName : 'unknown',
              sellStationName: order ? order.sellStationName : station.name,
              buyStationOwnerId: (() => {
                const bs = order ? state.stations.find(s => s.id === order.buyStationId) : null
                return bs ? (bs.ownerId || null) : null
              })(),
              sellStationOwnerId: station.ownerId || null,
            })
            if (state.tradeLog.length > 100) state.tradeLog.length = 100

            // Profit share
            if (fleet.ownerId) {
              const corp = state.corporations.find(c => c.id === fleet.ownerId)
              if (corp) {
                corp.lifetimeTrades++
                // Corp accounting is transaction-based; lifetimeProfit tracks net deltas from trade log for corp-owned fleets.
                // (Independent fleets don't have a corp.)
                corp.lifetimeProfit += netForSellerOwner
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

  return {
    state,
    init,
    tick,
    loop,
    setTimeScale,
    handleShipReport,
    issueCommand,
    advanceTime,
    getEconomyHistory,
    recomputeSectorPrices,
    setStationReorderLevel,
    setStationReserveLevel,
    setCorpGoal,
    assignTradeOrderToFleet,
    getCorpControlContext,
    getCorpExternalStationSales,
    getCorpLogs,
    getCorpLive,
    runCorpControllerStep,
  }
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

        if (req.method === 'POST' && url.startsWith('/__ai/corp-control')) {
          let body = ''
          req.on('data', (chunk) => { body += chunk.toString() })
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}')
              const corpId = String(payload?.corpId || '')
              const incomingMessages = Array.isArray(payload?.messages) ? payload.messages : []
              if (!corpId) {
                res.statusCode = 400
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ error: 'corpId is required' }))
                return
              }
              const sanitizedMessages = incomingMessages
                .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
                .map((m: any) => ({ role: m.role, content: m.content }))

              const out = await u.runCorpControllerStep({ corpId, reason: 'manual', messages: sanitizedMessages })
              if (!out.ok) {
                res.statusCode = 400
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ error: out.error }))
                return
              }

              res.statusCode = 200
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ assistantMessage: out.assistantMessage, appliedActions: out.appliedActions }))
            } catch (e: any) {
              res.statusCode = 500
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ error: e?.message || 'AI server error' }))
            }
          })
          return
        }

        if (req.method === 'GET' && url.startsWith('/__ai/corp-logs')) {
          const full = new URL(url, 'http://localhost')
          const corpId = String(full.searchParams.get('corpId') || '')
          const since = Number(full.searchParams.get('since') || '0')
          if (!corpId) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'corpId is required' }))
            return
          }
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ entries: u.getCorpLogs(corpId, since) }))
          return
        }

        if (req.method === 'GET' && url.startsWith('/__ai/corp-live')) {
          const full = new URL(url, 'http://localhost')
          const corpId = String(full.searchParams.get('corpId') || '')
          if (!corpId) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'corpId is required' }))
            return
          }
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ live: u.getCorpLive(corpId) }))
          return
        }

        if (req.method === 'POST' && url.startsWith('/__ai/corp-autopilot-run')) {
          const full = new URL(url, 'http://localhost')
          const corpId = String(full.searchParams.get('corpId') || '')
          if (!corpId) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'corpId is required' }))
            return
          }
          let body = ''
          req.on('data', (chunk) => { body += chunk.toString() })
          req.on('end', () => {
            u.runCorpControllerStep({ corpId, reason: 'manual_trigger' })
              .then((out: any) => {
                if (!out?.ok) {
                  res.statusCode = 400
                  res.setHeader('content-type', 'application/json')
                  res.end(JSON.stringify({ error: out?.error || 'run_failed' }))
                  return
                }
                res.statusCode = 200
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ ok: true }))
              })
              .catch((e: any) => {
                res.statusCode = 500
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ error: e?.message || 'AI server error' }))
              })
          })
          return
        }

        if (req.method === 'GET' && url.startsWith('/__universe/economy-history')) {
          const full = new URL(url, 'http://localhost')
          const since = Number(full.searchParams.get('since') || '0')
          const limit = Number(full.searchParams.get('limit') || '0')
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(u.getEconomyHistory({ since, limit })))
          return
        }
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
        if (req.method === 'GET' && url.startsWith('/__universe/corp-revenue')) {
          const full = new URL(url, 'http://localhost')
          const corpId = String(full.searchParams.get('corpId') || '')
          const windowSec = Number(full.searchParams.get('windowSec') || '3600')
          if (!corpId) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'corpId is required' }))
            return
          }
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(u.getCorpExternalStationSales(corpId, windowSec)))
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
