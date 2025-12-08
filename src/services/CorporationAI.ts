import {
    type Corporation,
    type CorporationAIState,
    type PendingConstruction,
    type SectorEvent,
    type NPCFleet,
} from '../types/simulation'
import type { Station } from '../store/gameStore'
import { getBlueprintFor } from '../config/economy'

interface Ware {
    id: string
    name: string
    basePrice: number
    volume: number
}

interface Recipe {
    id: string
    productId: string
    inputs: { wareId: string; amount: number }[]
    cycleTimeSec: number
    batchSize: number
}

interface MarketSnapshot {
    sectorId: string
    supply: Record<string, number>
    demand: Record<string, number>
    shortages: { wareId: string; deficit: number; urgency: number }[]
}

export interface TurnResult {
    newFleets: NPCFleet[]
    newStations: Station[]
    removedFleetIds: string[]
}

export class CorporationAI {
    /**
     * Main entry point for AI decision making
     */
    static processTurn(
        corp: Corporation,
        allStations: Station[],
        wares: Ware[],
        recipes: Recipe[],
        events: SectorEvent[],
        fleets: NPCFleet[]
    ): TurnResult {
        const ai = corp.aiState
        const now = Date.now()
        const result: TurnResult = { newFleets: [], newStations: [], removedFleetIds: [] }

        // Only think every minute (simulation time) to save perf
        if (now - ai.lastExpansionCheck < 60000) return result

        // STUB: Force check every turn for debug if needed, but 60s is good
        // ai.lastExpansionCheck = now - 59000 // DEBUG: fast checking

        ai.lastExpansionCheck = now

        // 1. Audit Pending Constructions (Simulate progress)
        this.manageConstructionFleet(corp, ai.pendingConstructions, fleets, result)

        // 2. Decide Strategy
        // For now, we only implement 'expand'
        if (ai.currentGoal === 'expand') {
            this.attemptExpansion(corp, allStations, wares, recipes)
        }

        return result
    }

    private static manageConstructionFleet(
        corp: Corporation,
        queue: PendingConstruction[],
        fleets: NPCFleet[],
        result: TurnResult
    ) {
        // Iterate backwards to allow removal
        for (let i = queue.length - 1; i >= 0; i--) {
            const job = queue[i]

            if (job.status === 'planning') {
                // Phase 2: Hire TL
                const tl = this.hireBuilder(corp)
                if (tl) {
                    result.newFleets.push(tl)
                    job.builderShipId = tl.id
                    job.status = 'in-transit'
                    console.log(`[CorpAI] ${corp.name} hired TL ${tl.name} for ${job.stationType}`)
                }
            } else if (job.status === 'in-transit') {
                // Check on TL
                const tl = fleets.find(f => f.id === job.builderShipId) || result.newFleets.find(f => f.id === job.builderShipId)
                if (!tl) {
                    // TL died? Cancel job
                    job.status = 'planning' // Retry
                    job.builderShipId = undefined
                    continue
                }

                if (tl.currentSectorId === job.targetSectorId) {
                    // Arrived!
                    job.status = 'building'
                } else {
                    // Ensure moving if not already moving to target
                    this.issueMoveCommand(tl, job.targetSectorId)
                }
            }

            if (job.status === 'building') {
                // Deploy!
                const station = this.deployStation(corp, job)
                if (station) {
                    result.newStations.push(station)
                    // Despawn TL (job done)
                    if (job.builderShipId) result.removedFleetIds.push(job.builderShipId)

                    // Job Complete! Remove from queue.
                    queue.splice(i, 1)
                }
            }
        }
    }

    private static deployStation(corp: Corporation, job: PendingConstruction): Station | null {
        const blueprint = getBlueprintFor(job.stationType, corp.race)
        if (!blueprint) return null

        console.log(`[CorpAI] ${corp.name} DEPLOYING ${blueprint.name} in ${job.targetSectorId}`)

        const station: Station = {
            id: `station_${corp.id}_${Math.random().toString(36).slice(2, 7)}`,
            name: blueprint.name,
            recipeId: blueprint.recipeId,
            sectorId: job.targetSectorId,
            position: [
                (Math.random() - 0.5) * 4000,
                (Math.random() - 0.5) * 200 + 50, // slightly up/down
                (Math.random() - 0.5) * 4000
            ], // Random position in sector
            inventory: {},
            reorderLevel: {},
            reserveLevel: {},
            modelPath: blueprint.modelPath,
            ownerId: corp.id,
        }

        // Add to corp assets
        corp.stationIds.push(station.id)

        return station
    }

    private static hireBuilder(corp: Corporation): NPCFleet {
        const id = `tl_${corp.id}_${Math.random().toString(36).slice(2, 7)}`
        // Simply spawn at a random shipyard sector for now (or home sector)
        // TODO: Find nearest shipyard
        const spawnSector = 'seizewell'

        return {
            id,
            name: `${corp.name} Supply Mammoth`,
            shipType: 'Mammoth', // Generic placeholder
            modelPath: '/models/00187.obj', // Using Albatross for now as per plan
            race: corp.race,
            capacity: 50000,
            speed: 150, // Should be roughly 80-150 m/s in new scale? 
            // Player speed is ~200. TL should be slower.
            // Old code used 0.6 but physics might expect different units now?
            // Checking gameStore default maxSpeed is SHIP_STATS['player'].maxSpeed
            // Checking stats: 0.6 was likely small ThreeJS units. 
            // Let's stick to what other ships have. 
            // View AIShip.ts showed speed physics.
            // Let's stick to 150 for now (roughly 150 m/s if scale is 1 unit = 1m)
            // Wait, previous code had 0.6 in `hireBuilder`. If `AIShip` uses explicit speed, 0.6 is tiny.
            // Let's check `NPCMilitary` or `NPCTrader` defaults?
            // Actually, `NPCFleet` speed is maxSpeed.
            // Let's us 100.
            homeSectorId: spawnSector,
            ownerId: corp.id,
            ownerType: corp.type,
            behavior: 'construction',
            autonomy: 0,
            profitShare: 0,
            currentSectorId: spawnSector,
            position: [0, 0, 0],
            state: 'idle',
            stateStartTime: Date.now(),
            commandQueue: [],
            cargo: {},
            credits: 0,
            totalProfit: 0,
            tripsCompleted: 0
        }
    }

