import { Vector3 } from 'three';
import { useGameStore } from '../store/gameStore';
import type { NPCFleet, ShipReportType, FleetBehavior } from '../types/simulation';
import type { NavGraph, NavObstacle } from '../ai/navigation';
import { findPath, buildNavNodesFromLayout, buildNavGraph } from '../ai/navigation';
import { findNextHop } from '../ai/universePathfinding';
import { getSectorLayoutById } from '../config/sector';

import { updateFleetPosition } from '../store/fleetPositions';

// Simulation Constants
const ARRIVAL_DISTANCE = 50;
const DOCK_HOLD_DAMPING = 0.9;
const BRAKE_DISTANCE = 300;
const BRAKE_DISTANCE_LARGE = 600;

// Base Stats
const STATS = {
    trader: { accel: 15, speed: 180, turn: 1.5, physics: 1.0 },
    military: { accel: 20, speed: 220, turn: 2.0, physics: 1.2 },
    builder: { accel: 12, speed: 240, turn: 0.6, physics: 1.0 }, // Heavy TLs need faster gate runs
};

interface FleetRuntimeState {
    fleetId: string;
    velocity: Vector3;
    path: Vector3[];
    pathIndex: number;
    nextRepathAt: number;
    lastProgress: { time: number; pos: Vector3; stuckTime: number };
    dockAnchor: Vector3 | null;
    dockStationId?: string;
    holdDock: boolean;
    idleAnchor: Vector3 | null;
    localState: 'idle' | 'flying-to-station' | 'flying-to-gate' | 'docking' | 'docked' | 'loading' | 'unloading' | 'undocking' | 'entering-gate' | 'patrolling' | 'in-transit' | 'gone';
    currentCommandIndex: number;
    actionTimer: number;
    lastReport: string;
    lastPositionReportTime: number;
    lastStoreUpdateTime: number;
    behavior: FleetBehavior;
    lastQueueFirstId?: string; // To detect new orders from backend
}

interface SectorNavData {
    stationPositions: Map<string, [number, number, number]>;
    gatePositions: { position: [number, number, number]; destinationSectorId: string; radius: number; gateType?: string }[];
    navGraph: NavGraph | null;
    obstacles: NavObstacle[];
}

export class FleetSimulator {
    private static instance: FleetSimulator;
    private states = new Map<string, FleetRuntimeState>();
    private navDataCache = new Map<string, SectorNavData>();

    // Throttle configs
    private readonly MAX_PATHFINDS_PER_FRAME = 2; // Strict limit on A* calls
    private readonly MAX_NAV_BUILDS_PER_FRAME = 1;
    private pathfindsThisFrame = 0;
    private navBuildsThisFrame = 0;

    constructor() {
        this.update = this.update.bind(this);
    }

    static getInstance(): FleetSimulator {
        if (!FleetSimulator.instance) {
            FleetSimulator.instance = new FleetSimulator();
        }
        return FleetSimulator.instance;
    }

    public getFleetState(fleetId: string): FleetRuntimeState | undefined {
        return this.states.get(fleetId);
    }

    // Called to ensure a fleet has a runtime state
    private ensureState(fleet: NPCFleet): FleetRuntimeState {
        if (!this.states.has(fleet.id)) {
            const newState: FleetRuntimeState = {
                fleetId: fleet.id,
                velocity: new Vector3(0, 0, 0),
                path: [],
                pathIndex: 0,
                nextRepathAt: 0,
                lastProgress: { time: Date.now(), pos: new Vector3(fleet.position[0], fleet.position[1], fleet.position[2]), stuckTime: 0 },
                dockAnchor: null,
                dockStationId: undefined,
                holdDock: false,
                idleAnchor: null,
                localState: 'idle',
                currentCommandIndex: 0,
                actionTimer: 0,
                lastReport: '',
                lastPositionReportTime: 0,
                lastStoreUpdateTime: 0,
                behavior: fleet.behavior,
                lastQueueFirstId: undefined
            };
            this.states.set(fleet.id, newState);
        }

        const state = this.states.get(fleet.id)!;

        // Detect new queue from backend
        const queue = fleet.commandQueue || [];
        if (queue.length > 0) {
            const firstId = queue[0].id;
            if (state.lastQueueFirstId !== firstId) {
                // New queue detected! Reset index.
                state.currentCommandIndex = 0;
                state.lastQueueFirstId = firstId;
            }
        } else {
            // If queue is empty, clear lastQueueFirstId
            state.lastQueueFirstId = undefined;
        }

        // Update behavior if changed
        state.behavior = fleet.behavior;
        return state;
    }

