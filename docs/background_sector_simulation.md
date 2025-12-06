# Background Sector Simulation Design

## Overview

When the player is only present in one sector, all other sectors in the universe still need to "live" - stations produce goods, prices fluctuate, NPC ships trade, and events occur. This document outlines the architecture for simulating off-screen sectors efficiently.

## Implementation Status

### ✅ Completed
- **Types defined**: `src/types/simulation.ts` - Fleet, Event, TradeLog types
- **Store extended**: `src/store/gameStore.ts` - Fleet state, sync functions, sector view helper
- **Admin UI**: Economy Admin now has Fleets tab showing active fleets, states, cargo, transit progress
- **Design document**: This file with architecture decisions

### 🔲 Next Steps
1. Extend `vite.config.ts` universe plugin with fleet simulation loop
2. Initialize fleets on universe init
3. Implement trade route finding
4. Add fleet state machine (idle → loading → transit → unloading)
5. Wire up SectorMap2D to show live fleet positions
6. Add fleet spawning when player enters sector

## Current State (4 Sectors)

Currently implemented sectors:
- `seizewell` - Full visual layout with stations, ships, gates
- `teladi_gain` - Full visual layout
- `profit_share` - Full visual layout  
- `greater_profit` - Full visual layout

The economy simulation in `vite.config.ts` already runs globally across all sectors, ticking station production and updating prices regardless of player location.

---

## Architecture: Two-Tier Simulation

### Tier 1: Active Sector (Player Present)
Full 3D simulation with:
- Visual rendering of all objects
- Physics collision detection
- AI ships with pathfinding and obstacle avoidance
- Real-time visual station rotation
- Particle effects, engine plumes, lighting

### Tier 2: Background Sectors (Player Absent)
Lightweight simulation with:
- Economic production cycles (already exists)
- Abstract NPC fleet movements
- Event generation
- State persisted for when player arrives

---

## Background Simulation Components

### 1. Station Production (✅ Exists)
Located in `vite.config.ts` universe plugin:
```ts
// Runs every tick for ALL stations regardless of sector
for (const st of nextStations) {
  const canRun = r.inputs.every(x => st.inventory[x.wareId] >= x.amount)
  if (canRun) {
    // consume inputs, produce outputs
  }
}
```

### 2. NPC Trader Fleets (🔲 To Build)

**Data Structure:**
```ts
interface NPCFleet {
  id: string
  name: string
  shipType: string           // Model/class e.g. "mercury", "vulture"
  capacity: number           // Cargo capacity in m³
  speed: number              // Sector traversal speed
  homeSectorId: string       // Base sector
  currentSectorId: string    // Where they are now
  
  // Movement state
  state: 'idle' | 'loading' | 'in-transit' | 'unloading'
  destinationSectorId?: string
  departureTime?: number     // When they left current sector
  arrivalTime?: number       // When they arrive at destination
  
  // Trade state
  cargo: Record<string, number>  // wareId -> amount
  currentOrder?: TradeOrder
}

interface TradeOrder {
  buyStationId: string
  buyWareId: string
  buyQty: number
  buyPrice: number
  sellStationId: string
  sellWareId: string
  sellQty: number
  sellPrice: number
  profit: number
}
```

**Fleet AI Logic (per tick):**
```ts
function tickFleet(fleet: NPCFleet, universe: UniverseState, deltaSeconds: number) {
  switch (fleet.state) {
    case 'idle':
      // Find best trade route from current sector
      const order = findBestTradeOrder(fleet, universe)
      if (order) {
        fleet.currentOrder = order
        // If buy station in current sector, start loading
        // Else, start transit to buy sector
      }
      break
      
    case 'in-transit':
      if (Date.now() >= fleet.arrivalTime!) {
        fleet.currentSectorId = fleet.destinationSectorId!
        fleet.state = cargo empty ? 'loading' : 'unloading'
      }
      break
      
    case 'loading':
      // Transfer goods from station to fleet
      // Once complete, transit to sell sector
      break
      
    case 'unloading':
      // Transfer goods from fleet to station
      // Collect payment, return to idle
      break
  }
}
```

### 3. Trade Route Selection

```ts
function findBestTradeOrder(fleet: NPCFleet, universe: UniverseState): TradeOrder | null {
  const candidates: TradeOrder[] = []
  
  // For each ware, find stations that want to sell vs buy
  for (const ware of universe.wares) {
    const sellers = findSellingStations(ware.id, universe)
    const buyers = findBuyingStations(ware.id, universe)
    
    for (const seller of sellers) {
      for (const buyer of buyers) {
        const buyPrice = getSectorPrice(seller.sectorId, ware.id)
        const sellPrice = getSectorPrice(buyer.sectorId, ware.id)
        const travelCost = calculateTravelCost(seller.sectorId, buyer.sectorId)
        const qty = Math.min(fleet.capacity / ware.volume, seller.surplus, buyer.demand)
        const profit = (sellPrice - buyPrice - travelCost) * qty
        
        if (profit > 0) {
          candidates.push({ 
            buyStationId: seller.id, 
            sellStationId: buyer.id,
            profit,
            // ...
          })
        }
      }
    }
  }
  
  // Pick highest profit route within range
  return candidates.sort((a, b) => b.profit - a.profit)[0] ?? null
}
```

