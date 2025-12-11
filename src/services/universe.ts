import {
  INITIAL_FLEETS,
  INITIAL_CORPORATIONS,
  STATION_OWNERSHIP,
  type Corporation,
  type FleetSpawnConfig,
  type NPCFleet,
  type ShipReport,
  type ShipCommand,
} from '../types/simulation'
import type { Station } from '../store/gameStore'
import { CorporationAI } from './CorporationAI'

type WareCategory = 'primary' | 'food' | 'intermediate' | 'end'

interface Ware {
  id: string
  name: string
  category: WareCategory
  basePrice: number
  volume: number
}

interface Recipe {
  id: string
  productId: string
  inputs: { wareId: string; amount: number }[]
  cycleTimeSec: number
  batchSize: number
  productStorageCap: number
}

const seedStationInventory = (stations: Station[], recipes: Recipe[]) => {
  const recipeMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]))
  stations.forEach((st) => {
    const recipe = recipeMap.get(st.recipeId)
    if (!recipe) {
      // Minimal bootstrap for stations with unknown recipes so they're not empty
      st.inventory['energy_cells'] = st.inventory['energy_cells'] || 200
      return
    }
    // Seed some finished goods
    const productStock = Math.round(recipe.productStorageCap * 0.4) || recipe.batchSize
    st.inventory[recipe.productId] = productStock
    // Seed a few cycles worth of inputs
    recipe.inputs.forEach((inp) => {
      const seedAmt = Math.max(inp.amount * 3, 50)
      st.inventory[inp.wareId] = seedAmt
    })
  })
}

// Ensure stations that arrived without seeding get a bootstrap stock so production can start
const bootstrapStationInventory = (st: Station, recipeMap: Map<string, Recipe>) => {
  const recipe = recipeMap.get(st.recipeId)
  if (!recipe) return

  const hasProduct = (st.inventory[recipe.productId] || 0) > 0
  const hasInputs = recipe.inputs.every((inp) => (st.inventory[inp.wareId] || 0) > 0)

  if (!hasProduct) {
    const productStock = Math.round(recipe.productStorageCap * 0.4) || recipe.batchSize
    st.inventory[recipe.productId] = Math.max(st.inventory[recipe.productId] || 0, productStock)
  }
  if (!hasInputs) {
    recipe.inputs.forEach((inp) => {
      const seedAmt = Math.max(inp.amount * 3, 50)
      st.inventory[inp.wareId] = Math.max(st.inventory[inp.wareId] || 0, seedAmt)
    })
  }
}

const assignStationOwnership = (stations: Station[], corporations: Corporation[]) => {
  stations.forEach((st) => {
    if (!st.ownerId && st.sectorId.startsWith('xenon')) {
      st.ownerId = 'xenon_collective'
    }
  })

  stations.forEach((st) => {
    if (!st.ownerId) return
    const corp = corporations.find((c) => c.id === st.ownerId)
    if (corp && !corp.stationIds.includes(st.id)) {
      corp.stationIds = [...corp.stationIds, st.id]
    }
  })
}

// Fill in missing stocks and thresholds for all stations with known recipes
const normalizeStationStock = (stations: Station[], recipes: Recipe[]) => {
  const recipeMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]))
  stations.forEach((st) => {
    const recipe = recipeMap.get(st.recipeId)
    if (!recipe) return
    // Seed product if missing
    if ((st.inventory[recipe.productId] || 0) <= 0 && recipe.productStorageCap > 0) {
      st.inventory[recipe.productId] = Math.max(st.inventory[recipe.productId] || 0, Math.round(recipe.productStorageCap * 0.4) || recipe.batchSize)
    }
    // Seed inputs if missing
    recipe.inputs.forEach((inp) => {
      if ((st.inventory[inp.wareId] || 0) <= 0) {
        st.inventory[inp.wareId] = Math.max(st.inventory[inp.wareId] || 0, Math.max(inp.amount * 3, 50))
      }
      if ((st.reorderLevel[inp.wareId] || 0) <= 0) {
        st.reorderLevel[inp.wareId] = inp.amount * 20
      }
    })
    // Ensure reserve for product
    if ((st.reserveLevel[recipe.productId] || 0) <= 0 && recipe.productStorageCap > 0) {
      st.reserveLevel[recipe.productId] = recipe.productStorageCap * 0.2
    }
  })
}

interface UniverseState {
  wares: Ware[]
  recipes: Recipe[]
  stations: Station[]
  sectorPrices: Record<string, Record<string, number>>
  timeScale: number
  elapsedTimeSec: number
  acc: number
  corporations: Corporation[]
  fleets: NPCFleet[]
  activeEvents: unknown[]
  tradeLog: unknown[]
}

type TradeOrder = {
  id: string
  buyStationId: string
  buySectorId: string
  sellStationId: string
  sellSectorId: string
  wareId: string
  buyPrice: number
  sellPrice: number
  buyQty: number
  sellQty: number
  expectedProfit: number
  buyStationName: string
  sellStationName: string
  buyWareName: string
  sellWareName: string
}