    private getSectorNavData(sectorId: string): SectorNavData | null {
        const economyStations = useGameStore.getState().stations;
        const cached = this.navDataCache.get(sectorId);

        // If we already built nav data, ensure station IDs from the economy are mapped.
        if (cached) {
            let needsUpdate = false;
            let stations = cached.stationPositions;
            let obstacles = cached.obstacles;

            for (const st of economyStations.filter(s => s.sectorId === sectorId)) {
                const existingPos = stations.get(st.id) || stations.get(st.name);
                // If the cache was built before stations were synced, we might only have the name key.
                if (existingPos && !stations.has(st.id)) {
                    if (!needsUpdate) {
                        stations = new Map(stations);
                        obstacles = [...obstacles];
                    }
                    stations.set(st.id, existingPos);
                    needsUpdate = true;
                } else if (!existingPos && st.position) {
                    if (!needsUpdate) {
                        stations = new Map(stations);
                        obstacles = [...obstacles];
                    }
                    stations.set(st.id, st.position);
                    stations.set(st.name, st.position);
                    obstacles.push({
                        id: `station-${st.name}`,
                        center: new Vector3(st.position[0], st.position[1], st.position[2]),
                        radius: 120,
                        label: st.name
                    });
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                const updated = { ...cached, stationPositions: stations, obstacles };
                this.navDataCache.set(sectorId, updated);
                return updated;
            }

            return cached;
        }

        if (this.navBuildsThisFrame >= this.MAX_NAV_BUILDS_PER_FRAME) return null;
        this.navBuildsThisFrame++;

        const layout = getSectorLayoutById(sectorId);
        if (!layout) return null;

        const spacing = 30;
        const place = (p: [number, number, number]): [number, number, number] => [p[0] * spacing, p[1] * spacing, p[2] * spacing];

        const stationPositions = new Map<string, [number, number, number]>();
        const obstacles: NavObstacle[] = [];
        const layoutByName = new Map<string, [number, number, number]>();

        for (const st of layout.stations) {
            const pos = place(st.position);
            layoutByName.set(st.name, pos);
            obstacles.push({
                id: `station-${st.name}`,
                center: new Vector3(pos[0], pos[1], pos[2]),
                radius: (st.scale ?? 24) * 5,
                label: st.name
            });
            // Legacy name mapping
            stationPositions.set(st.name, pos);
        }

        // Add dynamic stations from store
        for (const ec of economyStations.filter((s) => s.sectorId === sectorId)) {
            const layoutPos = layoutByName.get(ec.name);
            if (layoutPos) {
                stationPositions.set(ec.id, layoutPos);
                stationPositions.set(ec.name, layoutPos);
            } else if (ec.position) {
                stationPositions.set(ec.id, ec.position);
                stationPositions.set(ec.name, ec.position);
                obstacles.push({
                    id: `station-${ec.name}`,
                    center: new Vector3(ec.position[0], ec.position[1], ec.position[2]),
                    radius: 120,
                    label: ec.name
                })
            }
        }

        const gatePositions = layout.gates
            .filter((g) => g.destinationSectorId)
            .map((g) => {
                const pos = place(g.position) as [number, number, number];
                obstacles.push({
                    id: `gate-${g.name}`,
                    center: new Vector3(pos[0], pos[1], pos[2]),
                    radius: (g.scale ?? 40) * 6,
                    label: g.name
                });
                return {
                    position: pos,
                    destinationSectorId: g.destinationSectorId!,
                    radius: (g.scale ?? 40) * 5,
                    gateType: g.gateType,
                };
            });

        if (layout.planet) {
            obstacles.push({
                id: 'planet',
                center: new Vector3(layout.planet.position[0] * spacing, layout.planet.position[1] * spacing, layout.planet.position[2] * spacing),
                radius: layout.planet.size * 0.8,
                label: 'planet'
            });
        }

        const nodes = buildNavNodesFromLayout(layout, spacing);
        const navGraph = buildNavGraph(nodes, obstacles);

        const data = { stationPositions, gatePositions, navGraph, obstacles };
        this.navDataCache.set(sectorId, data);
        return data;
    }

    // --- Helpers ---
    private report(fleet: NPCFleet, state: FleetRuntimeState, type: ShipReportType, extra?: any) {
        const reportKey = `${type}-${extra?.stationId || ''}-${extra?.wareId || ''}`;
        if (type !== 'position-update') {
            if (state.lastReport === reportKey) return;
            state.lastReport = reportKey;
        }

        const pos: [number, number, number] = [fleet.position[0], fleet.position[1], fleet.position[2]];
        const sectorId = extra?.sectorIdOverride || fleet.currentSectorId;
        const stationId = extra?.stationId || state.dockStationId || fleet.targetStationId;

        const payload = {
            sectorId,
            position: pos,
            stationId,
            gateType: extra?.gateType,
            ...extra
        };

        useGameStore.getState().reportShipAction(fleet.id, type, payload);

        const positionUpdate: Partial<NPCFleet> = {
            position: pos,
            currentSectorId: sectorId,
            stateStartTime: Date.now(),
        };
        if (type === 'arrived-at-station') {
            positionUpdate.state = 'docking';
            positionUpdate.targetStationId = stationId;
        } else if (type === 'docked') {
            positionUpdate.state = 'idle';
            positionUpdate.targetStationId = stationId;
        } else if (type === 'undocked' || type === 'entered-sector') {
            // Stay "in-transit" if there are more commands or an active destination
            const queue = fleet.commandQueue || [];
            const hasNext = queue.length > state.currentCommandIndex + 1;
            if (type === 'entered-sector') {
                // Upon sector arrival, keep the fleet marked in-transit if there are remaining commands
                positionUpdate.state = (hasNext || fleet.destinationSectorId) ? 'in-transit' : 'idle';
                positionUpdate.destinationSectorId = fleet.destinationSectorId;
            } else {
                positionUpdate.state = (hasNext || fleet.destinationSectorId) ? 'in-transit' : 'idle';
                positionUpdate.targetStationId = undefined;
            }
        } else if (type === 'arrived-at-gate') {
            positionUpdate.state = 'in-transit';
        }

        useGameStore.setState((s) => ({
            fleets: s.fleets.map(f => f.id === fleet.id ? { ...f, ...positionUpdate } : f)
        }));
    }

    private syncState(fleet: NPCFleet, updates: Partial<NPCFleet>) {
        useGameStore.setState((s) => ({
            fleets: s.fleets.map(f => f.id === fleet.id ? { ...f, ...updates } : f)
        }));
    }

    private advanceCommand(fleet: NPCFleet, state: FleetRuntimeState, preserveDocked = false) {
        const queue = fleet.commandQueue || [];
        state.currentCommandIndex += 1;
        state.actionTimer = 0;
        if (state.currentCommandIndex >= queue.length) {
            this.report(fleet, state, 'queue-complete');
        }
        if (preserveDocked) {
            // Reset to docked state so undock command can execute
            state.localState = 'docked';
        } else {
            state.localState = 'idle';
        }
    }

    // --- Main Update ---
    public update(dt: number) {
        this.pathfindsThisFrame = 0;
        this.navBuildsThisFrame = 0;
        const now = performance.now();

        // Access store directly - this is fast unless subscribed
        const fleets = useGameStore.getState().fleets;

        for (const fleet of fleets) {
            const state = this.ensureState(fleet);

            // Reset old "gone" marker (legacy when ships left sector)
            if (state.localState === 'gone') {
                state.localState = 'idle';
                state.path = [];
                state.pathIndex = 0;
                state.dockAnchor = null;
                state.dockStationId = undefined;
            }

            // Reset if sector changed externally
            if (fleet.currentSectorId !== ((state as any)._lastSectorId)) {
                (state as any)._lastSectorId = fleet.currentSectorId;
                state.localState = 'idle';
                state.holdDock = false;
                state.dockAnchor = null;
                state.dockStationId = undefined;
            }

            // Logic Step
            this.updateFleetLogic(fleet, state, now);

            // Physics Step
            this.updateFleetPhysics(fleet, state, dt, now);
        }
    }

    private updateFleetLogic(fleet: NPCFleet, state: FleetRuntimeState, now: number) {
        if (state.localState === 'gone') return;

        const commands = fleet.commandQueue || [];
        // sync command index
        if (commands.length > 0 && state.currentCommandIndex >= commands.length) {
            state.currentCommandIndex = 0;
        }
        const command = commands[state.currentCommandIndex];

        if (!command) {
            if (state.localState !== 'idle') state.localState = 'idle';

            // Safety fallback
            if (fleet.destinationSectorId && state.localState === 'idle') {
                state.localState = 'flying-to-gate';
            }
            return;
        }

        const nav = this.getSectorNavData(fleet.currentSectorId || 'seizewell');
        if (!nav) return;

        // State Machine
        switch (command.type) {
            case 'trade-buy':
            case 'trade-sell':
            case 'goto-station':
                if (state.localState === 'idle') {
                    if (command.targetSectorId && command.targetSectorId !== fleet.currentSectorId) {
                        state.localState = 'flying-to-gate';
                        this.syncState(fleet, { state: 'in-transit' }); // Map to valid store state
                        this.buildPathToGate(fleet, state, nav, command.targetSectorId, now);
                    } else if (command.targetStationId) {
                        const pos = nav.stationPositions.get(command.targetStationId);
                        if (pos) {
                            state.localState = 'flying-to-station';
                            state.dockStationId = command.targetStationId;
                            this.syncState(fleet, { state: 'in-transit', targetStationId: command.targetStationId }); // Map to valid store state
                            state.dockAnchor = new Vector3(pos[0], pos[1], pos[2]);
                            this.buildPath(state, nav, state.dockAnchor, now);
                        } else {
                            this.advanceCommand(fleet, state);
                        }
                    }
                }
                break;
            case 'dock':
                if (state.localState === 'idle') {
                    if (command.targetStationId) {
                        const pos = nav.stationPositions.get(command.targetStationId);
                        if (pos) {
                            state.localState = 'docking';
                            state.dockStationId = command.targetStationId;
                            this.syncState(fleet, { state: 'docking', targetStationId: command.targetStationId });
                            state.dockAnchor = new Vector3(pos[0], pos[1], pos[2]);
                        } else {
                            console.warn(`[FleetSim] ${fleet.name} Dock failed - station ${command.targetStationId} not found`);
                            this.advanceCommand(fleet, state);
                        }
                    }
                }
                break;
            case 'undock':
                if (state.localState === 'docked') {
                    state.localState = 'undocking';
                    this.syncState(fleet, { state: 'undocking' });
                }
                break;
            case 'load-cargo':
                if (state.localState === 'docked') {
                    state.localState = 'loading';
                    state.dockStationId = command.targetStationId ?? state.dockStationId;
                    this.syncState(fleet, { state: 'loading' });
                    state.actionTimer = 0;
                } else if (state.localState === 'loading') {
                    state.actionTimer += 16;
                    if (state.actionTimer > 2000) {
                        // Fix: 'cargo-loaded' is valid per types
                        this.report(fleet, state, 'cargo-loaded', { amount: command.amount, wareId: command.wareId, stationId: state.dockStationId });
                        this.advanceCommand(fleet, state, true);
                    }
                }
                break;
            case 'unload-cargo':
                if (state.localState === 'docked') {
                    state.localState = 'unloading';
                    state.dockStationId = command.targetStationId ?? state.dockStationId;
                    this.syncState(fleet, { state: 'unloading' });
                    state.actionTimer = 0;
                } else if (state.localState === 'unloading') {
                    state.actionTimer += 16;
                    if (state.actionTimer > 2000) {
                        this.report(fleet, state, 'cargo-unloaded', { amount: command.amount, wareId: command.wareId, stationId: state.dockStationId });
                        this.advanceCommand(fleet, state, true);
                    }
                }
                break;
            case 'store-cargo':
                // Store all cargo at the docked station (for cancelled orders)
                if (state.localState === 'docked') {
                    state.localState = 'unloading';
                    state.dockStationId = command.targetStationId ?? state.dockStationId;
                    this.syncState(fleet, { state: 'unloading' });
                    state.actionTimer = 0;
                } else if (state.localState === 'unloading') {
                    state.actionTimer += 16;
                    if (state.actionTimer > 2000) {
                        // Report all cargo types being stored
                        const cargoKeys = Object.keys(fleet.cargo);
                        for (const wareId of cargoKeys) {
                            const amount = fleet.cargo[wareId];
                            if (amount > 0) {
                                this.report(fleet, state, 'cargo-stored', {
                                    amount,
                                    wareId,
                                    stationId: state.dockStationId
                                });
                            }
                        }
                        this.advanceCommand(fleet, state, true);
                    }
                }
                break;
            case 'goto-gate':
            case 'use-gate':
            case 'move-to-sector':
                if (state.localState === 'idle' || state.localState === 'in-transit') {
                    if (command.targetSectorId) {
                        state.localState = command.type === 'use-gate' ? 'entering-gate' : 'flying-to-gate';
                        this.buildPathToGate(fleet, state, nav, command.targetSectorId, now);
                    }
                }
                break;
            case 'patrol':
                if (state.localState === 'idle') {
                    state.localState = 'patrolling';
                    this.buildPatrolPath(state, nav, now);
                }
                break;
        }
    }

    private updateFleetPhysics(fleet: NPCFleet, state: FleetRuntimeState, dt: number, now: number) {
        if (state.localState === 'gone') return;
        if (state.localState === 'loading' || state.localState === 'unloading') return;

        const stats = fleet.behavior === 'construction' ? STATS.builder : (fleet.behavior === 'patrol' ? STATS.military : STATS.trader);
        const posVec = new Vector3(fleet.position[0], fleet.position[1], fleet.position[2]);
        const nav = this.getSectorNavData(fleet.currentSectorId || 'seizewell');

        // Safety Bounds
        if (Math.abs(posVec.x) > 200000 || Math.abs(posVec.z) > 200000) {
            this.resetFleet(fleet, state);
            return;
        }

        // Docked / Undocking Logic
        if (state.localState === 'docked' && state.dockAnchor) {
            posVec.lerp(state.dockAnchor, 0.1);
            state.velocity.multiplyScalar(DOCK_HOLD_DAMPING);

        } else if (state.localState === 'undocking' && state.dockAnchor) {
            const away = posVec.clone().sub(state.dockAnchor).normalize();
            state.velocity.add(away.multiplyScalar(stats.accel * dt));
            posVec.add(state.velocity.clone().multiplyScalar(dt));
            if (posVec.distanceTo(state.dockAnchor) > (fleet.behavior === 'construction' ? 220 : 130)) {
                // Fix: 'undocked' is valid
                this.report(fleet, state, 'undocked', { stationId: state.dockStationId });
                this.advanceCommand(fleet, state);
                state.dockStationId = undefined;
                state.dockAnchor = null;
            }

        } else if (state.localState === 'docking' && state.dockAnchor) {
            const dist = posVec.distanceTo(state.dockAnchor);
            const arrivalDist = fleet.behavior === 'construction' ? 80 : ARRIVAL_DISTANCE;
            if (dist < arrivalDist) {
                state.localState = 'docked';
                this.report(fleet, state, 'docked', { stationId: state.dockStationId });
                this.advanceCommand(fleet, state, true);
            } else {
                const dir = state.dockAnchor.clone().sub(posVec).normalize();
                state.velocity.lerp(dir.multiplyScalar(stats.speed * 0.5), dt);
                posVec.add(state.velocity.clone().multiplyScalar(dt));
            }

        } else if (['flying-to-station', 'flying-to-gate', 'entering-gate', 'patrolling'].includes(state.localState)) {
            // Flying Logic

            // Repath check
            if (state.localState === 'patrolling' && (now > state.nextRepathAt || state.path.length === 0)) {
                this.buildPatrolPath(state, nav!, now);
            }
            if (state.path.length === 0 && (state.localState === 'flying-to-station' && state.dockAnchor)) {
                this.buildPath(state, nav!, state.dockAnchor, now);
            }

            // Waypoint Following
            let target = state.path[state.pathIndex] || (state.path.length > 0 ? state.path[state.path.length - 1] : null);
            if (target && posVec.distanceTo(target) < (fleet.behavior === 'construction' ? 120 : 80) && state.pathIndex < state.path.length - 1) {
                state.pathIndex++;
                target = state.path[state.pathIndex];
            }

            if (target) {
                const dist = posVec.distanceTo(target);
                const dir = target.clone().sub(posVec).normalize();

                // Obstacle Avoidance
                if (nav && dist > 200) {
                    const avoidance = new Vector3();
                    for (const o of nav.obstacles) {
                        const offset = posVec.clone().sub(o.center);
                        const d = offset.length();
                        const radius = o.radius + (fleet.behavior === 'construction' ? 250 : 160);
                        if (d < radius) {
                            const strength = (radius - d) / radius;
                            avoidance.add(offset.normalize().multiplyScalar(strength * 2.0));
                        }
                    }
                    if (avoidance.lengthSq() > 0) dir.add(avoidance).normalize();
                }

                // Speed
                let desiredSpeed = stats.speed;
                const isArrival = state.pathIndex >= state.path.length - 1;
                const brakeDist = fleet.behavior === 'construction' ? BRAKE_DISTANCE_LARGE : BRAKE_DISTANCE;
                if (isArrival && dist < brakeDist) {
                    desiredSpeed = Math.max(20, stats.speed * (dist / brakeDist));
                }

                // Apply Accel
                const desiredVel = dir.multiplyScalar(desiredSpeed);
                const velDiff = desiredVel.clone().sub(state.velocity);
                const maxChange = stats.accel * dt;
                if (velDiff.length() > maxChange) {
                    velDiff.normalize().multiplyScalar(maxChange);
                }
                state.velocity.add(velDiff);

                // Move
                posVec.add(state.velocity.clone().multiplyScalar(dt));

                // Stuck Detection
                if (now - state.lastProgress.time > 1000) {
                    const moved = posVec.distanceTo(state.lastProgress.pos);
                    if (moved < 5) {
                        state.lastProgress.stuckTime++;
                        if (state.lastProgress.stuckTime > 5) {
                            state.path = [];
                            state.lastProgress.stuckTime = 0;
                        }
                    } else {
                        state.lastProgress.stuckTime = 0;
                    }
                    state.lastProgress.time = now;
                    state.lastProgress.pos.copy(posVec);
                }

                // Gate Entry (robust)
                if (nav) {
                    const cmd = fleet.commandQueue?.[state.currentCommandIndex];
                    const wantsGate = cmd && (cmd.type === 'goto-gate' || cmd.type === 'use-gate' || cmd.type === 'move-to-sector');
                    for (const g of nav.gatePositions) {
                        const gatePos = new Vector3(g.position[0], g.position[1], g.position[2]);
                        const gateDist = posVec.distanceTo(gatePos);
                        const enterRadius = Math.max(300, g.radius * 0.9);

                        // If we're explicitly heading to a gate, use a larger envelope to avoid jitter loops
                        if ((state.localState === 'entering-gate' || state.localState === 'flying-to-gate' || wantsGate) && gateDist < enterRadius) {
                            const finalDest = cmd?.targetSectorId || fleet.destinationSectorId;
                            if (finalDest) {
                                const nextHop = findNextHop(fleet.currentSectorId, finalDest);
                                const targetSector = nextHop || finalDest;
                                this.enterGate(fleet, state, targetSector, g.gateType);
                                posVec.set(fleet.position[0], fleet.position[1], fleet.position[2]);
                                break;
                            }
                        }

                        // Safety: if hovering near a gate for a long time while "in-transit", force entry
                        const stuckNearGate = gateDist < enterRadius * 2 && (state.localState === 'entering-gate' || state.localState === 'flying-to-gate' || state.localState === 'in-transit');
                        if (stuckNearGate && (now - state.lastProgress.time) > 8000) {
                            const finalDest = cmd?.targetSectorId || fleet.destinationSectorId;
                            if (finalDest) {
                                const nextHop = findNextHop(fleet.currentSectorId, finalDest);
                                const targetSector = nextHop || finalDest;
                                this.enterGate(fleet, state, targetSector, g.gateType);
                                posVec.set(fleet.position[0], fleet.position[1], fleet.position[2]);
                                break;
                            }
                        }
                    }
                }

                // Station Arrival
                if (state.localState === 'flying-to-station' && isArrival && dist < (fleet.behavior === 'construction' ? 120 : 80)) {
                    this.report(fleet, state, 'arrived-at-station', { stationId: state.dockStationId });
                    this.advanceCommand(fleet, state);
                }
            }
        }

        // Update source
        fleet.position = [posVec.x, posVec.y, posVec.z];

        // Store Sync Throttling
        if (now - state.lastStoreUpdateTime > 100) {
            updateFleetPosition(fleet.id, fleet.position);
            state.lastStoreUpdateTime = now;
        }
        if (now - state.lastPositionReportTime > 2000) {
            this.report(fleet, state, 'position-update');
            state.lastPositionReportTime = now;
        }
    }

    private resetFleet(fleet: NPCFleet, state: FleetRuntimeState) {
        fleet.position = [0, 0, 0];
        state.velocity.set(0, 0, 0);
        state.path = [];
        state.localState = 'idle';
        this.report(fleet, state, 'position-update');
    }

    private buildPath(state: FleetRuntimeState, nav: SectorNavData, target: Vector3, now: number) {
        if (this.pathfindsThisFrame >= this.MAX_PATHFINDS_PER_FRAME) {
            state.nextRepathAt = now + 100; // try again soon
            return;
        }
        this.pathfindsThisFrame++;

        const f = useGameStore.getState().fleets.find(f => f.id === state.fleetId);
        if (!f) return;
        const startPos = new Vector3(f.position[0], f.position[1], f.position[2]);

        const path = findPath(nav.navGraph, startPos, target);
        state.path = path;
        state.pathIndex = 0;
        state.nextRepathAt = now + 5000;
    }

    private buildPathToGate(fleet: NPCFleet, state: FleetRuntimeState, nav: SectorNavData, targetSectorId: string, now: number) {
        let gate = nav.gatePositions.find(g => g.destinationSectorId === targetSectorId);
        if (!gate) {
            const nextHop = findNextHop(fleet.currentSectorId, targetSectorId);
            if (nextHop) gate = nav.gatePositions.find(g => g.destinationSectorId === nextHop);
        }

        if (gate) {
            this.buildPath(state, nav, new Vector3(gate.position[0], gate.position[1], gate.position[2]), now);
        }
    }

    private buildPatrolPath(state: FleetRuntimeState, nav: SectorNavData, now: number) {
        const range = 8000;
        const pt = new Vector3(
            (Math.random() - 0.5) * range,
            (Math.random() - 0.5) * range * 0.2,
            (Math.random() - 0.5) * range
        );
        this.buildPath(state, nav, pt, now);
    }

    private enterGate(fleet: NPCFleet, state: FleetRuntimeState, targetSectorId: string, usedGateType?: string) {
        let exitGateType = usedGateType || 'N';
        const entryGateTypeMap: Record<string, string> = { 'E': 'W', 'W': 'E', 'N': 'S', 'S': 'N' };
        const expectedEntryGateType = entryGateTypeMap[exitGateType] || 'N';

        const targetLayout = getSectorLayoutById(targetSectorId);
        const matchingGate = targetLayout.gates.find(g => g.gateType === expectedEntryGateType) || targetLayout.gates[0];

        let destPos: [number, number, number] = [0, 0, 0];
        if (matchingGate) {
            const scale = 30;
            const gx = matchingGate.position[0] * scale;
            const gy = matchingGate.position[1] * scale;
            const gz = matchingGate.position[2] * scale;
            const offset = 2000;

            if (expectedEntryGateType === 'W') destPos = [gx + offset, gy, gz];
            else if (expectedEntryGateType === 'E') destPos = [gx - offset, gy, gz];
            else if (expectedEntryGateType === 'N') destPos = [gx, gy, gz + offset];
            else if (expectedEntryGateType === 'S') destPos = [gx, gy, gz - offset];
        }

        this.report(fleet, state, 'entered-sector', { sectorIdOverride: targetSectorId, gateType: exitGateType, position: destPos });

        // Update fleet immediately and keep simulating in new sector
        fleet.currentSectorId = targetSectorId;
        fleet.position = destPos;
        state.velocity.set(0, 0, 0);
        state.path = [];
        state.pathIndex = 0;
        state.dockAnchor = null;
        state.dockStationId = undefined;
        state.localState = 'idle';

        // Skip past the gate commands we just fulfilled so we don't loop
        this.advanceCommand(fleet, state, true); // consume current gate command
        const nextCmd = fleet.commandQueue[state.currentCommandIndex];
        if (nextCmd && (nextCmd.type === 'use-gate' || nextCmd.type === 'goto-gate') && nextCmd.targetSectorId === targetSectorId) {
            this.advanceCommand(fleet, state, true); // consume the paired gate command too
        }
    }
}
