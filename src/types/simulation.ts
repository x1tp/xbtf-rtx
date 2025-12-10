/**
 * Background Sector Simulation Types
 * 
 * These types define the data structures for simulating sectors
 * when the player is not present.
 */

// ============================================================================
// Ownership Types
// ============================================================================

export type OwnershipType = 'corporation' | 'guild' | 'family' | 'state' | 'independent' | 'player'
export type RaceType = 'argon' | 'boron' | 'paranid' | 'split' | 'teladi' | 'pirate' | 'xenon'
export type FleetBehavior = 'station-supply' | 'station-distribute' | 'corp-logistics' | 'guild-assigned' | 'freelance' | 'player-manual' | 'player-auto' | 'patrol' | 'construction'

export interface Corporation {
  id: string
  name: string
  race: RaceType
  type: OwnershipType

  // Assets
  stationIds: string[]
  fleetIds: string[]

  // Finances
  credits: number
  netWorth: number

  // Behavior tuning
  aggressiveness: number      // 0-1, how competitive in pricing
  expansionBudget: number     // Credits reserved for growth
  riskTolerance: number       // 0-1, willingness to trade in danger zones

  // Stats
  lifetimeProfit: number
  lifetimeTrades: number

  // AI State (The Brain)
  aiState: CorporationAIState
}

export interface CorporationAIState {
  lastExpansionCheck: number
  currentGoal: 'stabilize' | 'expand' | 'war'
  pendingConstructions: PendingConstruction[]
}

export interface PendingConstruction {
  id: string
  stationType: string      // Recipe ID or specific station type
  targetSectorId: string
  builderShipId?: string   // TL ship assigned
  status: 'planning' | 'hiring-tl' | 'in-transit' | 'building'
  createdAt: number
}

// ============================================================================
// Fleet Types
// ============================================================================

export type FleetState = 'idle' | 'loading' | 'in-transit' | 'unloading' | 'docking' | 'undocking'

// Ship autonomy: Backend issues commands, frontend ships execute them
export type ShipCommandType =
  | 'goto-station'    // Fly to a station (may require gate travel)
  | 'dock'            // Dock at current target station
  | 'load-cargo'      // Load specified cargo at docked station
  | 'unload-cargo'    // Unload specified cargo at docked station
  | 'undock'          // Leave the station
  | 'goto-gate'       // Fly to a specific gate
  | 'use-gate'        // Enter the gate to travel to another sector
  | 'patrol'          // Orbit/patrol current area
  | 'wait'            // Hold position
  | 'trade-buy'       // Travel to station, dock, and buy ware
  | 'trade-sell'      // Travel to station, dock, and sell ware
  | 'store-cargo'     // Store cargo at corp/rental storage (for cancelled orders)
  | 'move-to-sector'  // Travel to a specific sector (multi-hop)

export interface ShipCommand {
  id: string
  type: ShipCommandType
  targetStationId?: string      // For goto-station, dock, load, unload
  targetSectorId?: string       // For goto-gate, use-gate
  wareId?: string               // For load-cargo, unload-cargo
  amount?: number               // For load-cargo, unload-cargo
  createdAt: number
}

// Reports from ship to backend about completed actions
export type ShipReportType =
  | 'arrived-at-station'
  | 'docked'
  | 'cargo-loaded'
  | 'cargo-unloaded'
  | 'undocked'
  | 'arrived-at-gate'
  | 'entered-sector'
  | 'position-update'
  | 'cargo-stored'    // Cargo stored at corp/rental storage
  | 'queue-complete'

export interface ShipReport {
  fleetId: string
  type: ShipReportType
  sectorId: string
  position: [number, number, number]
  stationId?: string
  wareId?: string
  amount?: number
  timestamp: number
}

export interface NPCFleet {
  id: string
  name: string
  shipType: string              // Model class e.g. "mercury", "vulture", "caiman"
  modelPath: string             // Path to 3D model for rendering
  race: RaceType
  capacity: number              // Cargo capacity in m³
  speed: number                 // Sector traversal speed multiplier (1.0 = normal)
  homeSectorId: string          // Base sector where they respawn

  // Ownership
  ownerId: string | null        // Corporation ID (null = truly independent)
  ownerType: OwnershipType
  homeStationId?: string        // If station-owned, which station
  behavior: FleetBehavior
  autonomy: number              // 0-1, how much freedom in route selection
  profitShare: number           // % of profit kept vs sent to owner