### 4. Sector Transition Time

Travel between sectors isn't instant:
```ts
function calculateTravelTime(fromSector: string, toSector: string, speed: number): number {
  const distance = getSectorDistance(fromSector, toSector)  // In jumps
  const timePerJump = 120  // Base seconds per gate jump
  return distance * timePerJump / speed
}

function getSectorDistance(from: string, to: string): number {
  // BFS on sector graph to find jump count
  // Use UNIVERSE_SECTORS_XBTF neighbors
}
```

### 5. Spawning Ships When Player Arrives

When player enters a sector, any NPC fleets currently "in" that sector materialize:

```ts
function onPlayerEnterSector(sectorId: string, universe: UniverseState) {
  const fleetsHere = universe.fleets.filter(f => 
    f.currentSectorId === sectorId && f.state !== 'in-transit'
  )
  
  for (const fleet of fleetsHere) {
    // Spawn visual AIShip component at appropriate position
    // If loading/unloading, spawn near their target station
    // If idle, spawn at random nav point
  }
}
```

### 6. Background Events

Events that occur in non-player sectors:

```ts
interface SectorEvent {
  id: string
  sectorId: string
  type: 'shortage' | 'surplus' | 'pirate_raid' | 'station_destroyed' | 'new_station'
  wareId?: string
  severity: number
  startTime: number
  duration: number
}

function tickEvents(universe: UniverseState, deltaSeconds: number) {
  // Random event generation based on sector risk
  for (const sector of universe.sectors) {
    if (Math.random() < sector.risk * deltaSeconds / 3600) {
      generateEvent(sector)
    }
  }
  
  // Apply active event effects
  for (const event of universe.activeEvents) {
    applyEventEffects(event, universe)
  }
}
```

---

## Implementation Phases

### Phase 1: Fleet Data Model
- Add `NPCFleet[]` to universe state
- Define initial fleets per race/sector
- Persist fleet state

### Phase 2: Fleet AI Loop
- Implement trade route finding
- Implement state machine (idle → loading → transit → unloading)
- Integrate with production tick

### Phase 3: Sector Materialization
- Hook into sector transition
- Spawn AIShip components for present fleets
- Handle fleet departure (player watches ship leave)

### Phase 4: Events System
- Random event generation
- Event effects on prices/production
- Player notification of off-screen events

### Phase 5: Scale & Balance
- Tune fleet counts per sector
- Balance travel times
- Ensure economy reaches equilibrium

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Universe State (Server)                     │
├─────────────────────────────────────────────────────────────────┤
│  Stations[]  │  Fleets[]  │  Events[]  │  SectorPrices{}       │
└──────┬───────┴─────┬──────┴──────┬─────┴───────────────────────┘
       │             │             │
       ▼             ▼             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Background Tick (1s interval)                  │
├──────────────────────────────────────────────────────────────────┤
│  1. Station production cycles                                     │
│  2. Fleet AI decisions & movement                                 │
│  3. Event generation & effects                                    │
│  4. Price recalculation                                           │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Client (React/Three.js)                        │
├──────────────────────────────────────────────────────────────────┤
│  Active Sector Only:                                              │
│  - Render stations, ships, effects                                │
│  - AIShip components for fleets in current sector                 │
│  - Physics, collisions, player interaction                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Optimization Strategies

### 1. Temporal Batching
Don't tick every fleet every second. Instead:
```ts
// Only process fleets that have pending state changes
const activeFleets = fleets.filter(f => 
  f.state === 'in-transit' && Date.now() >= f.arrivalTime ||
  f.state === 'idle' ||
  f.currentSectorId === playerSectorId
)
```

### 2. Lazy Price Calculation
Only recalculate sector prices when:
- A station's inventory changes significantly (>10%)
- An event starts/ends
- Player queries that sector's data

### 3. Fleet Pooling
Pre-allocate fleet objects and reuse rather than create/destroy:
```ts
const FLEET_POOL_SIZE = 200
const fleetPool: NPCFleet[] = new Array(FLEET_POOL_SIZE).fill(null).map(() => createFleet())
```

### 4. Skip Tick for Stable Sectors
If a sector has no:
- Active fleets
- Running production cycles
- Active events

...it can be skipped entirely that tick.

---

## Persistence

Fleet and event state persists in `user-data.json`:
```ts
interface SaveData {
  // Existing
  currentSectorId: string
  position: [number, number, number]
  
  // New
  fleets: NPCFleet[]
  activeEvents: SectorEvent[]
  stationInventories: Record<string, Record<string, number>>
  lastTickTime: number  // For catch-up simulation on load
}
```

### Catch-Up Simulation
When loading a save, fast-forward simulation:
```ts
function catchUpSimulation(saveData: SaveData, universe: UniverseState) {
  const elapsed = Date.now() - saveData.lastTickTime
  const tickCount = Math.floor(elapsed / 10000)  // 10s ticks
  
  for (let i = 0; i < Math.min(tickCount, 360); i++) {  // Cap at 1 hour
    tickUniverse(universe, 10)
  }
}
```

