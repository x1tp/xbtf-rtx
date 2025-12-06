import type { FC } from 'react';
import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Quaternion } from 'three';
import { ShipModel } from './ShipModel';
import { useGameStore, type GameState } from '../store/gameStore';
import type { NPCFleet, ShipReportType } from '../types/simulation';
import type { NavGraph, NavObstacle } from '../ai/navigation';
import { findPath } from '../ai/navigation';

interface GateInfo {
  position: [number, number, number];
  destinationSectorId: string;
  radius?: number;
}

interface NPCTraderProps {
  fleet: NPCFleet;
  stationPositions: Map<string, [number, number, number]>;
  gatePositions: GateInfo[];
  navGraph: NavGraph | null;
  obstacles: NavObstacle[];
  onReport?: (fleetId: string, type: ShipReportType, data: {
    sectorId: string;
    position: [number, number, number];
    stationId?: string;
    wareId?: string;
    amount?: number;
  }) => void;
}

const tmpVec = new Vector3();
const tmpDir = new Vector3();
const DOCK_DISTANCE = 80;      // Distance to be considered "at" a station
const ARRIVAL_DISTANCE = 50;   // Distance to complete arrival
const DOCK_HOLD_DAMPING = 0.9; // How aggressively to damp velocity while docked
const IDLE_DAMPING = 0.92;     // Idle damping to prevent jitter

// Ship flight characteristics
const ACCELERATION = 15;       // Units per second squared
const MAX_SPEED = 180;         // Maximum velocity
const TURN_RATE = 1.5;         // How fast ship can rotate (radians per second factor)
const BRAKE_DISTANCE = 300;    // Start slowing down at this distance

/**
 * NPCTrader - Autonomous NPC trading ship
 * 
 * This component manages its own state machine and executes commands
 * from the backend. It reports completed actions back to the backend.
 * 
 * Command flow:
 * 1. Backend issues commands (goto-station, dock, load-cargo, etc.)
 * 2. Ship executes commands autonomously in 3D space
 * 3. Ship reports completion/state changes to backend
 */