  // Location (synced FROM frontend when ship is autonomous)
  currentSectorId: string       // Where they are now
  position: [number, number, number]  // Position within sector (reported by frontend)

  // Autonomous ship state (managed by frontend NPCTrader)
  // Backend only sets commands, frontend executes and reports back
  state: FleetState             // Current state (reported by frontend)
  stateStartTime: number        // When current state began

  // Command queue (set by backend, executed by frontend)
  commandQueue: ShipCommand[]   // Commands to execute in order
  currentCommand?: ShipCommand  // Currently executing command

  // Transit info (for cross-sector travel)
  destinationSectorId?: string

  // Trading
  cargo: Record<string, number> // wareId -> amount
  credits: number               // Ship's own credits (for freelancers)
  currentOrder?: TradeOrder     // Current trade mission
  targetStationId?: string      // Station they're heading to / at

  // Stats
  totalProfit: number           // Lifetime earnings
  tripsCompleted: number
}

export interface TradeOrder {
  id: string
  buyStationId: string
  buyStationName: string
  buySectorId: string
  buyWareId: string
  buyWareName: string
  buyQty: number
  buyPrice: number

  sellStationId: string
  sellStationName: string
  sellSectorId: string
  sellWareId: string
  sellWareName: string
  sellQty: number
  sellPrice: number

  expectedProfit: number
  createdAt: number
}

// ============================================================================
// Event Types
// ============================================================================

export type SectorEventType =
  | 'shortage'          // Ware shortage, prices spike
  | 'surplus'           // Ware surplus, prices drop
  | 'pirate_raid'       // Pirates attacking traders
  | 'station_damaged'   // Station production slowed
  | 'trade_boom'        // Increased trade activity
  | 'blockade'          // Gate blocked, travel delayed

export interface SectorEvent {
  id: string
  sectorId: string
  type: SectorEventType
  wareId?: string           // Affected ware (for shortage/surplus)
  severity: number          // 0-1, affects magnitude
  startTime: number
  duration: number          // milliseconds
  description: string
}

// ============================================================================
// Trade Log Types
// ============================================================================

export interface TradeLogEntry {
  id: string
  timestamp: number
  fleetId: string
  fleetName: string
  wareId: string
  wareName: string
  quantity: number
  buyPrice: number
  sellPrice: number
  profit: number
  buySectorId: string
  sellSectorId: string
  buyStationName: string
  sellStationName: string
}

// ============================================================================
// Sector View Types (for remote viewing)
// ============================================================================

export interface SectorViewFleet {
  id: string
  name: string
  shipType: string
  modelPath: string
  owner: string
  position: [number, number, number]
  state: FleetState
  targetStationName?: string
  cargo: Record<string, number>
  cargoValue: number
}

export interface SectorViewTransit {
  id: string
  name: string
  fromSectorId: string
  fromSectorName: string
  toSectorId: string
  toSectorName: string
  progress: number        // 0-1
  etaSeconds: number
  direction: 'incoming' | 'outgoing'
}

export interface SectorViewData {
  sectorId: string
  sectorName: string

  // Fleets present in sector
  fleets: SectorViewFleet[]

  // Fleets in transit to/from this sector
  fleetsInTransit: SectorViewTransit[]

  // Summary stats
  stats: {
    totalFleets: number
    fleetsLoading: number
    fleetsUnloading: number
    fleetsIdle: number
    incomingFleets: number
    outgoingFleets: number
  }

  // Recent activity
  recentTrades: TradeLogEntry[]
}

// ============================================================================
// Universe State Extensions
// ============================================================================

export interface UniverseFleetState {
  corporations: Corporation[]
  fleets: NPCFleet[]
  activeEvents: SectorEvent[]
  tradeLog: TradeLogEntry[]
  lastTickTime: number
}

// ============================================================================
// Route Finding Types
// ============================================================================

export interface TradeRoute {
  buyStationId: string
  buySectorId: string
  sellStationId: string
  sellSectorId: string
  wareId: string
  buyPrice: number
  sellPrice: number
  quantity: number
  travelCost: number
  profit: number
  profitPerVolume: number
  jumpDistance: number
}

// ============================================================================
// Teladi Corporations (Initial Setup)
// ============================================================================