---

## Example Fleet Distribution

Initial fleet counts per race territory:

| Race    | Freighters | Traders | Military |
|---------|------------|---------|----------|
| Argon   | 12         | 8       | 4        |
| Boron   | 10         | 6       | 5        |
| Paranid | 8          | 10      | 6        |
| Split   | 6          | 12      | 8        |
| Teladi  | 15         | 15      | 2        |
| Xenon   | 0          | 0       | 10       |
| Pirate  | 4          | 2       | 6        |

Freighters: Large cargo, slow, supply runs
Traders: Medium cargo, fast, opportunistic trades
Military: Patrol, respond to events

---

## Next Steps

1. **Create types file**: `src/types/simulation.ts`
2. **Extend universe plugin**: Add fleet state and tick
3. **Add fleet initialization**: Per-sector fleet spawning
4. **Build trade route finder**: Pathfinding + profit calculation
5. **Test with 2-3 sectors**: Verify economy flows correctly
6. **Add to gameStore**: Client-side fleet awareness
7. **Spawn on arrival**: Hook sector transition

---

## Questions to Answer

1. **How many fleets total?** Start with ~50, scale up
2. **Trade route visibility?** Show predicted routes on universe map?
3. **Player interaction?** Can player attack/scan/hail NPC traders?
4. **Fleet respawn?** If destroyed, how do new fleets appear?
5. **Gate congestion?** Limit ships per gate per tick?

---

## Remote Sector Viewing (Universe Map → Sector Preview)

When the player views a sector via Universe Map → SectorMap2D, they need to see **live** activity, not just static station positions.

### Current Flow
1. Player opens Universe Map (`U` key)
2. Clicks on a sector → `setSelectedSectorId(id)`
3. SectorMap2D opens with `selectedSectorId !== currentSectorId`
4. `getSectorLayoutById()` provides static station/gate positions
5. Map renders static objects (no ships, no movement)

### Enhanced Flow
1. Same as above, but...
2. SectorMap2D fetches fleet positions from universe state
3. Fleets in that sector render as moving blips
4. Fleet state (loading/unloading/idle) shown in sidebar
5. Updates every ~500ms to show movement

### Data Needed for Remote View
```ts
interface SectorViewData {
  stations: { name: string; position: [number,number,number]; inventory: Record<string,number> }[]
  gates: { name: string; position: [number,number,number]; destination: string }[]
  fleets: {
    id: string
    name: string
    shipType: string
    position: [number, number, number]  // Interpolated position within sector
    state: 'idle' | 'loading' | 'unloading' | 'docking' | 'undocking'
    targetStation?: string
    cargo: Record<string, number>
  }[]
  fleetsInTransit: {
    id: string
    name: string
    fromSector: string
    toSector: string
    progress: number  // 0-1
    eta: number       // seconds
  }[]
}
```

### Fleet Position Interpolation

When a fleet is inside a sector but not docked:
```ts
function getFleetPosition(fleet: NPCFleet, sector: SectorLayout): [number, number, number] {
  if (fleet.state === 'loading' || fleet.state === 'unloading') {
    // Position near target station
    const station = sector.stations.find(s => s.name === fleet.targetStation)
    if (station) {
      return [
        station.position[0] + 50 + fleet.id.charCodeAt(0) % 30,
        station.position[1] + 10,
        station.position[2] + 50 + fleet.id.charCodeAt(1) % 30
      ]
    }
  }
  
  if (fleet.state === 'idle') {
    // Patrol near center or random nav point
    const t = Date.now() / 10000
    const r = 200 + (fleet.id.charCodeAt(0) % 100)
    return [
      Math.cos(t + fleet.id.charCodeAt(0)) * r,
      0,
      Math.sin(t + fleet.id.charCodeAt(1)) * r
    ]
  }
  
  return [0, 0, 0]
}
```

---

## Economy Admin Enhancements

Expand the admin page to show active fleet tasks:

### New Panel: Active Fleets

| Fleet | Ship Type | Sector | State | Task | Progress |
|-------|-----------|--------|-------|------|----------|
| Teladi Trader 1 | Vulture | seizewell | loading | Buy Energy @ SPP | ██████░░ 75% |
| Argon Freighter 3 | Mercury | in-transit | -- | seizewell → profit_share | ████░░░░ 50% |
| Split Hauler 2 | Caiman | profit_share | unloading | Sell Crystals @ TTS | ███░░░░░ 35% |

### New Panel: Trade Routes

Show active and potential trade routes:

| Route | Ware | Buy @ | Sell @ | Margin | Fleets |
|-------|------|-------|--------|--------|--------|
| seizewell→profit_share | Energy | 14 | 22 | +8 | 2 |
| profit_share→teladi_gain | Crystals | 1500 | 1800 | +300 | 1 |

### New Panel: Sector Overview

For selected sector filter, show:
- Total fleets present: X
- Fleets loading: X  
- Fleets unloading: X
- Fleets in transit TO: X
- Fleets in transit FROM: X
- Recent trades (last 5 transactions)
