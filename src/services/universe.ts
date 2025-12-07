import {
  INITIAL_FLEETS,
  TELADI_CORPORATIONS,
  STATION_OWNERSHIP,
  type Corporation,
  type FleetSpawnConfig,
  type NPCFleet,
  type ShipReport,
  type ShipCommand,
} from '../types/simulation'
import type { Station } from '../store/gameStore'

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
    if (!recipe) return
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
  { id: 'teladianium', name: 'Teladianium', category: 'food', basePrice: 72, volume: 2 },
  { id: 'sunflowers', name: 'Sunflowers', category: 'primary', basePrice: 40, volume: 2 },
  { id: 'nostrop_oil', name: 'Nostrop Oil', category: 'food', basePrice: 120, volume: 2 },
  { id: 'ire_laser', name: 'Beta I.R.E. Laser', category: 'end', basePrice: 220000, volume: 12 },
  { id: 'spaceweed', name: 'Spaceweed', category: 'end', basePrice: 3200, volume: 1 },
]

const DEFAULT_RECIPES: Recipe[] = [
  { id: 'spp_cycle', productId: 'energy_cells', inputs: [], cycleTimeSec: 60, batchSize: 500, productStorageCap: 5000 },
  { id: 'mine_ore', productId: 'ore', inputs: [], cycleTimeSec: 90, batchSize: 200, productStorageCap: 2000 },
  { id: 'mine_silicon', productId: 'silicon', inputs: [], cycleTimeSec: 120, batchSize: 120, productStorageCap: 1200 },
  { id: 'flower_farm', productId: 'sunflowers', inputs: [{ wareId: 'energy_cells', amount: 60 }], cycleTimeSec: 80, batchSize: 240, productStorageCap: 2400 },
  { id: 'oil_refinery', productId: 'nostrop_oil', inputs: [{ wareId: 'sunflowers', amount: 160 }, { wareId: 'energy_cells', amount: 80 }], cycleTimeSec: 120, batchSize: 180, productStorageCap: 1800 },
  { id: 'teladianium_foundry', productId: 'teladianium', inputs: [{ wareId: 'ore', amount: 120 }, { wareId: 'energy_cells', amount: 120 }], cycleTimeSec: 150, batchSize: 160, productStorageCap: 1600 },
  { id: 'ire_forge', productId: 'ire_laser', inputs: [{ wareId: 'nostrop_oil', amount: 120 }, { wareId: 'ore', amount: 60 }, { wareId: 'silicon', amount: 30 }, { wareId: 'energy_cells', amount: 240 }], cycleTimeSec: 240, batchSize: 2, productStorageCap: 6 },
  { id: 'spaceweed_cycle', productId: 'spaceweed', inputs: [{ wareId: 'sunflowers', amount: 140 }, { wareId: 'energy_cells', amount: 120 }], cycleTimeSec: 200, batchSize: 60, productStorageCap: 600 },
]

const DEFAULT_STATIONS: Station[] = [
  { id: 'sz_spp_b', name: 'Solar Power Plant Beta', recipeId: 'spp_cycle', sectorId: 'seizewell', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_spp_d', name: 'Solar Power Plant Delta', recipeId: 'spp_cycle', sectorId: 'seizewell', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_mine', name: 'Seizewell Ore Mine', recipeId: 'mine_ore', sectorId: 'seizewell', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_oil', name: 'Sun Oil Refinery (beta)', recipeId: 'oil_refinery', sectorId: 'seizewell', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_ire', name: 'Beta I.R.E. Laser Forge (alpha)', recipeId: 'ire_forge', sectorId: 'seizewell', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_flower_b', name: 'Flower Farm (beta)', recipeId: 'flower_farm', sectorId: 'seizewell', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_flower_g', name: 'Flower Farm (gamma)', recipeId: 'flower_farm', sectorId: 'seizewell', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'sz_flower_d', name: 'Flower Farm (delta)', recipeId: 'flower_farm', sectorId: 'seizewell', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'tg_spp', name: 'Teladi Gain SPP', recipeId: 'spp_cycle', sectorId: 'teladi_gain', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'tg_oil', name: 'Teladi Gain Sun Oil', recipeId: 'oil_refinery', sectorId: 'teladi_gain', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'tg_flower', name: 'Teladi Gain Flower Farm', recipeId: 'flower_farm', sectorId: 'teladi_gain', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'ps_spp', name: 'Profit Share SPP', recipeId: 'spp_cycle', sectorId: 'profit_share', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'ps_foundry', name: 'Profit Share Teladianium Foundry', recipeId: 'teladianium_foundry', sectorId: 'profit_share', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'ps_silicon', name: 'Profit Share Silicon Mine', recipeId: 'mine_silicon', sectorId: 'profit_share', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'gp_dream', name: 'Greater Profit Dream Farm', recipeId: 'spaceweed_cycle', sectorId: 'greater_profit', inventory: {}, reorderLevel: {}, reserveLevel: {} },
  { id: 'gp_bliss', name: 'Greater Profit Bliss Place', recipeId: 'spaceweed_cycle', sectorId: 'greater_profit', inventory: {}, reorderLevel: {}, reserveLevel: {} },
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
    race: owner?.race ?? 'teladi',
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
  const corporations = TELADI_CORPORATIONS.map((c) => ({
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
  })

  // Seed station inventories/resources
  seedStationInventory(DEFAULT_STATIONS, DEFAULT_RECIPES)

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

const pickTrade = (
  stations: Station[],
  wares: Ware[],
  sectorPrices: Record<string, Record<string, number>>,
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
        const buyPrice = sectorPrices[from.sectorId]?.[wareId] ?? wareMap.get(wareId)?.basePrice ?? 100
        const sellPrice = sectorPrices[to.sectorId]?.[wareId] ?? buyPrice
        const profit = sellPrice - buyPrice
        if (profit <= 0) return
        const amount = Math.min(surplus * 0.6, 800)
        if (!best || profit * amount > best.score) {
          best = { wareId, from, to, amount, buyPrice, sellPrice, score: profit * amount }
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
        if (station && report.wareId && typeof report.amount === 'number') {
          const available = station.inventory[report.wareId] || 0
          const amt = Math.min(report.amount, available)
          station.inventory[report.wareId] = Math.max(0, available - amt)
          fleet.cargo[report.wareId] = (fleet.cargo[report.wareId] || 0) + amt
          fleet.state = 'in-transit'
        }
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
    this.state.fleets.forEach((fleet) => {
      if (fleet.commandQueue && fleet.commandQueue.length > 0) return
      if (Object.values(fleet.cargo).some((v) => v > 0)) return

      const plan = pickTrade(this.state.stations, this.state.wares, this.state.sectorPrices)
      if (!plan) return

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