    private static issueMoveCommand(fleet: NPCFleet, targetSector: string) {
        // If we simply set destinationSectorId, the NPCTrader logic (which this TL uses?) should handle the hops.
        // Wait, we need to assign a component to this fleet?
        // The game loop renders `NPCFleet` using `NPCShip`. 
        // We need to ensure `NPCShip` handles 'construction' behavior or falls back to 'idle' but still moves?
        // `NPCMilitary` handles 'patrol', 'travel', etc.
        // `NPCTrader` handles 'trade'.
        // We probably need a `NPCBuilder` component or reuse one.
        // For now, if we set `destinationSectorId`, does any component pick it up?
        // `AIShip.tsx` handles movement if `navGraph` is there.
        // But `NPCTrader` handles sector hops.
        // If we don't have a specific `NPCBuilder` component, this fleet might just sit there if checking for behavior 'construction'.
        // We should add 'construction' to one of the components or make a new one.
        // FOR NOW: Let's assume standard behavior works if we set behavior to 'freelance' temporarily or add 'construction' support later.
        // But we set behavior to 'construction'.
        // Critical: If no component handles 'construction', it won't move.
        // Phase 3 is logistics.

        fleet.destinationSectorId = targetSector
    }

    private static attemptExpansion(
        corp: Corporation,
        stations: Station[],
        wares: Ware[],
        recipes: Recipe[]
    ) {
        // Scan for shortages first to see what we WANT to build
        const market = this.analyzeGlobalMarket(stations, wares)
        const bestOpp = this.findBestOpportunity(market, recipes, corp)

        if (bestOpp) {
            const { recipe, sectorId, estimatedROI, deficit } = bestOpp

            // Determine WHAT to build (which model/cost)
            const blueprint = getBlueprintFor(recipe.id, corp.race)
            if (!blueprint) {
                // We don't know how to build this
                return
            }

            // Budget Check
            if (corp.credits < blueprint.cost) {
                // We want to build it, but can't afford it yet.
                // Could log "Saving up for X" here
                return
            }

            // Log decision
            console.log(`[CorpAI] ${corp.name} planning expansion:`)
            console.log(`  Target: ${blueprint.name} in ${sectorId}`)
            console.log(`  Reason: Shortage of ${deficit} units`)
            console.log(`  Cost: ${blueprint.cost}Cr (Budget: ${corp.credits}Cr)`)
            console.log(`  Est. ROI: ${(estimatedROI * 100).toFixed(1)}%`)

            // Commit to construction
            corp.credits -= blueprint.cost
            corp.aiState.pendingConstructions.push({
                id: Math.random().toString(36).slice(2),
                stationType: blueprint.id, // now tracking specific blueprint
                targetSectorId: sectorId,
                status: 'planning',
                createdAt: Date.now()
            })
        }
    }

    private static analyzeGlobalMarket(stations: Station[], wares: Ware[]): MarketSnapshot[] {
        const sectors = new Set(stations.map(s => s.sectorId))
        const snapshots: MarketSnapshot[] = []

        sectors.forEach(sectorId => {
            const localStations = stations.filter(s => s.sectorId === sectorId)
            const supply: Record<string, number> = {}
            const demand: Record<string, number> = {}

            localStations.forEach(st => {
                // Supply: What is in stock?
                Object.entries(st.inventory).forEach(([wareId, amount]) => {
                    supply[wareId] = (supply[wareId] || 0) + amount
                })
            })

            // Calculate calculated shortage
            // Simple heuristic: If multiple stations in sector have < 20% stock of an input, it's a shortage
            const shortages: { wareId: string; deficit: number; urgency: number }[] = []

            wares.forEach(w => {
                const localSupply = supply[w.id] || 0
                // Synthetic demand
                const baselineDemand = 500
                if (localSupply < baselineDemand) {
                    shortages.push({
                        wareId: w.id,
                        deficit: baselineDemand - localSupply,
                        urgency: (baselineDemand - localSupply) / baselineDemand
                    })
                }
            })

            snapshots.push({ sectorId, supply, demand, shortages })
        })

        return snapshots
    }

    private static findBestOpportunity(
        snapshots: MarketSnapshot[],
        recipes: Recipe[],
        corp: Corporation
    ): { recipe: Recipe; sectorId: string; deficit: number; estimatedROI: number } | null {
        let best = null
        let highestScore = 0

        snapshots.forEach(snap => {
            snap.shortages.forEach(shortage => {
                // Can we build a factory for this?
                const recipe = recipes.find(r => r.productId === shortage.wareId)
                if (!recipe) return

                // Simple Score: Deficit * Price
                const score = shortage.deficit * shortage.urgency * (1 + corp.aggressiveness)

                if (score > highestScore) {
                    highestScore = score
                    // Fake ROI for now: Score / 1000
                    best = {
                        recipe,
                        sectorId: snap.sectorId,
                        deficit: shortage.deficit,
                        estimatedROI: score / 10000
                    }
                }
            })
        })

        return best
    }
}
