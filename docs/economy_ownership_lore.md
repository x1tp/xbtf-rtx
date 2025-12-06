# Economy Ownership & Trade Lore

## The Question

Who owns the stations? Who moves the goods? Is it:
- Stations sending ships to buy resources?
- Producers distributing to clients?
- Independent traders finding margins?

**Answer: All of the above.** The X universe has a messy, organic economy.

---

## Ownership Model

### Station Ownership Types

```typescript
type OwnershipType = 
  | 'corporation'      // Large conglomerate owning multiple stations
  | 'guild'            // Trade guild cooperative
  | 'family'           // Teladi family business, Split clan
  | 'state'            // Government-owned (military, essential services)
  | 'independent'      // Single owner, small operation
  | 'player'           // Player-built stations
```

### Teladi Context (Our 4 Sectors)

The Teladi are merchant lizards. Everything is about profit:

- **Teladi Company** - The mega-corp. Owns Trading Stations, Shipyards, Equipment Docks
- **Family Businesses** - Extended family clans own production chains
- **Profit Guilds** - Cooperatives of small traders who pool resources
- **Independent Operators** - Small-time entrepreneurs

#### Seizewell Station Ownership
```
Teladi Trading Station     → Teladi Company (state-corp hybrid)
Teladi Shipyard           → Teladi Company  
Space Equipment Dock      → Teladi Company
Solar Power Plant (b)     → Profit Guild "Sunward Consortium"
Solar Power Plant (delta) → Family Zhi'kkt
Sun Oil Refinery (beta)   → Family Tek'ra
Flower Farms (3)          → Independent operators (different owners)
IRE Laser Forge           → Guild "Crimson Commerce" (weapons guild)
```

---

## Fleet Ownership & Behavior

### Who Owns Ships?

| Owner Type | Ships | Behavior |
|------------|-------|----------|
| **Station Fleet** | TS (freighters) | Fetch inputs for owner's stations |
| **Corporation Fleet** | TS, TL | Distribute between corp stations, external trade |
| **Guild Pool** | TS | Shared among guild members, assigned dynamically |
| **Independent Trader** | TS, TP | Pure profit-seeking, any legal route |
| **Player** | Any | Player-directed or automated |

### Fleet Behavior Modes

```typescript
type FleetBehavior = 
  | 'station-supply'    // Fetch inputs for a specific station
  | 'station-distribute'// Deliver outputs from a specific station
  | 'corp-logistics'    // Move goods between corp's own stations
  | 'guild-assigned'    // Execute guild-assigned routes
  | 'freelance'         // Independent profit-seeking
  | 'player-manual'     // Player direct control
  | 'player-auto'       // Player automation script
```

---

## The Trade Flow

### 1. Station-Owned Freighters (40% of trade)

Large stations own freighters that ensure their supply chains:

```
Solar Power Plant owns 2x Vulture freighters
  → Ship 1: Patrol nearby sectors for Crystal sellers
  → Ship 2: Deliver Energy Cells to best-paying buyers
  
Priority: Keep MY station running, profit secondary
```

### 2. Corporation Logistics (25% of trade)

Corporations optimize across their portfolio:

```
Teladi Company owns: Trading Station, Shipyard, Foundry
  → Fleet of 5 ships moves goods between them
  → Sells surplus to external buyers
  → Buys shortfalls from external sellers
  
Priority: Inter-company efficiency, then external trade
```

### 3. Independent Traders (25% of trade)

Pure profit seekers with no station loyalty:

```
Freelance Vulture "Profit Seeker VII"
  → Scans sector prices across 4-5 sector range
  → Buys low, sells high, anywhere
  → No home station, just a home sector
  
Priority: Maximum profit per trip
```

### 4. Guild Trade (10% of trade)

Cooperatives share ships and routes:

```
Sunward Consortium (3 Solar Power Plants in different sectors)
  → Pool of 4 shared freighters
  → Routes assigned by guild logic
  → Profits split by contribution
  
Priority: Mutual benefit of guild members
```

---

## Dynamic Growth

### How New Entities Spawn

**New Traders:**
- When profit margins stay high in a sector, attract new traders
- Independent pilots "graduate" from working on stations to owning ships
- Guilds expand fleet when trade volume justifies it

**New Stations:**
- When prices for a ware stay high, entrepreneurs build production
- Corporations expand into underserved sectors
- Player can build anywhere (with money)

**Failures:**
- Stations with prolonged losses get abandoned (become derelicts)
- Traders with repeated losses sell ships, become crew
- Corporations divest unprofitable stations