export const TELADI_CORPORATIONS: Corporation[] = [
  {
    id: 'teladi_company',
    name: 'Teladi Company',
    race: 'teladi',
    type: 'state',  // State-run mega-corp
    stationIds: [],  // Will be assigned: Trading Stations, Shipyards, Equip Docks
    fleetIds: [],
    credits: 5_000_000,
    netWorth: 50_000_000,
    aggressiveness: 0.4,
    expansionBudget: 500_000,
    riskTolerance: 0.3,
    lifetimeProfit: 0,
    lifetimeTrades: 0,
    aiState: { lastExpansionCheck: 0, currentGoal: 'expand', pendingConstructions: [] },
  },
  {
    id: 'sunward_consortium',
    name: 'Sunward Consortium',
    race: 'teladi',
    type: 'guild',
    stationIds: [],  // Solar Power Plants
    fleetIds: [],
    credits: 800_000,
    netWorth: 4_000_000,
    aggressiveness: 0.5,
    expansionBudget: 100_000,
    riskTolerance: 0.4,
    lifetimeProfit: 0,
    lifetimeTrades: 0,
    aiState: { lastExpansionCheck: 0, currentGoal: 'stabilize', pendingConstructions: [] },
  },
  {
    id: 'family_zhikkt',
    name: "Family Zhi'kkt",
    race: 'teladi',
    type: 'family',
    stationIds: [],  // Some SPPs and Flower Farms
    fleetIds: [],
    credits: 300_000,
    netWorth: 1_500_000,
    aggressiveness: 0.6,
    expansionBudget: 50_000,
    riskTolerance: 0.5,
    lifetimeProfit: 0,
    lifetimeTrades: 0,
    aiState: { lastExpansionCheck: 0, currentGoal: 'expand', pendingConstructions: [] },
  },
  {
    id: 'family_tekra',
    name: "Family Tek'ra",
    race: 'teladi',
    type: 'family',
    stationIds: [],  // Oil Refineries
    fleetIds: [],
    credits: 400_000,
    netWorth: 2_000_000,
    aggressiveness: 0.55,
    expansionBudget: 60_000,
    riskTolerance: 0.45,
    lifetimeProfit: 0,
    lifetimeTrades: 0,
    aiState: { lastExpansionCheck: 0, currentGoal: 'expand', pendingConstructions: [] },
  },
  {
    id: 'crimson_commerce',
    name: 'Crimson Commerce Guild',
    race: 'teladi',
    type: 'guild',
    stationIds: [],  // Weapon forges
    fleetIds: [],
    credits: 1_200_000,
    netWorth: 6_000_000,
    aggressiveness: 0.7,
    expansionBudget: 200_000,
    riskTolerance: 0.6,
    lifetimeProfit: 0,
    lifetimeTrades: 0,
    aiState: { lastExpansionCheck: 0, currentGoal: 'war', pendingConstructions: [] },
  },
  {
    id: 'profit_guild',
    name: 'Profit Guild',
    race: 'teladi',
    type: 'guild',
    stationIds: [],  // Bliss Places, Dream Farms
    fleetIds: [],
    credits: 600_000,
    netWorth: 3_000_000,
    aggressiveness: 0.65,
    expansionBudget: 80_000,
    riskTolerance: 0.55,
    lifetimeProfit: 0,
    lifetimeTrades: 0,
    aiState: { lastExpansionCheck: 0, currentGoal: 'expand', pendingConstructions: [] },
  },
]

// Station to Corporation mapping for initial setup
export const STATION_OWNERSHIP: Record<string, string> = {
  // Seizewell
  'sz_spp_b': 'sunward_consortium',
  'sz_spp_d': 'family_zhikkt',
  'sz_oil': 'family_tekra',
  'sz_flower_b': 'family_zhikkt',
  'sz_flower_g': 'independent',  // Small independent
  'sz_flower_d': 'independent',
  'sz_ire': 'crimson_commerce',

  // Teladi Gain
  'tg_bliss': 'profit_guild',
  'tg_oil': 'family_tekra',
  'tg_flower': 'family_zhikkt',

  // Profit Share
  'ps_spp': 'sunward_consortium',
  'ps_foundry': 'teladi_company',  // Heavy industry = company

  // Greater Profit
  'gp_dream': 'profit_guild',
  'gp_bliss': 'profit_guild',
}