export const NPCTrader: FC<NPCTraderProps> = ({
  fleet,
  stationPositions,
  gatePositions,
  navGraph,
  obstacles,
  onReport
}) => {
  const shipRef = useRef<Group | null>(null);
  const velocityRef = useRef(new Vector3());
  const initializedRef = useRef(false);
  const pathRef = useRef<Vector3[]>([]);
  const pathIndexRef = useRef(0);
  const nextRepathAtRef = useRef(0);
  const lastProgressSampleRef = useRef<{ time: number; pos: Vector3; stuckTime: number }>({
    time: 0,
    pos: new Vector3(),
    stuckTime: 0
  });
  const dockAnchorRef = useRef<Vector3 | null>(null);
  const holdDockRef = useRef(false);
  const idleAnchorRef = useRef<Vector3 | null>(null);
  const lastStateRef = useRef<typeof localState>('idle');
  const timeScale = useGameStore((s: GameState) => s.timeScale);

  // Local autonomous state
  const [localState, setLocalState] = useState<'idle' | 'flying-to-station' | 'flying-to-gate' | 'docking' | 'docked' | 'loading' | 'unloading' | 'undocking' | 'entering-gate' | 'gone'>('idle');
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const actionTimerRef = useRef(0);
  const lastReportRef = useRef<string>('');

  // Get current command from queue
  const currentCommand = useMemo(() => {
    const queue = fleet.commandQueue || [];
    return queue[currentCommandIndex] || null;
  }, [fleet.commandQueue, currentCommandIndex]);

  // Peek next command (for sequencing hints)
  const nextCommand = useMemo(() => {
    const queue = fleet.commandQueue || [];
    return queue[currentCommandIndex + 1] || null;
  }, [fleet.commandQueue, currentCommandIndex]);

  // Auto-reset command index if the queue has been replaced by the backend
  useEffect(() => {
    const queue = fleet.commandQueue || [];
    if (queue.length > 0 && currentCommandIndex >= queue.length) {
      setCurrentCommandIndex(0);
    }
  }, [fleet.commandQueue, currentCommandIndex]);

  // Callback ref to set initial position
  const setShipRef = useCallback((group: Group | null) => {
    if (group && !initializedRef.current) {
      group.position.set(fleet.position[0], fleet.position[1], fleet.position[2]);
      initializedRef.current = true;
    }
    shipRef.current = group;
  }, [fleet.position]);

  // Get target station position
  const getStationPosition = useCallback((stationId: string): Vector3 | null => {
    const pos = stationPositions.get(stationId);
    if (pos) {
      // Add slight offset based on ship id for variety
      const hash = fleet.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const angle = (hash % 360) * Math.PI / 180;
      const dist = 30 + (hash % 50);
      return new Vector3(
        pos[0] + Math.cos(angle) * dist,
        pos[1] + (hash % 30) - 15,
        pos[2] + Math.sin(angle) * dist
      );
    }
    return null;
  }, [stationPositions, fleet.id]);

  // Get gate data for a destination sector
  const getGateData = useCallback((destSectorId: string): { pos: Vector3; radius: number } | null => {
    const gate = gatePositions.find(g => g.destinationSectorId === destSectorId);
    if (gate) {
      const radius = typeof gate.radius === 'number' ? gate.radius : 300;
      return { pos: new Vector3(gate.position[0], gate.position[1], gate.position[2]), radius };
    }
    return null;
  }, [gatePositions]);

  // Build or refresh a nav path toward a target
  const buildPathTo = useCallback((target: Vector3 | null) => {
    const ship = shipRef.current;
    if (!ship || !target) return;
    const path = findPath(navGraph, ship.position.clone(), target.clone());
    pathRef.current = path;
    pathIndexRef.current = 0;
    nextRepathAtRef.current = performance.now() + 5500;
  }, [navGraph]);

  // Current waypoint following helper
  const getCurrentWaypoint = useCallback((finalTarget: Vector3 | null) => {
    if (!finalTarget) return null;
    if (pathRef.current.length === 0) return finalTarget;
    const ship = shipRef.current;
    if (!ship) return finalTarget;
    const idx = pathIndexRef.current;
    const wp = pathRef.current[idx] ?? finalTarget;
    if (ship.position.distanceTo(wp) < 80 && idx < pathRef.current.length - 1) {
      pathIndexRef.current += 1;
      return pathRef.current[pathIndexRef.current] ?? finalTarget;
    }
    return wp;
  }, []);

  // Report an action to the backend
  // Update fleet state in the store so admin panels reflect live status
  const syncFleet = useCallback((updates: Partial<NPCFleet>) => {
    useGameStore.setState((state: GameState) => ({
      fleets: state.fleets.map((f) => (f.id === fleet.id ? { ...f, ...updates } : f)),
    }));
  }, [fleet.id]);

  // Mirror local state to store for UI consistency
  useEffect(() => {
    const updates: Partial<NPCFleet> = {};
    switch (localState) {
      case 'idle':
        updates.state = 'idle';
        updates.destinationSectorId = undefined;
        break;
      case 'flying-to-station':
        updates.state = 'idle';  // Flying within sector, not cross-sector transit
        updates.targetStationId = currentCommand?.targetStationId;
        break;
      case 'flying-to-gate':
      case 'entering-gate':
        updates.state = 'in-transit';
        updates.destinationSectorId = currentCommand?.targetSectorId;
        break;
      case 'docking':
        updates.state = 'docking';
        updates.targetStationId = currentCommand?.targetStationId || fleet.targetStationId;
        break;
      case 'docked':
        updates.state = 'idle';
        updates.targetStationId = currentCommand?.targetStationId || fleet.targetStationId;
        break;
      case 'loading':
        updates.state = 'loading';
        updates.targetStationId = currentCommand?.targetStationId || fleet.targetStationId;
        break;
      case 'unloading':
        updates.state = 'unloading';
        updates.targetStationId = currentCommand?.targetStationId || fleet.targetStationId;
        break;
      case 'undocking':
        updates.state = 'undocking';
        updates.targetStationId = currentCommand?.targetStationId || fleet.targetStationId;
        break;
    }
    if (Object.keys(updates).length > 0) {
      updates.stateStartTime = Date.now();
      syncFleet(updates);
    }
  }, [localState, currentCommand, fleet.targetStationId, syncFleet]);

  const report = useCallback((type: ShipReportType, extra?: { stationId?: string; wareId?: string; amount?: number; sectorIdOverride?: string }) => {
    const ship = shipRef.current;
    if (!ship || !onReport) return;
    const pos: [number, number, number] = [ship.position.x, ship.position.y, ship.position.z];

    // Allow repeated position updates; dedupe the rest
    if (type !== 'position-update') {
      const reportKey = `${type}-${extra?.stationId || ''}-${extra?.wareId || ''}`;
      if (lastReportRef.current === reportKey) return;
      lastReportRef.current = reportKey;
    }

    const { sectorIdOverride, ...restExtra } = extra || {};
    const sectorId = sectorIdOverride || fleet.currentSectorId;
    const stationId = extra?.stationId || currentCommand?.targetStationId || fleet.targetStationId;
    const payload = {
      sectorId,
      position: pos,
      stationId,
      ...restExtra,
    };

    // Emit detailed console log for visibility
    const station = stationId || 'unknown';
    const ware = extra?.wareId || 'n/a';
    const amt = typeof extra?.amount === 'number' ? extra.amount : 'n/a';
    const tgtSector = currentCommand?.targetSectorId || extra?.sectorIdOverride || fleet.destinationSectorId || 'n/a';
    const stepInfo = `${type} | pos=(${pos.map(v => v.toFixed(1)).join(',')}) | station=${station} | sector=${sectorId} -> ${tgtSector} | ware=${ware} | amt=${amt}`;
    console.log(`[NPCTrader] ${fleet.name} ${stepInfo}`);

    onReport(fleet.id, type, payload);

    // Mirror key state locally for UI/summary panels
    const positionUpdate: Partial<NPCFleet> = {
      position: pos,
      currentSectorId: sectorId,
      stateStartTime: Date.now(),
    };
    switch (type) {
      case 'arrived-at-station':
        positionUpdate.state = 'docking';
        positionUpdate.targetStationId = extra?.stationId;
        break;
      case 'docked':
        positionUpdate.state = 'idle';
        positionUpdate.targetStationId = extra?.stationId;
        break;
      case 'cargo-loaded':
      case 'cargo-unloaded':
        positionUpdate.state = 'idle';
        positionUpdate.targetStationId = extra?.stationId;
        break;
      case 'undocked':
        positionUpdate.state = 'undocking';
        break;
      case 'arrived-at-gate':
        positionUpdate.state = 'in-transit';
        // Prefer command target sector for clarity
        positionUpdate.destinationSectorId = currentCommand?.targetSectorId || extra?.sectorIdOverride || positionUpdate.destinationSectorId;
        break;
      case 'entered-sector':
        positionUpdate.state = 'idle';
        positionUpdate.destinationSectorId = undefined;
        break;
      case 'position-update':
        positionUpdate.stateStartTime = undefined; // don't reset timer
        break;
    }
    syncFleet(positionUpdate);
  }, [fleet.currentSectorId, fleet.id, onReport, syncFleet, currentCommand]);

  // Advance to next command
  // preserveDocked: if true, stay in 'docked' state instead of resetting to 'idle'
  const advanceCommand = useCallback((preserveDocked = false) => {
    setCurrentCommandIndex(prev => prev + 1);
    actionTimerRef.current = 0;
    // Don't reset to idle if we should preserve docked state (for load/unload after dock)
    if (!preserveDocked) {
      setLocalState('idle');
    }
  }, []);

  // Teleport through gate and update store/report
  const enterGate = useCallback((targetSectorId: string, gatePos: Vector3, shouldAdvance = true) => {
    report('entered-sector', { stationId: targetSectorId, sectorIdOverride: targetSectorId });
    const destPos: [number, number, number] = [gatePos.x, gatePos.y, gatePos.z];
    useGameStore.setState((state: GameState) => ({
      fleets: state.fleets.map((f) => f.id === fleet.id ? {
        ...f,
        currentSectorId: targetSectorId,
        position: destPos,
        state: 'idle',
        stateStartTime: Date.now(),
        destinationSectorId: undefined,
      } : f)
    }));
    setLocalState('gone'); // despawn from current sector
    if (shouldAdvance) {
      advanceCommand();
    } else {
      setLocalState('idle');
    }
  }, [advanceCommand, fleet.id, report]);

  // Process current command to determine what to do
  useEffect(() => {
    if (!currentCommand) {
      if (localState !== 'idle' && localState !== 'gone') {
        setLocalState('idle');
      }
      return;
    }

    switch (currentCommand.type) {
      case 'trade-buy':
      case 'trade-sell':
        if (localState === 'idle') {
          // Check if we are in the target sector
          if (currentCommand.targetSectorId && currentCommand.targetSectorId !== fleet.currentSectorId) {
            // Need to travel to gate
            setLocalState('flying-to-gate');
            const gateData = getGateData(currentCommand.targetSectorId);
            buildPathTo(gateData?.pos || null);
          } else {
            // In target sector, fly to station
            const stationPos = currentCommand.targetStationId ? stationPositions.get(currentCommand.targetStationId) : null;
            if (stationPos) {
              setLocalState('flying-to-station');
              buildPathTo(new Vector3(stationPos[0], stationPos[1], stationPos[2]));
              dockAnchorRef.current = new Vector3(stationPos[0], stationPos[1], stationPos[2]);
              holdDockRef.current = false;
            } else {
              console.warn(`[NPCTrader] ${fleet.name} cannot find station ${currentCommand.targetStationId} in sector`);
              advanceCommand();
            }
          }
        } else if (localState === 'docked') {
          // If we are docked, check if it's the right station
          if (currentCommand.targetStationId && fleet.targetStationId === currentCommand.targetStationId) {
             // We are at the right station, start operation
             setLocalState(currentCommand.type === 'trade-buy' ? 'loading' : 'unloading');
             actionTimerRef.current = 0;
          } else {
             // Wrong station, undock
             setLocalState('undocking');
          }
        }
        break;

      case 'goto-station':
        if (localState === 'idle') {
          // Check if station is in current sector or need gate travel
          const stationPos = currentCommand.targetStationId ?
            stationPositions.get(currentCommand.targetStationId) : null;
          if (stationPos) {
            setLocalState('flying-to-station');
            buildPathTo(new Vector3(stationPos[0], stationPos[1], stationPos[2]));
            dockAnchorRef.current = new Vector3(stationPos[0], stationPos[1], stationPos[2]);
            holdDockRef.current = false;
          } else {
            // Station not in current sector - skip command to prevent getting stuck
            console.warn(`[NPCTrader] ${fleet.name} cannot goto station ${currentCommand.targetStationId} - not in sector, skipping`);
            advanceCommand();
          }
        }
        break;

      case 'goto-gate':
        if (localState === 'idle') {
          setLocalState('flying-to-gate');
          const gateData = currentCommand.targetSectorId ? getGateData(currentCommand.targetSectorId) : null;
          buildPathTo(gateData?.pos || null);
        }
        break;

      case 'dock':
        if (localState === 'idle') {
          const stationPos = currentCommand.targetStationId ? stationPositions.get(currentCommand.targetStationId) : null;
          if (stationPos) {
            setLocalState('docking');
            dockAnchorRef.current = new Vector3(stationPos[0], stationPos[1], stationPos[2]);
          } else {
            console.warn(`[NPCTrader] ${fleet.name} dock command but station ${currentCommand.targetStationId} not found - skipping`);
            advanceCommand();
          }
        }
        break;

      case 'load-cargo':
        if (localState === 'docked') {
          setLocalState('loading');
          actionTimerRef.current = 0;
        }
        break;

      case 'unload-cargo':
        if (localState === 'docked') {
          setLocalState('unloading');
          actionTimerRef.current = 0;
        }
        break;

      case 'undock':
        if (localState === 'docked') {
          setLocalState('undocking');
        }
        break;

      case 'use-gate':
        if (localState === 'idle') {
          setLocalState('entering-gate');
          const gateData = currentCommand.targetSectorId ? getGateData(currentCommand.targetSectorId) : null;
          buildPathTo(gateData?.pos || null);
        }
        break;

      case 'patrol':
      case 'wait':
        // Stay idle, just patrol/orbit
        break;
    }
  }, [currentCommand, localState, stationPositions, buildPathTo, getGateData, fleet.currentSectorId, fleet.targetStationId]);

  // Main simulation loop
  useFrame((_, rawDelta) => {
    const ship = shipRef.current;
    if (!ship || localState === 'gone') return;

    const delta = rawDelta * timeScale;
    const shipMaxSpeed = MAX_SPEED * fleet.speed;
    const shipAccel = ACCELERATION * fleet.speed;
    const now = performance.now();

    // Simple stuck detection -> trigger a repath
    const lp = lastProgressSampleRef.current;
    const movingStates = localState === 'flying-to-station' || localState === 'flying-to-gate' || localState === 'entering-gate';
    if (!movingStates) {
      lp.time = 0;
      lp.stuckTime = 0;
    } else {
      if (lp.time === 0) {
        lp.time = now;
        lp.pos.copy(ship.position);
      } else if (now - lp.time > 900) {
        const moved = ship.position.distanceTo(lp.pos);
        if (moved < 5) {
          lp.stuckTime += (now - lp.time) / 1000;
          if (lp.stuckTime > 2.0) {
            if (currentCommand?.type === 'trade-buy' || currentCommand?.type === 'trade-sell') {
               if (currentCommand.targetSectorId && currentCommand.targetSectorId !== fleet.currentSectorId) {
                  buildPathTo(getGateData(currentCommand.targetSectorId)?.pos || null);
               } else if (currentCommand.targetStationId) {
                  buildPathTo(getStationPosition(currentCommand.targetStationId));
               }
            } else if (currentCommand?.type === 'goto-station' && currentCommand.targetStationId) {
              buildPathTo(getStationPosition(currentCommand.targetStationId));
            } else if ((currentCommand?.type === 'goto-gate' || currentCommand?.type === 'use-gate') && currentCommand.targetSectorId) {
              buildPathTo(getGateData(currentCommand.targetSectorId)?.pos || null);
            }
            lp.stuckTime = 0;
          }
        } else {
          lp.stuckTime = 0;
          lp.pos.copy(ship.position);
        }
        lp.time = now;
      }
    }

    // Track state transitions to set idle anchor
    if (localState !== lastStateRef.current) {
      if (localState === 'idle') {
        idleAnchorRef.current = ship.position.clone();
        velocityRef.current.set(0, 0, 0);
      } else {
        idleAnchorRef.current = null;
      }
      lastStateRef.current = localState;
    }

    // No forced periodic position updates; reports are sent on state transitions/steps.

    switch (localState) {
      case 'idle': {
        // If we're supposed to be docked/held, pin the ship at the dock anchor
        if (holdDockRef.current && dockAnchorRef.current) {
          velocityRef.current.multiplyScalar(DOCK_HOLD_DAMPING);
          ship.position.copy(dockAnchorRef.current);
          // Keep orientation stable (no spin)
          break;
        }

        // Hard hold near idle anchor to avoid jitter on the map
        const anchor = idleAnchorRef.current || ship.position.clone();
        idleAnchorRef.current = anchor;
        const toAnchor = tmpVec.copy(anchor).sub(ship.position);
        ship.position.add(toAnchor.multiplyScalar(0.15)); // smooth snap
        velocityRef.current.multiplyScalar(IDLE_DAMPING);
        const speedSq = velocityRef.current.lengthSq();
        if (speedSq > 1) {
          tmpDir.copy(velocityRef.current).normalize();
          const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
          ship.quaternion.slerp(targetQuat, delta * TURN_RATE * 0.3);
        }
        break;
      }

      case 'flying-to-station': {
        if (!currentCommand?.targetStationId) break;

        const targetPos = getStationPosition(currentCommand.targetStationId);
        if (!targetPos) {
          console.warn(`[NPCTrader] Cannot find station ${currentCommand.targetStationId}`);
          advanceCommand();
          break;
        }
        if (performance.now() > nextRepathAtRef.current || pathRef.current.length === 0) {
          buildPathTo(targetPos);
        }
        const waypoint = getCurrentWaypoint(targetPos);
        const dist = ship.position.distanceTo(targetPos);

        if (dist > DOCK_DISTANCE) {
          // Calculate desired direction with simple obstacle avoidance
          tmpDir.copy(waypoint || targetPos).sub(ship.position).normalize();
          const avoidance = new Vector3();
          for (const o of obstacles) {
            const offset = ship.position.clone().sub(o.center);
            const d = offset.length();
            if (d < o.radius + 160 && d > 1e-3) {
              const strength = (o.radius + 160 - d) / (o.radius + 160);
              avoidance.add(offset.normalize().multiplyScalar(strength));
            }
          }
          if (avoidance.lengthSq() > 0) {
            tmpDir.add(avoidance.multiplyScalar(1.5)).normalize();
          }

          // Determine desired speed based on distance (slow down as we approach)
          let desiredSpeed = shipMaxSpeed;
          if (dist < BRAKE_DISTANCE) {
            desiredSpeed = Math.max(30, (dist / BRAKE_DISTANCE) * shipMaxSpeed);
          }

          // Calculate desired velocity
          tmpVec.copy(tmpDir).multiplyScalar(desiredSpeed);

          // Accelerate toward desired velocity
          const velDiff = tmpVec.clone().sub(velocityRef.current);
          const accelMag = Math.min(shipAccel * delta, velDiff.length());
          if (accelMag > 0.01) {
            velDiff.normalize().multiplyScalar(accelMag);
            velocityRef.current.add(velDiff);
          }

          // Clamp to max speed
          const currentSpeed = velocityRef.current.length();
          if (currentSpeed > shipMaxSpeed) {
            velocityRef.current.multiplyScalar(shipMaxSpeed / currentSpeed);
          }

          // Apply velocity to position
          ship.position.add(velocityRef.current.clone().multiplyScalar(delta));

          // Rotate ship to face velocity direction (not target - more natural)
          if (currentSpeed > 5) {
            tmpDir.copy(velocityRef.current).normalize();
            const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
            ship.quaternion.slerp(targetQuat, delta * TURN_RATE);
          }
        } else {
          // Arrived at station - kill velocity
          velocityRef.current.multiplyScalar(0.8);
          report('arrived-at-station', { stationId: currentCommand.targetStationId });
          
          if (currentCommand.type === 'trade-buy' || currentCommand.type === 'trade-sell') {
             setLocalState('docking');
             dockAnchorRef.current = targetPos.clone();
          } else {
             advanceCommand();
          }
        }
        break;
      }

      case 'flying-to-gate': {
        if (!currentCommand?.targetSectorId) break;

        const gateData = getGateData(currentCommand.targetSectorId);
        if (!gateData) {
          console.warn(`[NPCTrader] Cannot find gate to ${currentCommand.targetSectorId}`);
          advanceCommand();
          break;
        }
        const gatePos = gateData.pos;
        const gateRadius = gateData.radius;
        if (performance.now() > nextRepathAtRef.current || pathRef.current.length === 0) {
          buildPathTo(gatePos);
        }
        const waypoint = getCurrentWaypoint(gatePos);
        const dist = ship.position.distanceTo(gatePos);

        const enterPrepRadius = gateRadius * 0.8;
        if (dist > enterPrepRadius) {
          // Calculate desired direction
          tmpDir.copy(waypoint || gatePos).sub(ship.position).normalize();
          // Avoid obstacles while far from gate only
          if (dist > enterPrepRadius * 1.1) {
            const avoidance = new Vector3();
            for (const o of obstacles) {
              const offset = ship.position.clone().sub(o.center);
              const d = offset.length();
              if (d < o.radius + 160 && d > 1e-3) {
                const strength = (o.radius + 160 - d) / (o.radius + 160);
                avoidance.add(offset.normalize().multiplyScalar(strength));
              }
            }
            if (avoidance.lengthSq() > 0) {
              tmpDir.add(avoidance.multiplyScalar(1.5)).normalize();
            }
          }

          // Full speed to gate (no braking)
          tmpVec.copy(tmpDir).multiplyScalar(shipMaxSpeed * 1.2);

          // Accelerate toward desired velocity
          const velDiff = tmpVec.clone().sub(velocityRef.current);
          const accelMag = Math.min(shipAccel * delta * 1.5, velDiff.length());
          if (accelMag > 0.01) {
            velDiff.normalize().multiplyScalar(accelMag);
            velocityRef.current.add(velDiff);
          }

          // Apply velocity
          ship.position.add(velocityRef.current.clone().multiplyScalar(delta));

          // Face velocity direction
          if (velocityRef.current.lengthSq() > 25) {
            tmpDir.copy(velocityRef.current).normalize();
            const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
            ship.quaternion.slerp(targetQuat, delta * TURN_RATE);
          }
        } else {
          // Arrived at gate
          report('arrived-at-gate');
          if (currentCommand.type === 'trade-buy' || currentCommand.type === 'trade-sell') {
             setLocalState('entering-gate');
          } else if (nextCommand?.type === 'use-gate') {
            setLocalState('entering-gate');
            advanceCommand();
          } else {
            // No explicit use-gate command; auto-enter
            enterGate(currentCommand.targetSectorId, gatePos);
          }
        }
        break;
      }

      case 'docking': {
        // Slow approach for docking animation
        const stationId = currentCommand?.targetStationId || fleet.targetStationId;
        if (!stationId) {
          console.warn(`[NPCTrader] ${fleet.name} docking but no stationId - skipping`);
          advanceCommand();
          break;
        }

        const targetPos = getStationPosition(stationId);

        if (!targetPos) {
          // Station not found in position map - log and skip to prevent stuck
          console.warn(`[NPCTrader] ${fleet.name} cannot find station ${stationId} for docking - skipping`);
          advanceCommand();
          break;
        }

        dockAnchorRef.current = targetPos.clone();
        const dist = ship.position.distanceTo(targetPos);
        if (dist > ARRIVAL_DISTANCE) {
          // Calculate direction
          tmpDir.copy(targetPos).sub(ship.position).normalize();

          // Slow docking speed
          const dockSpeed = Math.min(40, dist * 0.5);
          tmpVec.copy(tmpDir).multiplyScalar(dockSpeed);

          // Gentle acceleration
          const velDiff = tmpVec.clone().sub(velocityRef.current);
          const accelMag = Math.min(shipAccel * 0.5 * delta, velDiff.length());
          if (accelMag > 0.01) {
            velDiff.normalize().multiplyScalar(accelMag);
            velocityRef.current.add(velDiff);
          }

          ship.position.add(velocityRef.current.clone().multiplyScalar(delta));

          // Face station
          const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
          ship.quaternion.slerp(targetQuat, delta * TURN_RATE * 0.5);
        } else {
          // Docked
          velocityRef.current.set(0, 0, 0);
          holdDockRef.current = true;
          ship.position.copy(targetPos);
          report('docked', { stationId });

          if (currentCommand?.type === 'trade-buy') {
             setLocalState('loading');
             actionTimerRef.current = 0;
          } else if (currentCommand?.type === 'trade-sell') {
             setLocalState('unloading');
             actionTimerRef.current = 0;
          } else {
             // Check next command and transition directly to avoid React batching issues
             // Current command is 'dock', next command is at currentCommandIndex + 1
             const nextCmdIndex = currentCommandIndex + 1;
             const nextCmd = fleet.commandQueue?.[nextCmdIndex];
             if (nextCmd?.type === 'load-cargo') {
               setLocalState('loading');
               actionTimerRef.current = 0;
               setCurrentCommandIndex(nextCmdIndex);  // Move to load-cargo command
             } else if (nextCmd?.type === 'unload-cargo') {
               setLocalState('unloading');
               actionTimerRef.current = 0;
               setCurrentCommandIndex(nextCmdIndex);  // Move to unload-cargo command
             } else {
               setLocalState('docked');
               advanceCommand(true);  // Preserve docked state
             }
          }
        }
        break;
      }

      case 'docked': {
        // Hard-hold position/orientation at the dock anchor
        if (dockAnchorRef.current) {
          ship.position.copy(dockAnchorRef.current);
        }
        velocityRef.current.set(0, 0, 0);
        break;
      }

      case 'loading': {
        // Simulate loading time
        holdDockRef.current = true;
        actionTimerRef.current += delta;
        if (actionTimerRef.current >= 3) { // 3 seconds to load
          report('cargo-loaded', {
            stationId: currentCommand?.targetStationId || fleet.targetStationId,
            wareId: currentCommand?.wareId,
            amount: currentCommand?.amount
          });
          actionTimerRef.current = 0;

          if (currentCommand?.type === 'trade-buy') {
             advanceCommand(true);
          } else {
             // Check next command and transition directly to avoid React batching issues
             const nextCmdIndex = currentCommandIndex + 1;
             const nextCmd = fleet.commandQueue?.[nextCmdIndex];
             if (nextCmd?.type === 'undock') {
               setLocalState('undocking');
               setCurrentCommandIndex(nextCmdIndex);
             } else if (nextCmd?.type === 'load-cargo') {
               // Another load operation
               actionTimerRef.current = 0;
               setCurrentCommandIndex(nextCmdIndex);
             } else if (nextCmd?.type === 'unload-cargo') {
               setLocalState('unloading');
               actionTimerRef.current = 0;
               setCurrentCommandIndex(nextCmdIndex);
             } else {
               setLocalState('docked');
               advanceCommand(true);
             }
          }
        }
        break;
      }

      case 'unloading': {
        // Simulate unloading time
        holdDockRef.current = true;
        actionTimerRef.current += delta;
        if (actionTimerRef.current >= 2) { // 2 seconds to unload
          report('cargo-unloaded', {
            stationId: currentCommand?.targetStationId || fleet.targetStationId,
            wareId: currentCommand?.wareId,
            amount: currentCommand?.amount
          });
          actionTimerRef.current = 0;

          if (currentCommand?.type === 'trade-sell') {
             advanceCommand(true);
          } else {
             // Check next command and transition directly to avoid React batching issues
             const nextCmdIndex = currentCommandIndex + 1;
             const nextCmd = fleet.commandQueue?.[nextCmdIndex];
             if (nextCmd?.type === 'undock') {
               setLocalState('undocking');
               setCurrentCommandIndex(nextCmdIndex);
             } else if (nextCmd?.type === 'load-cargo') {
               setLocalState('loading');
               actionTimerRef.current = 0;
               setCurrentCommandIndex(nextCmdIndex);
             } else if (nextCmd?.type === 'unload-cargo') {
               // Another unload operation
               actionTimerRef.current = 0;
               setCurrentCommandIndex(nextCmdIndex);
             } else {
               setLocalState('docked');
               advanceCommand(true);
             }
          }
        }
        break;
      }

      case 'undocking': {
        // Accelerate away from station
        // Use a consistent away direction (stored in first frame of undocking)
        if (actionTimerRef.current < 0.1) {
          // Pick a random away direction on first frame
          tmpDir.set(
            Math.random() - 0.5,
            (Math.random() - 0.5) * 0.2,
            Math.random() - 0.5
          ).normalize();
          // Store in velocity as initial direction
          velocityRef.current.copy(tmpDir).multiplyScalar(10);
        }

        // Accelerate in current velocity direction
        tmpDir.copy(velocityRef.current).normalize();
        velocityRef.current.add(tmpDir.multiplyScalar(shipAccel * 0.8 * delta));

        // Clamp speed
        const undockSpeed = velocityRef.current.length();
        if (undockSpeed > shipMaxSpeed * 0.5) {
          velocityRef.current.multiplyScalar((shipMaxSpeed * 0.5) / undockSpeed);
        }

        ship.position.add(velocityRef.current.clone().multiplyScalar(delta));

        // Face velocity direction
        if (undockSpeed > 5) {
          tmpDir.copy(velocityRef.current).normalize();
          const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
          ship.quaternion.slerp(targetQuat, delta * TURN_RATE);
        }

        // After some time, consider undocked
        actionTimerRef.current += delta;
        if (actionTimerRef.current >= 3) {
          report('undocked');
          actionTimerRef.current = 0;
          holdDockRef.current = false;

          if (currentCommand?.type === 'trade-buy' || currentCommand?.type === 'trade-sell') {
             setLocalState('idle');
          } else {
             // Check next command and transition directly to avoid React batching issues
             const nextCmdIndex = currentCommandIndex + 1;
             const nextCmd = fleet.commandQueue?.[nextCmdIndex];
             if (nextCmd?.type === 'goto-station') {
               const stationPos = nextCmd.targetStationId ? stationPositions.get(nextCmd.targetStationId) : null;
               if (stationPos) {
                 setLocalState('flying-to-station');
                 buildPathTo(new Vector3(stationPos[0], stationPos[1], stationPos[2]));
                 dockAnchorRef.current = new Vector3(stationPos[0], stationPos[1], stationPos[2]);
                 setCurrentCommandIndex(nextCmdIndex);
               } else {
                 // Station not found, skip
                 setLocalState('idle');
                 setCurrentCommandIndex(nextCmdIndex + 1);
               }
             } else if (nextCmd?.type === 'goto-gate') {
               const gateData = nextCmd.targetSectorId ? getGateData(nextCmd.targetSectorId) : null;
               if (gateData) {
                 setLocalState('flying-to-gate');
                 buildPathTo(gateData.pos);
                 setCurrentCommandIndex(nextCmdIndex);
               } else {
                 setLocalState('idle');
                 setCurrentCommandIndex(nextCmdIndex + 1);
               }
             } else if (nextCmd?.type === 'use-gate') {
               const gateData = nextCmd.targetSectorId ? getGateData(nextCmd.targetSectorId) : null;
               if (gateData) {
                 setLocalState('entering-gate');
                 buildPathTo(gateData.pos);
                 setCurrentCommandIndex(nextCmdIndex);
               } else {
                 setLocalState('idle');
                 setCurrentCommandIndex(nextCmdIndex + 1);
               }
             } else {
               setLocalState('idle');
               advanceCommand();
             }
          }
        }
        break;
      }

      case 'entering-gate': {
        if (!currentCommand?.targetSectorId) break;

        const gateData = getGateData(currentCommand.targetSectorId);
        if (gateData) {
          const gatePos = gateData.pos;
          const gateRadius = gateData.radius;
          if (performance.now() > nextRepathAtRef.current || pathRef.current.length === 0) {
            buildPathTo(gatePos);
          }
          const waypoint = getCurrentWaypoint(gatePos);
          const dist = ship.position.distanceTo(gatePos);

          // Accelerate into the gate
          tmpDir.copy(waypoint || gatePos).sub(ship.position).normalize();
          // Disable obstacle avoidance when very near the gate to prevent jitter
          if (dist > gateRadius * 0.5) {
            const avoidance = new Vector3();
            for (const o of obstacles) {
              const offset = ship.position.clone().sub(o.center);
              const d = offset.length();
              if (d < o.radius + 160 && d > 1e-3) {
                const strength = (o.radius + 160 - d) / (o.radius + 160);
                avoidance.add(offset.normalize().multiplyScalar(strength));
              }
            }
            if (avoidance.lengthSq() > 0) {
              tmpDir.add(avoidance.multiplyScalar(1.5)).normalize();
            }
          }

          // Desired velocity toward gate
          tmpVec.copy(tmpDir).multiplyScalar(shipMaxSpeed * 0.8);

          // Accelerate
          const velDiff = tmpVec.clone().sub(velocityRef.current);
          const accelMag = Math.min(shipAccel * 2 * delta, velDiff.length());
          if (accelMag > 0.01) {
            velDiff.normalize().multiplyScalar(accelMag);
            velocityRef.current.add(velDiff);
          }

          ship.position.add(velocityRef.current.clone().multiplyScalar(delta));

          // Face gate
          if (velocityRef.current.lengthSq() > 25) {
            tmpDir.copy(velocityRef.current).normalize();
            const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
            ship.quaternion.slerp(targetQuat, delta * TURN_RATE * 2);
          }
          const enterRadius = Math.max(120, gateRadius * 0.6);
          if (dist < enterRadius) {
            // Entered the gate - move to destination sector and keep simulating
            const targetSectorId = currentCommand.targetSectorId;
            const isTrade = currentCommand.type === 'trade-buy' || currentCommand.type === 'trade-sell';
            enterGate(targetSectorId, gatePos, !isTrade);
          }
        }
        break;
      }
    }
  });

  // Don't render if ship has left the sector
  if (localState === 'gone') {
    return null;
  }

  return (
    <group ref={setShipRef}>
      {/* Rotate model 180° so forward thrust matches visuals */}
      <group rotation={[0, Math.PI, 0]}>
        <ShipModel
          modelPath={fleet.modelPath}
          name={fleet.name}
          enableLights={false}
        />
      </group>
    </group>
  );
};

export default NPCTrader;