const DEFAULT_WARES: Ware[] = [
  { id: 'energy_cells', name: 'Energy Cells', category: 'primary', basePrice: 16, volume: 1 },
  { id: 'ore', name: 'Ore', category: 'intermediate', basePrice: 128, volume: 3 },
  { id: 'silicon', name: 'Silicon Wafers', category: 'intermediate', basePrice: 504, volume: 5 },
  { id: 'wheat', name: 'Wheat', category: 'primary', basePrice: 28, volume: 1 },
  { id: 'cahoonas', name: 'Cahoonas', category: 'food', basePrice: 72, volume: 1 },
  { id: 'plankton', name: 'Plankton', category: 'primary', basePrice: 22, volume: 1 },
  { id: 'stott_spices', name: 'Stott Spices', category: 'food', basePrice: 64, volume: 1 },
  { id: 'scruffin_fruit', name: 'Scruffin Fruit', category: 'primary', basePrice: 36, volume: 1 },
  { id: 'chelt_meat', name: 'Chelt Meat', category: 'food', basePrice: 70, volume: 1 },
  { id: 'soya_beans', name: 'Soya Beans', category: 'primary', basePrice: 30, volume: 1 },
  { id: 'soja_husk', name: 'Soja Husk', category: 'food', basePrice: 72, volume: 1 },
  { id: 'massom_powder', name: 'Massom Powder', category: 'food', basePrice: 40, volume: 1 },
  { id: 'maja_snails', name: 'Maja Snails', category: 'primary', basePrice: 26, volume: 1 },
  { id: 'swamp_plant', name: 'Swamp Plant', category: 'primary', basePrice: 90, volume: 1 },
  { id: 'majaglit', name: 'Majaglit', category: 'primary', basePrice: 80, volume: 1 },
  { id: 'rastar_oil', name: 'Rastar Oil', category: 'food', basePrice: 140, volume: 1 },
  { id: 'quantum_tubes', name: 'Quantum Tubes', category: 'end', basePrice: 7500, volume: 2 },
  { id: 'microchips', name: 'Microchips', category: 'end', basePrice: 13500, volume: 1 },
  { id: 'shield_1mw', name: '1MW Shield', category: 'end', basePrice: 3000, volume: 2 },
  { id: 'hept_laser', name: 'Gamma HEPT', category: 'end', basePrice: 320000, volume: 12 },
  { id: 'teladianium', name: 'Teladianium', category: 'food', basePrice: 72, volume: 2 },
  { id: 'sunflowers', name: 'Sunflowers', category: 'primary', basePrice: 40, volume: 2 },
  { id: 'nostrop_oil', name: 'Nostrop Oil', category: 'food', basePrice: 120, volume: 2 },
  { id: 'ire_laser', name: 'Beta I.R.E. Laser', category: 'end', basePrice: 220000, volume: 12 },
  { id: 'spaceweed', name: 'Spaceweed', category: 'end', basePrice: 3200, volume: 1 },
  { id: 'bogas', name: 'BoGas', category: 'food', basePrice: 50, volume: 1 },
  { id: 'bofu', name: 'BoFu', category: 'food', basePrice: 120, volume: 1 },
  { id: 'crystals', name: 'Crystals', category: 'intermediate', basePrice: 1684, volume: 1 },
  { id: 'trade_goods', name: 'Trade Goods', category: 'end', basePrice: 600, volume: 1 },
  { id: 'ship_parts', name: 'Ship Parts', category: 'end', basePrice: 22000, volume: 5 },
]