### Growth Triggers

```typescript
interface GrowthEvent {
  type: 'spawn_trader' | 'spawn_station' | 'expand_fleet' | 'close_station' | 'sell_ship'
  trigger: string  // e.g., "profit_margin > 0.3 for 30 ticks"
  probability: number
  cooldown: number
}

const GROWTH_RULES: GrowthEvent[] = [
  // High margins attract traders
  { type: 'spawn_trader', trigger: 'sector.avgMargin > 0.25', probability: 0.02, cooldown: 300 },
  
  // Sustained shortage triggers new production
  { type: 'spawn_station', trigger: 'ware.shortage > 0.5 for 100 ticks', probability: 0.01, cooldown: 1000 },
  
  // Profitable stations expand fleets
  { type: 'expand_fleet', trigger: 'station.profit > 10000 and fleet.utilization > 0.9', probability: 0.05, cooldown: 500 },
  
  // Losses cause closure
  { type: 'close_station', trigger: 'station.losses > 5000 for 200 ticks', probability: 0.02, cooldown: 2000 },
]
```

---

## Data Structures

### Corporation

```typescript
interface Corporation {
  id: string
  name: string
  race: 'argon' | 'boron' | 'paranid' | 'split' | 'teladi' | 'pirate'
  type: 'mega-corp' | 'guild' | 'family' | 'state' | 'independent'
  
  // Assets
  stationIds: string[]
  fleetIds: string[]
  
  // Finances
  credits: number
  netWorth: number
  
  // Behavior
  aggressiveness: number    // 0-1, how competitive in pricing
  expansionBudget: number   // Credits reserved for growth
  riskTolerance: number     // 0-1, willingness to trade in danger zones
}
```

### Station with Ownership

```typescript
interface Station {
  id: string
  name: string
  sectorId: string
  recipeId: string
  
  // Ownership
  ownerId: string           // Corporation ID
  ownerType: OwnershipType
  
  // Economics
  inventory: Record<string, number>
  reorderLevel: Record<string, number>
  reserveLevel: Record<string, number>
  priceBands: Record<string, { min: number; max: number }>
  
  // Fleet
  ownedFleetIds: string[]   // Ships that belong to this station
  
  // Financials
  credits: number
  lifetimeProfit: number
  recentProfit: number      // Last N ticks
}
```

### Fleet with Ownership

```typescript
interface NPCFleet {
  id: string
  name: string
  shipType: string
  modelPath: string
  
  // Ownership
  ownerId: string           // Corporation ID
  ownerType: OwnershipType
  homeStationId?: string    // If station-owned
  
  // Behavior
  behavior: FleetBehavior
  assignedRouteId?: string  // For guild-assigned
  
  // Autonomy
  autonomy: number          // 0-1, how much freedom in route selection
  profitShare: number       // % of profit kept vs sent to owner
  
  // ... rest of fleet state
}
```

---

## Initial Setup for Teladi Sectors

### Corporations

```typescript
const TELADI_CORPORATIONS: Corporation[] = [
  {
    id: 'teladi_company',
    name: 'Teladi Company',
    race: 'teladi',
    type: 'mega-corp',
    stationIds: ['sz_trading', 'sz_shipyard', 'sz_equip', 'tg_trading', 'ps_trading', 'gp_trading'],
    fleetIds: ['tc_fleet_01', 'tc_fleet_02', 'tc_fleet_03'],
    credits: 5_000_000,
    aggressiveness: 0.4,
    expansionBudget: 500_000,
    riskTolerance: 0.3
  },
  {
    id: 'sunward_consortium',
    name: 'Sunward Consortium',
    race: 'teladi',
    type: 'guild',
    stationIds: ['sz_spp_b', 'ps_spp'],
    fleetIds: ['sc_fleet_01', 'sc_fleet_02'],
    credits: 800_000,
    aggressiveness: 0.5,
    expansionBudget: 100_000,
    riskTolerance: 0.4
  },
  {
    id: 'family_zhikkt',
    name: "Family Zhi'kkt",
    race: 'teladi',
    type: 'family',
    stationIds: ['sz_spp_d', 'sz_flower_b'],
    fleetIds: ['fz_fleet_01'],
    credits: 300_000,
    aggressiveness: 0.6,
    expansionBudget: 50_000,
    riskTolerance: 0.5
  },
  {
    id: 'crimson_commerce',
    name: 'Crimson Commerce Guild',
    race: 'teladi',
    type: 'guild',
    stationIds: ['sz_ire'],
    fleetIds: ['cc_fleet_01'],
    credits: 1_200_000,
    aggressiveness: 0.7,
    expansionBudget: 200_000,
    riskTolerance: 0.6
  },
  // Independent stations
  {
    id: 'trader_gekko',
    name: 'Gekko Enterprises',
    race: 'teladi',
    type: 'independent',
    stationIds: ['sz_flower_g'],
    fleetIds: [],  // No ships, relies on traders
    credits: 50_000,
    aggressiveness: 0.8,
    expansionBudget: 10_000,
    riskTolerance: 0.7
  },
]
```