// ============================================================================
// Fleet Spawning Config
// ============================================================================

export interface FleetSpawnConfig {
  ownerId: string | null
  ownerType: OwnershipType
  behavior: FleetBehavior
  homeStationId?: string
  shipType: string
  modelPath: string
  capacity: number
  speed: number
  autonomy: number
  profitShare: number
  homeSectorId: string
}

export const INITIAL_FLEETS: FleetSpawnConfig[] = [
  // Teladi Company - corporate logistics
  { ownerId: 'teladi_company', ownerType: 'state', behavior: 'corp-logistics', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.1, homeSectorId: 'seizewell' },
  { ownerId: 'teladi_company', ownerType: 'state', behavior: 'corp-logistics', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.1, homeSectorId: 'profit_share' },
  { ownerId: 'teladi_company', ownerType: 'state', behavior: 'freelance', shipType: 'Albatross', modelPath: '/models/00187.obj', capacity: 8000, speed: 0.7, autonomy: 0.8, profitShare: 0.2, homeSectorId: 'seizewell' },

  // Sunward Consortium - station supply for solar plants
  { ownerId: 'sunward_consortium', ownerType: 'guild', behavior: 'station-supply', homeStationId: 'sz_spp_b', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 0.2, profitShare: 0.15, homeSectorId: 'seizewell' },
  { ownerId: 'sunward_consortium', ownerType: 'guild', behavior: 'station-distribute', homeStationId: 'ps_spp', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.15, homeSectorId: 'profit_share' },

  // Family Zhi'kkt - family business
  { ownerId: 'family_zhikkt', ownerType: 'family', behavior: 'station-distribute', homeStationId: 'sz_spp_d', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 0.4, profitShare: 0.25, homeSectorId: 'seizewell' },

  // Family Tek'ra - oil business
  { ownerId: 'family_tekra', ownerType: 'family', behavior: 'station-supply', homeStationId: 'sz_oil', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.2, homeSectorId: 'seizewell' },

  // Crimson Commerce - weapon traders
  { ownerId: 'crimson_commerce', ownerType: 'guild', behavior: 'station-supply', homeStationId: 'sz_ire', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 0.2, profitShare: 0.1, homeSectorId: 'seizewell' },
  { ownerId: 'crimson_commerce', ownerType: 'guild', behavior: 'freelance', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.1, autonomy: 0.9, profitShare: 0.3, homeSectorId: 'seizewell' },

  // Profit Guild - recreational goods
  { ownerId: 'profit_guild', ownerType: 'guild', behavior: 'guild-assigned', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 0.5, profitShare: 0.2, homeSectorId: 'teladi_gain' },
  { ownerId: 'profit_guild', ownerType: 'guild', behavior: 'station-supply', homeStationId: 'gp_dream', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 0.3, profitShare: 0.15, homeSectorId: 'greater_profit' },

  // Independent traders - pure profit seekers
  { ownerId: null, ownerType: 'independent', behavior: 'freelance', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.05, autonomy: 1.0, profitShare: 1.0, homeSectorId: 'seizewell' },
  { ownerId: null, ownerType: 'independent', behavior: 'freelance', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 0.95, autonomy: 1.0, profitShare: 1.0, homeSectorId: 'profit_share' },
  { ownerId: null, ownerType: 'independent', behavior: 'freelance', shipType: 'Vulture', modelPath: '/models/00188.obj', capacity: 2800, speed: 1.0, autonomy: 1.0, profitShare: 1.0, homeSectorId: 'teladi_gain' },
]

// ============================================================================
// Helper Constants
// ============================================================================

export const FLEET_CONSTANTS = {
  /** Base time in seconds to travel between adjacent sectors */
  BASE_JUMP_TIME: 120,

  /** Time in seconds to dock at a station */
  DOCK_TIME: 30,

  /** Time in seconds to load/unload cargo per 1000 units */
  TRANSFER_TIME_PER_1000: 60,

  /** Minimum profit margin to consider a trade route */
  MIN_PROFIT_MARGIN: 50,

  /** Maximum jump distance for trade routes */
  MAX_ROUTE_JUMPS: 4,

  /** How often to re-evaluate trade routes when idle */
  IDLE_RETHINK_TIME: 30,

  /** Fleet position update interval for remote viewing (ms) */
  POSITION_UPDATE_INTERVAL: 500,
}