const DEFAULT_RECIPES: Recipe[] = [
  { id: 'spp_cycle', productId: 'energy_cells', inputs: [], cycleTimeSec: 60, batchSize: 500, productStorageCap: 5000 },
  { id: 'spp_teladi', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 1 }], cycleTimeSec: 60, batchSize: 120, productStorageCap: 6000 },
  { id: 'mine_ore', productId: 'ore', inputs: [], cycleTimeSec: 90, batchSize: 200, productStorageCap: 2000 },
  { id: 'ore_mine', productId: 'ore', inputs: [], cycleTimeSec: 90, batchSize: 200, productStorageCap: 2000 },
  { id: 'mine_silicon', productId: 'silicon', inputs: [], cycleTimeSec: 120, batchSize: 120, productStorageCap: 1200 },
  { id: 'silicon_mine', productId: 'silicon', inputs: [], cycleTimeSec: 120, batchSize: 120, productStorageCap: 1200 },
  { id: 'argon_farm', productId: 'wheat', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 30, productStorageCap: 1500 },
  { id: 'cahoona_bakery', productId: 'cahoonas', inputs: [{ wareId: 'wheat', amount: 10 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 20, productStorageCap: 1000 },
  { id: 'plankton_farm', productId: 'plankton', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 30, productStorageCap: 1500 },
  { id: 'stott_mixery', productId: 'stott_spices', inputs: [{ wareId: 'plankton', amount: 10 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 20, productStorageCap: 1000 },
  { id: 'scruffin_farm', productId: 'scruffin_fruit', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 30, productStorageCap: 1500 },
  { id: 'chelt_aquarium', productId: 'chelt_meat', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 30, productStorageCap: 1500 },
  { id: 'soyfarm', productId: 'soya_beans', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 30, productStorageCap: 1500 },
  { id: 'soyery', productId: 'soja_husk', inputs: [{ wareId: 'soya_beans', amount: 10 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 20, productStorageCap: 1000 },
  { id: 'massom_mill', productId: 'massom_powder', inputs: [{ wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 70, batchSize: 40, productStorageCap: 1200 },
  { id: 'snail_ranch', productId: 'maja_snails', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 30, productStorageCap: 1500 },
  { id: 'flower_farm', productId: 'sunflowers', inputs: [{ wareId: 'energy_cells', amount: 60 }], cycleTimeSec: 80, batchSize: 240, productStorageCap: 2400 },
  { id: 'oil_refinery', productId: 'nostrop_oil', inputs: [{ wareId: 'sunflowers', amount: 160 }, { wareId: 'energy_cells', amount: 80 }], cycleTimeSec: 120, batchSize: 180, productStorageCap: 1800 },
  { id: 'sun_oil_refinery', productId: 'nostrop_oil', inputs: [{ wareId: 'sunflowers', amount: 160 }, { wareId: 'energy_cells', amount: 80 }], cycleTimeSec: 120, batchSize: 180, productStorageCap: 1800 },
  { id: 'teladianium_foundry', productId: 'teladianium', inputs: [{ wareId: 'ore', amount: 120 }, { wareId: 'energy_cells', amount: 120 }], cycleTimeSec: 150, batchSize: 160, productStorageCap: 1600 },
  { id: 'ire_forge', productId: 'ire_laser', inputs: [{ wareId: 'nostrop_oil', amount: 120 }, { wareId: 'ore', amount: 60 }, { wareId: 'silicon', amount: 30 }, { wareId: 'energy_cells', amount: 240 }], cycleTimeSec: 240, batchSize: 2, productStorageCap: 6 },
  { id: 'hept_forge', productId: 'hept_laser', inputs: [{ wareId: 'nostrop_oil', amount: 160 }, { wareId: 'ore', amount: 80 }, { wareId: 'silicon', amount: 40 }, { wareId: 'energy_cells', amount: 280 }], cycleTimeSec: 260, batchSize: 1, productStorageCap: 4 },
  { id: 'shield_plant', productId: 'shield_1mw', inputs: [{ wareId: 'ore', amount: 40 }, { wareId: 'teladianium', amount: 40 }, { wareId: 'energy_cells', amount: 120 }], cycleTimeSec: 180, batchSize: 4, productStorageCap: 40 },
  { id: 'quantum_tube_fab', productId: 'quantum_tubes', inputs: [{ wareId: 'ore', amount: 60 }, { wareId: 'energy_cells', amount: 120 }], cycleTimeSec: 160, batchSize: 40, productStorageCap: 800 },
  { id: 'chip_plant', productId: 'microchips', inputs: [{ wareId: 'silicon', amount: 80 }, { wareId: 'energy_cells', amount: 150 }], cycleTimeSec: 160, batchSize: 30, productStorageCap: 600 },
  { id: 'spaceweed_cycle', productId: 'spaceweed', inputs: [{ wareId: 'sunflowers', amount: 140 }, { wareId: 'energy_cells', amount: 120 }], cycleTimeSec: 200, batchSize: 60, productStorageCap: 600 },
  { id: 'dream_farm', productId: 'swamp_plant', inputs: [{ wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 70, batchSize: 40, productStorageCap: 1200 },
  { id: 'bliss_place', productId: 'spaceweed', inputs: [{ wareId: 'swamp_plant', amount: 40 }, { wareId: 'energy_cells', amount: 40 }], cycleTimeSec: 120, batchSize: 50, productStorageCap: 800 },
  { id: 'majaglit_factory', productId: 'majaglit', inputs: [{ wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 80, batchSize: 60, productStorageCap: 1200 },
  { id: 'rastar_refinery', productId: 'rastar_oil', inputs: [{ wareId: 'chelt_meat', amount: 20 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 100, batchSize: 60, productStorageCap: 1000 },
  { id: 'bogas_plant', productId: 'bogas', inputs: [{ wareId: 'energy_cells', amount: 80 }], cycleTimeSec: 90, batchSize: 220, productStorageCap: 1800 },
  { id: 'bofu_lab', productId: 'bofu', inputs: [{ wareId: 'bogas', amount: 160 }, { wareId: 'energy_cells', amount: 80 }], cycleTimeSec: 120, batchSize: 180, productStorageCap: 1600 },
  { id: 'crystal_fab', productId: 'crystals', inputs: [{ wareId: 'silicon', amount: 80 }, { wareId: 'energy_cells', amount: 150 }], cycleTimeSec: 150, batchSize: 40, productStorageCap: 600 },
  { id: 'logistics_hub', productId: 'trade_goods', inputs: [{ wareId: 'energy_cells', amount: 120 }], cycleTimeSec: 110, batchSize: 120, productStorageCap: 1200 },
  { id: 'shipyard', productId: 'ship_parts', inputs: [{ wareId: 'trade_goods', amount: 80 }, { wareId: 'energy_cells', amount: 200 }], cycleTimeSec: 200, batchSize: 40, productStorageCap: 400 },
]

const DEFAULT_STATIONS: Station[] = [
  { id: 'sz_spp_b', name: 'Solar Power Plant Beta', recipeId: 'spp_cycle', sectorId: 'seizewell', position: [2000, 0, 2000], modelPath: '/models/00285.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_spp_d', name: 'Solar Power Plant Delta', recipeId: 'spp_cycle', sectorId: 'seizewell', position: [-2000, 100, -2000], modelPath: '/models/00285.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_mine', name: 'Seizewell Ore Mine', recipeId: 'mine_ore', sectorId: 'seizewell', position: [0, -500, 5000], modelPath: '/models/00114.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_oil', name: 'Sun Oil Refinery (beta)', recipeId: 'oil_refinery', sectorId: 'seizewell', position: [3000, 0, -1000], modelPath: '/models/00283.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_ire', name: 'Beta I.R.E. Laser Forge (alpha)', recipeId: 'ire_forge', sectorId: 'seizewell', position: [-1500, 200, 3000], modelPath: '/models/00430.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_flower_b', name: 'Flower Farm (beta)', recipeId: 'flower_farm', sectorId: 'seizewell', position: [2500, -200, 2500], modelPath: '/models/00282.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_flower_g', name: 'Flower Farm (gamma)', recipeId: 'flower_farm', sectorId: 'seizewell', position: [-2500, 200, -2500], modelPath: '/models/00282.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_flower_d', name: 'Flower Farm (delta)', recipeId: 'flower_farm', sectorId: 'seizewell', position: [1000, 0, 4000], modelPath: '/models/00282.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'tg_spp', name: 'Teladi Gain SPP', recipeId: 'spp_cycle', sectorId: 'teladi_gain', position: [0, 0, 0], modelPath: '/models/00285.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'tg_oil', name: 'Teladi Gain Sun Oil', recipeId: 'oil_refinery', sectorId: 'teladi_gain', position: [2000, 0, 2000], modelPath: '/models/00283.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'tg_flower', name: 'Teladi Gain Flower Farm', recipeId: 'flower_farm', sectorId: 'teladi_gain', position: [-2000, 0, -2000], modelPath: '/models/00282.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'ps_spp', name: 'Profit Share SPP', recipeId: 'spp_cycle', sectorId: 'profit_share', position: [0, 0, 0], modelPath: '/models/00285.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'ps_foundry', name: 'Profit Share Teladianium Foundry', recipeId: 'teladianium_foundry', sectorId: 'profit_share', position: [3000, 100, 0], modelPath: '/models/00283.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'ps_silicon', name: 'Profit Share Silicon Mine', recipeId: 'mine_silicon', sectorId: 'profit_share', position: [-3000, -200, 0], modelPath: '/models/00114.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'gp_dream', name: 'Greater Profit Dream Farm', recipeId: 'spaceweed_cycle', sectorId: 'greater_profit', position: [2000, 0, 0], modelPath: '/models/00282.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'gp_bliss', name: 'Greater Profit Bliss Place', recipeId: 'spaceweed_cycle', sectorId: 'greater_profit', position: [-2000, 0, 0], modelPath: '/models/00282.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },

  // Argon core
  { id: 'ap_spp_alpha', name: 'Argon Prime SPP', recipeId: 'spp_cycle', sectorId: 'argon_prime', position: [1200, 80, -1600], modelPath: '/models/00184.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'ob_ore_mine', name: 'Ore Belt Mine', recipeId: 'mine_ore', sectorId: 'ore_belt', position: [-1800, -300, 900], modelPath: '/models/00114.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },

  // Boron frontier
  { id: 'ke_spp_alpha', name: 'Kingdom End SPP', recipeId: 'spp_cycle', sectorId: 'kingdom_end', position: [800, 60, 1400], modelPath: '/models/00281.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'rd_silicon_mine', name: 'Rolk\'s Drift Silicon Mine', recipeId: 'mine_silicon', sectorId: 'rolk_s_drift', position: [-1400, -260, -900], modelPath: '/models/00114.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },

  // Split holdings
  { id: 'tp_spp_alpha', name: 'Thuruk\'s Pride SPP', recipeId: 'spp_cycle', sectorId: 'thuruks_pride', position: [1600, 40, 1100], modelPath: '/models/00275.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'fw_ore_mine', name: 'Family Whi Ore Mine', recipeId: 'mine_ore', sectorId: 'family_whi', position: [-900, -220, 1700], modelPath: '/models/00114.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },

  // Paranid space
  { id: 'pp_spp_alpha', name: 'Paranid Prime SPP', recipeId: 'spp_cycle', sectorId: 'paranid_prime', position: [900, 90, -900], modelPath: '/models/00279.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'pr_silicon_mine', name: 'Priest Rings Silicon Mine', recipeId: 'mine_silicon', sectorId: 'priest_rings', position: [-1200, -240, -1400], modelPath: '/models/00114.obj', inventory: {}, reorderLevel: {}, reserveLevel: {} },
]

const DEFAULT_SECTOR_PRICES: Record<string, Record<string, number>> = {
  seizewell: { energy_cells: 18, ore: 140, silicon: 520, teladianium: 80, sunflowers: 52, nostrop_oil: 145, ire_laser: 230000 },
  teladi_gain: { energy_cells: 17, ore: 132, silicon: 515, teladianium: 78, sunflowers: 50, nostrop_oil: 140 },
  profit_share: { energy_cells: 16, ore: 128, silicon: 504, teladianium: 76, sunflowers: 48, nostrop_oil: 138 },
  greater_profit: { energy_cells: 17, sunflowers: 52, nostrop_oil: 150, spaceweed: 3400 },
}

function spawnFleet(cfg: FleetSpawnConfig, index: number, corporations: Corporation[]): NPCFleet {
  const id = `fleet_${index}`
  const owner = cfg.ownerId ? corporations.find((c) => c.id === cfg.ownerId) : null
  if (owner && !owner.fleetIds.includes(id)) {
    owner.fleetIds = [...owner.fleetIds, id]
  }

  const now = Date.now()

  return {
    id,
    name: `${cfg.ownerId ?? 'independent'}_${index}`,
    shipType: cfg.shipType,
    modelPath: cfg.modelPath,
    race: cfg.race ?? owner?.race ?? 'teladi',
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
    position: [0, 0, 0],
    state: 'idle',
    stateStartTime: now,
    commandQueue: [],
    cargo: {},
    credits: 0,
    totalProfit: 0,
    tripsCompleted: 0,
  }
}

function createInitialState(): UniverseState {
  const corporations = INITIAL_CORPORATIONS.map((c) => ({
    ...c,
    stationIds: [...c.stationIds],
    fleetIds: [...c.fleetIds],
  }))

  const fleets = INITIAL_FLEETS.map((cfg, idx) => spawnFleet(cfg, idx + 1, corporations))

  // Apply station ownership mapping
  Object.entries(STATION_OWNERSHIP).forEach(([stationId, ownerId]) => {
    const corp = corporations.find((c) => c.id === ownerId)
    if (corp && !corp.stationIds.includes(stationId)) {
      corp.stationIds = [...corp.stationIds, stationId]
    }
    const st = DEFAULT_STATIONS.find(s => s.id === stationId)
    if (st) st.ownerId = ownerId
  })

  // Fallback: assign Xenon-owned sectors' stations to Xenon Collective and sync lists
  assignStationOwnership(DEFAULT_STATIONS, corporations)

  // Seed station inventories/resources
  seedStationInventory(DEFAULT_STATIONS, DEFAULT_RECIPES)
  normalizeStationStock(DEFAULT_STATIONS, DEFAULT_RECIPES)

  return {
    wares: DEFAULT_WARES,
    recipes: DEFAULT_RECIPES,
    stations: DEFAULT_STATIONS,
    sectorPrices: DEFAULT_SECTOR_PRICES,
    timeScale: 1,
    elapsedTimeSec: 0,
    acc: 0,
    corporations,
    fleets,
    activeEvents: [],
    tradeLog: [],
  }
}

const uid = () => Math.random().toString(36).slice(2)

const productionStep = (stations: Station[], recipes: Recipe[], deltaSec: number) => {
  const recipeMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]))
  stations.forEach((st) => {
    const recipe = recipeMap.get(st.recipeId)
    if (!recipe) return
    bootstrapStationInventory(st, recipeMap)
    st.productionProgress = (st.productionProgress || 0) + deltaSec
    while (st.productionProgress >= recipe.cycleTimeSec) {
      const canProduce = recipe.inputs.every((inp) => (st.inventory[inp.wareId] || 0) >= inp.amount)
      if (!canProduce) break
      recipe.inputs.forEach((inp) => {
        st.inventory[inp.wareId] = (st.inventory[inp.wareId] || 0) - inp.amount
      })
      const productQty = recipe.batchSize
      const cap = recipe.productStorageCap
      const current = st.inventory[recipe.productId] || 0
      st.inventory[recipe.productId] = Math.min(cap, current + productQty)
      st.productionProgress -= recipe.cycleTimeSec
    }
  })
}

const BASE_JUMP_TIME = 120 // seconds per inter-sector hop (rough)
const DOCK_TIME = 30
const TRANSFER_TIME_PER_1000 = 60 // seconds per 1000 volume

const estimateTradeSeconds = (
  from: Station,
  to: Station,
  amount: number,
  wareVolume: number,
  fleetSpeed: number,
) => {
  const hops = from.sectorId === to.sectorId ? 0 : 1 // coarse; we don't have graph here
  const transit = (hops * BASE_JUMP_TIME) / Math.max(0.1, fleetSpeed)
  const transfer = (amount * wareVolume / 1000) * TRANSFER_TIME_PER_1000
  const dockCycle = DOCK_TIME * 2 // dock + undock on both ends
  return transit + transfer + dockCycle
}

const pickTrade = (
  fleet: NPCFleet,
  stations: Station[],
  wares: Ware[],
  sectorPrices: Record<string, Record<string, number>>,
  blocked: Set<string>,
): { wareId: string; from: Station; to: Station; amount: number; buyPrice: number; sellPrice: number } | null => {
  const wareMap = new Map<string, Ware>(wares.map((w) => [w.id, w]))
  let best: any = null

  stations.forEach((from) => {
    Object.entries(from.inventory).forEach(([wareId, qty]) => {
      if (qty <= 0) return
      const surplus = qty
      if (surplus < 50) return

      stations.forEach((to) => {
        if (to.id === from.id) return
        const need = (to.inventory[wareId] || 0) < 200
        if (!need) return
        const basePrice = wareMap.get(wareId)?.basePrice ?? 100
        const buyPrice = sectorPrices[from.sectorId]?.[wareId] ?? basePrice
        const sellPrice = sectorPrices[to.sectorId]?.[wareId] ?? buyPrice
        const profitPerUnit = sellPrice - buyPrice
        if (profitPerUnit <= 0) return
        const amount = Math.min(surplus * 0.6, 800)
        const volume = wareMap.get(wareId)?.volume ?? 1
        const eta = estimateTradeSeconds(from, to, amount, volume, fleet.speed || 1)
        const score = (profitPerUnit * amount) / Math.max(1, eta)
        const key = `${from.id}-${to.id}-${wareId}`
        if (blocked.has(key)) return
        if (!best || score > best.score) {
          best = { wareId, from, to, amount, buyPrice, sellPrice, score }
        }
      })
    })
  })

  if (!best) return null
  return {
    wareId: best.wareId,
    from: best.from,
    to: best.to,
    amount: Math.max(10, Math.floor(best.amount)),
    buyPrice: best.buyPrice,
    sellPrice: best.sellPrice,
  }
}

/**
 * Corp-focused picker: try to source inputs for the owner's stations first.
 * If nothing is needed, fall back to a profitable sell of the corp's products.
 */
const pickCorpTrade = (
  fleet: NPCFleet,
  ownerId: string,
  stations: Station[],
  wares: Ware[],
  recipes: Recipe[],
  sectorPrices: Record<string, Record<string, number>>,
  blocked: Set<string>,
): { wareId: string; from: Station; to: Station; amount: number; buyPrice: number; sellPrice: number } | null => {
  const recipeMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]))
  const wareMap = new Map<string, Ware>(wares.map((w) => [w.id, w]))
  const corpStations = stations.filter((s) => s.ownerId === ownerId)
  if (corpStations.length === 0) return null

  // 1) Supply shortages for corp-owned stations (inputs below reorder)
  let best: any = null
  for (const dest of corpStations) {
    const r = recipeMap.get(dest.recipeId)
    if (!r) continue
    for (const inp of r.inputs) {
      const have = dest.inventory[inp.wareId] || 0
      const reorder = dest.reorderLevel[inp.wareId] || inp.amount * 20
      const deficit = Math.max(0, reorder - have)
      if (deficit <= 0) continue

      // Search suppliers (prefer corp first)
      const suppliers = [
        ...stations.filter((s) => s.ownerId === ownerId),
        ...stations.filter((s) => s.ownerId !== ownerId),
      ]
      for (const src of suppliers) {
        if (src.id === dest.id) continue
        const available = src.inventory[inp.wareId] || 0
        const reserve = src.reserveLevel[inp.wareId] || 0
        const surplus = Math.max(0, available - reserve)
        if (surplus < inp.amount) continue

        const buyPrice = sectorPrices[src.sectorId]?.[inp.wareId] ?? wareMap.get(inp.wareId)?.basePrice ?? 100
        const sellPrice = sectorPrices[dest.sectorId]?.[inp.wareId] ?? buyPrice
        const amount = Math.max(10, Math.min(surplus * 0.5, deficit * 0.8, 800))
        const volume = wareMap.get(inp.wareId)?.volume ?? 1
        const eta = estimateTradeSeconds(src, dest, amount, volume, fleet.speed || 1)
        // Shortage-weighted profit per second
        const profitPerSec = ((sellPrice - buyPrice) * amount) / Math.max(1, eta)
        const score = profitPerSec + deficit * 0.001 // slight bias to fill shortages
        const key = `${src.id}-${dest.id}-${inp.wareId}`
        if (blocked.has(key)) continue

        if (!best || score > best.score) {
          best = { wareId: inp.wareId, from: src, to: dest, amount, buyPrice, sellPrice, score }
        }
      }
    }
  }
  if (best) {
    return {
      wareId: best.wareId,
      from: best.from,
      to: best.to,
      amount: Math.max(10, Math.floor(best.amount)),
      buyPrice: best.buyPrice,
      sellPrice: best.sellPrice,
    }
  }

  // 2) If no shortages, try to sell corp-produced goods with profit preference (corp-owned producers -> external buyers)
  let sellBest: any = null
  const producerStations = corpStations
  producerStations.forEach((from) => {
    Object.entries(from.inventory).forEach(([wareId, qty]) => {
      if (qty <= 0) return
      const surplus = qty - (from.reserveLevel[wareId] || 0)
      if (surplus <= 0) return

      stations.forEach((to) => {
        if (to.id === from.id) return
        const need = (to.inventory[wareId] || 0) < 200
        if (!need) return
        const buyPrice = sectorPrices[from.sectorId]?.[wareId] ?? wareMap.get(wareId)?.basePrice ?? 100
        const sellPrice = sectorPrices[to.sectorId]?.[wareId] ?? buyPrice
        const profit = sellPrice - buyPrice
        if (profit <= 0) return
        const amount = Math.min(surplus * 0.6, 800)
        const volume = wareMap.get(wareId)?.volume ?? 1
        const eta = estimateTradeSeconds(from, to, amount, volume, fleet.speed || 1)
        const score = (profit * amount) / Math.max(1, eta)
        const key = `${from.id}-${to.id}-${wareId}`
        if (blocked.has(key)) return
        if (!sellBest || score > sellBest.score) {
          sellBest = { wareId, from, to, amount, buyPrice, sellPrice, score }
        }
      })
    })
  })
  if (sellBest) {
    return {
      wareId: sellBest.wareId,
      from: sellBest.from,
      to: sellBest.to,
      amount: Math.max(10, Math.floor(sellBest.amount)),
      buyPrice: sellBest.buyPrice,
      sellPrice: sellBest.sellPrice,
    }
  }

  return null
}

const buildTradeCommands = (_fleet: NPCFleet, plan: ReturnType<typeof pickTrade>): ShipCommand[] => {
  if (!plan) return []
  const amt = plan.amount
  const now = Date.now()
  return [
    { id: uid(), type: 'goto-station', targetStationId: plan.from.id, targetSectorId: plan.from.sectorId, createdAt: now },
    { id: uid(), type: 'dock', targetStationId: plan.from.id, createdAt: now },
    { id: uid(), type: 'load-cargo', targetStationId: plan.from.id, wareId: plan.wareId, amount: amt, createdAt: now },
    { id: uid(), type: 'undock', targetStationId: plan.from.id, createdAt: now },
    { id: uid(), type: 'goto-station', targetStationId: plan.to.id, targetSectorId: plan.to.sectorId, createdAt: now },
    { id: uid(), type: 'dock', targetStationId: plan.to.id, createdAt: now },
    { id: uid(), type: 'unload-cargo', targetStationId: plan.to.id, wareId: plan.wareId, amount: amt, createdAt: now },
    { id: uid(), type: 'undock', targetStationId: plan.to.id, createdAt: now },
  ]
}

export class UniverseService {
  state: UniverseState

  constructor() {
    this.state = createInitialState()
  }

  init() {
    this.state = createInitialState()
  }

  tick(deltaSec: number) {
    if (!Number.isFinite(deltaSec) || deltaSec <= 0) return
    this.state.elapsedTimeSec += deltaSec
    productionStep(this.state.stations, this.state.recipes, deltaSec)

    // AI Processing
    // AI Processing
    this.state.corporations.forEach(corp => {
      const result = CorporationAI.processTurn(
        corp,
        this.state.stations,
        this.state.wares,
        this.state.recipes,
        // this.state.activeEvents as SectorEvent[], 
        this.state.fleets
      )

      if (result.newFleets.length > 0) {
        this.state.fleets.push(...result.newFleets)
        // Also register with corp
        corp.fleetIds.push(...result.newFleets.map(f => f.id))
      }
      if (result.newStations.length > 0) {
        this.state.stations.push(...result.newStations)
        corp.stationIds.push(...result.newStations.map(s => s.id))
      }
      if (result.removedFleetIds.length > 0) {
        this.state.fleets = this.state.fleets.filter(f => !result.removedFleetIds.includes(f.id))
        corp.fleetIds = corp.fleetIds.filter(id => !result.removedFleetIds.includes(id))
      }
    })

    this.assignTrades()
  }

  handleShipReport(report: ShipReport) {
    if (!report?.fleetId) return
    const fleet = this.state.fleets.find((f) => f.id === report.fleetId)
    if (!fleet) return

    if (report.sectorId) {
      fleet.currentSectorId = report.sectorId
    }
    fleet.position = report.position || fleet.position
    fleet.stateStartTime = report.timestamp || fleet.stateStartTime

    const station = this.state.stations.find((s) => s.id === report.stationId)

    switch (report.type) {
      case 'arrived-at-station':
      case 'docked':
        fleet.state = 'docking'
        break
      case 'cargo-loaded':
        if (!station || !report.wareId || typeof report.amount !== 'number') break

        // If the source station is sold out, abort the job so the trader can pick a new one
        const available = station.inventory[report.wareId] || 0
        const requested = Math.max(0, report.amount)
        if (available <= 0 || requested <= 0) {
          fleet.state = 'idle'
          fleet.commandQueue = []
          fleet.currentOrder = undefined
          fleet.targetStationId = undefined
          break
        }

        const amt = Math.min(requested, available)
        station.inventory[report.wareId] = Math.max(0, available - amt)
        fleet.cargo[report.wareId] = (fleet.cargo[report.wareId] || 0) + amt
        fleet.state = 'in-transit'
        break
      case 'cargo-unloaded':
        if (station && report.wareId && typeof report.amount === 'number') {
          const carry = fleet.cargo[report.wareId] || 0
          const amt = Math.min(report.amount, carry)
          fleet.cargo[report.wareId] = Math.max(0, carry - amt)
          station.inventory[report.wareId] = (station.inventory[report.wareId] || 0) + amt
          fleet.state = 'idle'
          fleet.commandQueue = []
          fleet.currentOrder = undefined
        }
        break
      case 'entered-sector':
        fleet.currentSectorId = report.sectorId || fleet.currentSectorId
        fleet.state = 'in-transit'
        break
      default:
        break
    }
  }

  private assignTrades() {
    const reservedTrades = new Set<string>() // prevent dog-piling the exact same leg
    this.state.fleets.forEach((fleet) => {
      if (fleet.commandQueue && fleet.commandQueue.length > 0) return
      if (Object.values(fleet.cargo).some((v) => v > 0)) return

      // Behavior-aware assignment: corp-owned logistics first, else global freelance
      const wantsCorpJob = fleet.ownerId && (fleet.behavior === 'station-supply' || fleet.behavior === 'station-distribute' || fleet.behavior === 'corp-logistics')
      const corpPlan = wantsCorpJob
        ? pickCorpTrade(fleet, fleet.ownerId as string, this.state.stations, this.state.wares, this.state.recipes, this.state.sectorPrices, reservedTrades)
        : null

      let plan = corpPlan || pickTrade(fleet, this.state.stations, this.state.wares, this.state.sectorPrices, reservedTrades)
      if (!plan) return

      // If plan is blocked, try to find an alternative once
      let key = `${plan.from.id}-${plan.to.id}-${plan.wareId}`
      if (reservedTrades.has(key)) {
        plan = pickTrade(fleet, this.state.stations, this.state.wares, this.state.sectorPrices, reservedTrades)
        if (!plan) return
        key = `${plan.from.id}-${plan.to.id}-${plan.wareId}`
        if (reservedTrades.has(key)) return
      }
      reservedTrades.add(key)

      const capacity = Math.max(100, fleet.capacity)
      const ware = this.state.wares.find((w) => w.id === plan.wareId)
      const perUnitVolume = ware?.volume || 1
      const maxByVolume = Math.floor(capacity / perUnitVolume)
      const amount = Math.max(10, Math.min(plan.amount, maxByVolume))

      const order: TradeOrder = {
        id: uid(),
        buyStationId: plan.from.id,
        buySectorId: plan.from.sectorId,
        sellStationId: plan.to.id,
        sellSectorId: plan.to.sectorId,
        wareId: plan.wareId,
        buyPrice: plan.buyPrice,
        sellPrice: plan.sellPrice,
        buyQty: amount,
        sellQty: amount,
        expectedProfit: (plan.sellPrice - plan.buyPrice) * amount,
        buyStationName: plan.from.name,
        sellStationName: plan.to.name,
        buyWareName: ware?.name || plan.wareId,
        sellWareName: ware?.name || plan.wareId,
      }

      fleet.currentOrder = order as any
      fleet.commandQueue = buildTradeCommands(fleet, { ...plan, amount })
      fleet.state = 'in-transit'
      fleet.stateStartTime = Date.now()
      fleet.destinationSectorId = plan.from.sectorId
      fleet.targetStationId = plan.from.id
    })
  }
}