### Initial Fleets

```typescript
const INITIAL_FLEETS: NPCFleet[] = [
  // Teladi Company logistics
  { id: 'tc_fleet_01', name: 'TC Profit Runner I', ownerId: 'teladi_company', behavior: 'corp-logistics', ... },
  { id: 'tc_fleet_02', name: 'TC Profit Runner II', ownerId: 'teladi_company', behavior: 'corp-logistics', ... },
  { id: 'tc_fleet_03', name: 'TC Trade Venture', ownerId: 'teladi_company', behavior: 'freelance', autonomy: 0.8, ... },
  
  // Sunward Consortium (Solar Power Plants)
  { id: 'sc_fleet_01', name: 'Sunward Hauler', ownerId: 'sunward_consortium', behavior: 'station-supply', homeStationId: 'sz_spp_b', ... },
  { id: 'sc_fleet_02', name: 'Sunward Trader', ownerId: 'sunward_consortium', behavior: 'guild-assigned', ... },
  
  // Family Zhi'kkt
  { id: 'fz_fleet_01', name: "Zhi'kkt Fortune", ownerId: 'family_zhikkt', behavior: 'station-distribute', homeStationId: 'sz_spp_d', ... },
  
  // Independent traders (no station owner)
  { id: 'indie_01', name: 'Lone Profit VII', ownerId: 'indie_gekko', behavior: 'freelance', autonomy: 1.0, ... },
  { id: 'indie_02', name: 'Margin Hunter', ownerId: null, behavior: 'freelance', autonomy: 1.0, ... },
  { id: 'indie_03', name: 'Quick Credit', ownerId: null, behavior: 'freelance', autonomy: 1.0, ... },
]
```

---

## Trade Decision Logic

### Station-Supply Behavior

```typescript
function stationSupplyTick(fleet: NPCFleet, universe: Universe) {
  const homeStation = universe.stations.get(fleet.homeStationId)
  if (!homeStation) return idleBehavior(fleet)
  
  // Find what my station needs
  const needs = getStationNeeds(homeStation)
  if (needs.length === 0) return idleBehavior(fleet)
  
  // Sort by urgency (how far below reorder level)
  needs.sort((a, b) => b.urgency - a.urgency)
  
  // Find best seller for most urgent need
  const topNeed = needs[0]
  const sellers = findSellersFor(topNeed.wareId, fleet.currentSectorId, MAX_RANGE)
  
  if (sellers.length === 0) {
    // No sellers, go home and wait
    return goHome(fleet)
  }
  
  // Pick cheapest within range
  const bestSeller = sellers.sort((a, b) => a.price - b.price)[0]
  return createBuyOrder(fleet, bestSeller, topNeed.wareId, topNeed.quantity)
}
```

### Freelance Behavior

```typescript
function freelanceTick(fleet: NPCFleet, universe: Universe) {
  // Pure profit-seeking
  const routes = findAllTradeRoutes(fleet.currentSectorId, MAX_RANGE)
  
  // Score by profit per time
  const scored = routes.map(r => ({
    ...r,
    score: r.profit / (r.travelTime + r.loadTime)
  }))
  
  scored.sort((a, b) => b.score - a.score)
  
  if (scored.length === 0 || scored[0].score < MIN_PROFIT_THRESHOLD) {
    // No good routes, wander to new sector
    return wanderToNewSector(fleet)
  }
  
  return executeRoute(fleet, scored[0])
}
```

---

## Summary

The economy is layered:

1. **Ownership creates motivation** - Corps optimize portfolios, families protect legacy, independents chase profit
2. **Fleets serve owners** - Station-owned ships prioritize their station, corp fleets optimize network, freelancers chase margins
3. **Dynamic growth** - Success breeds expansion, failure breeds contraction
4. **Emergent complexity** - The messy interaction of all these actors creates a living economy

This gives us both **lore consistency** (Teladi families, guilds, the Company) and **gameplay dynamics** (shortages, opportunities, competition).
