import type { FC } from 'react';
import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Quaternion } from 'three';
import { ShipModel } from './ShipModel';
import { useGameStore, type GameState } from '../store/gameStore';
import type { NPCFleet, ShipReportType } from '../types/simulation';
import type { NavGraph, NavObstacle } from '../ai/navigation';
import { findPath } from '../ai/navigation';
import { findNextHop } from '../ai/universePathfinding';
import { getSectorLayoutById } from '../config/sector';

import { updateFleetPosition } from '../store/fleetPositions';

interface GateInfo {
  position: [number, number, number];
  destinationSectorId: string;
  radius?: number;
  gateType?: string;
}

interface NPCMilitaryProps {
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
    gateType?: string;
  }) => void;
}

const tmpVec = new Vector3();
const tmpDir = new Vector3();
const DOCK_DISTANCE = 80;      // Distance to be considered "at" a station
const ARRIVAL_DISTANCE = 50;   // Distance to complete arrival
const DOCK_HOLD_DAMPING = 0.9; // How aggressively to damp velocity while docked
const IDLE_DAMPING = 0.92;     // Idle damping to prevent jitter

// Ship flight characteristics (Military ships are generally faster/more agile)
const BASE_ACCELERATION = 20;       // Units per second squared
const MAX_SPEED = 220;         // Maximum velocity
const BASE_TURN_RATE = 2.0;         // How fast ship can rotate (radians per second factor)
const BRAKE_DISTANCE = 300;    // Start slowing down at this distance

/**
 * NPCMilitary - Autonomous NPC military/patrol ship
 */
export const NPCMilitary: FC<NPCMilitaryProps> = ({
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
  const lastPositionReportTimeRef = useRef(0);
  const lastStoreUpdateTimeRef = useRef(0);
  const timeScale = useGameStore((s: GameState) => s.timeScale);

  // Local autonomous state
  const [localState, setLocalState] = useState<'idle' | 'flying-to-station' | 'flying-to-gate' | 'docking' | 'docked' | 'undocking' | 'entering-gate' | 'patrolling' | 'gone'>('idle');
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const actionTimerRef = useRef(0);
  const lastReportRef = useRef<string>('');

  // Get current command from queue
  const currentCommand = useMemo(() => {
    const queue = fleet.commandQueue || [];
    return queue[currentCommandIndex] || null;
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

  // Get gate data for a destination sector
  const getGateData = useCallback((destSectorId: string): { pos: Vector3; radius: number; gateType?: string } | null => {
    let gate = gatePositions.find(g => g.destinationSectorId === destSectorId);
    
    // If not found, try pathfinding
    if (!gate && destSectorId !== fleet.currentSectorId) {
       const nextHop = findNextHop(fleet.currentSectorId, destSectorId);
       if (nextHop) {
         gate = gatePositions.find(g => g.destinationSectorId === nextHop);
       }
    }

    if (gate) {
      const radius = typeof gate.radius === 'number' ? gate.radius : 300;
      return { pos: new Vector3(gate.position[0], gate.position[1], gate.position[2]), radius, gateType: gate.gateType };
    }
    console.warn(`[NPCMilitary] Cannot find gate to ${destSectorId} from ${fleet.currentSectorId}`);
    return null;
  }, [gatePositions, fleet.currentSectorId]);

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
  const syncFleet = useCallback((updates: Partial<NPCFleet>) => {
    useGameStore.setState((state: GameState) => ({
      fleets: state.fleets.map((f) => (f.id === fleet.id ? { ...f, ...updates } : f)),
    }));
  }, [fleet.id]);

  const report = useCallback((type: ShipReportType, extra?: { stationId?: string; wareId?: string; amount?: number; sectorIdOverride?: string; gateType?: string }) => {
    const ship = shipRef.current;
    if (!ship || !onReport) return;
    const pos: [number, number, number] = [ship.position.x, ship.position.y, ship.position.z];

    if (type !== 'position-update') {
      const reportKey = `${type}-${extra?.stationId || ''}-${extra?.wareId || ''}`;
      if (lastReportRef.current === reportKey) return;
      lastReportRef.current = reportKey;
    }

    const { sectorIdOverride, gateType, ...restExtra } = extra || {};
    const sectorId = sectorIdOverride || fleet.currentSectorId;
    const stationId = extra?.stationId || currentCommand?.targetStationId || fleet.targetStationId;
    const payload = {
      sectorId,
      position: pos,
      stationId,
      gateType,
      ...restExtra,
    };

    onReport(fleet.id, type, payload);

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
      case 'undocked':
        positionUpdate.state = 'idle';
        break;
      case 'arrived-at-gate':
        positionUpdate.state = 'in-transit';
        positionUpdate.destinationSectorId = currentCommand?.targetSectorId || extra?.sectorIdOverride || positionUpdate.destinationSectorId;
        break;
      case 'entered-sector':
        positionUpdate.state = 'idle';
        positionUpdate.destinationSectorId = undefined;
        break;
      case 'position-update':
        positionUpdate.stateStartTime = undefined;
        break;
    }
    syncFleet(positionUpdate);
  }, [fleet.currentSectorId, fleet.id, onReport, syncFleet, currentCommand]);

  const advanceCommand = useCallback((preserveDocked = false) => {
    setCurrentCommandIndex(prev => prev + 1);
    actionTimerRef.current = 0;
    if (!preserveDocked) {
      setLocalState('idle');
    }
  }, []);

  const enterGate = useCallback((targetSectorId: string, gatePos: Vector3, shouldAdvance = true, usedGateType?: string) => {
    let exitGateType = usedGateType || 'N';
    if (!usedGateType) {
      if (Math.abs(gatePos.x) > Math.abs(gatePos.z)) {
        exitGateType = gatePos.x > 0 ? 'E' : 'W';
      } else {
        exitGateType = gatePos.z > 0 ? 'S' : 'N';
      }
    }
    
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
        let offX = 0, offZ = 0;
        
        if (expectedEntryGateType === 'W') offX = offset;
        else if (expectedEntryGateType === 'E') offX = -offset;
        else if (expectedEntryGateType === 'N') offZ = offset;
        else if (expectedEntryGateType === 'S') offZ = -offset;
        
        destPos = [gx + offX, gy, gz + offZ];
    }

    report('entered-sector', { stationId: targetSectorId, sectorIdOverride: targetSectorId, gateType: exitGateType, position: destPos });
    
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
    setLocalState('gone');
    if (shouldAdvance) {
      advanceCommand(true);
    } else {
      setLocalState('idle');
    }
  }, [advanceCommand, fleet.id, report]);

  // Reset state when sector changes (arrived in new sector)
  const prevSectorIdRef = useRef(fleet.currentSectorId);
  useEffect(() => {
    if (fleet.currentSectorId !== prevSectorIdRef.current) {
       prevSectorIdRef.current = fleet.currentSectorId;
       initializedRef.current = false;
       // Only reset to idle if we were gone (in transit)
       if (localState === 'gone') {
         setLocalState('idle');
       }
       // Reset docking state to prevent teleportation to previous dock location
       holdDockRef.current = false;
       dockAnchorRef.current = null;
    }
  }, [fleet.currentSectorId, localState]);

  // Process current command
  useEffect(() => {
    if (!currentCommand) {
      if (localState !== 'idle' && localState !== 'gone') {
        setLocalState('idle');
      }
      return;
    }

    switch (currentCommand.type) {
      case 'goto-station':
        if (localState === 'idle') {
          const targetSector = currentCommand.targetSectorId;
          const needsTravel = targetSector && targetSector !== fleet.currentSectorId;
          
          if (needsTravel) {
             setLocalState('flying-to-gate');
             syncFleet({ state: 'in-transit', destinationSectorId: targetSector, stateStartTime: Date.now() });
             const gateData = getGateData(targetSector);
             buildPathTo(gateData?.pos || null);
          } else {
             const stationPos = currentCommand.targetStationId ?
               stationPositions.get(currentCommand.targetStationId) : null;
             if (stationPos) {
               setLocalState('flying-to-station');
               syncFleet({ state: 'idle', targetStationId: currentCommand.targetStationId, stateStartTime: Date.now() });
               buildPathTo(new Vector3(stationPos[0], stationPos[1], stationPos[2]));
               dockAnchorRef.current = new Vector3(stationPos[0], stationPos[1], stationPos[2]);
               holdDockRef.current = false;
             } else {
               advanceCommand();
             }
          }
        }
        break;

      case 'goto-gate':
        if (localState === 'idle') {
          setLocalState('flying-to-gate');
          syncFleet({ state: 'in-transit', destinationSectorId: currentCommand.targetSectorId, stateStartTime: Date.now() });
          const gateData = currentCommand.targetSectorId ? getGateData(currentCommand.targetSectorId) : null;
          buildPathTo(gateData?.pos || null);
        }
        break;

      case 'dock':
        if (localState === 'idle') {
          const stationPos = currentCommand.targetStationId ? stationPositions.get(currentCommand.targetStationId) : null;
          if (stationPos) {
            setLocalState('docking');
            syncFleet({ state: 'docking', targetStationId: currentCommand.targetStationId, stateStartTime: Date.now() });
            dockAnchorRef.current = new Vector3(stationPos[0], stationPos[1], stationPos[2]);
          } else {
            advanceCommand();
          }
        }
        break;

      case 'undock':
        if (localState === 'docked') {
          setLocalState('undocking');
          syncFleet({ state: 'undocking', stateStartTime: Date.now() });
        }
        break;

      case 'use-gate':
        if (localState === 'idle') {
          setLocalState('entering-gate');
          syncFleet({ state: 'in-transit', destinationSectorId: currentCommand.targetSectorId, stateStartTime: Date.now() });
          const gateData = currentCommand.targetSectorId ? getGateData(currentCommand.targetSectorId) : null;
          buildPathTo(gateData?.pos || null);
        }
        break;

      case 'patrol':
        if (localState === 'idle') {
          setLocalState('patrolling');
          syncFleet({ state: 'idle', stateStartTime: Date.now() });
          // Pick a random patrol point
          const range = 8000;
          const patrolPoint = new Vector3(
            (Math.random() - 0.5) * range,
            (Math.random() - 0.5) * range * 0.2,
            (Math.random() - 0.5) * range
          );
          buildPathTo(patrolPoint);
        }
        break;
      
      case 'wait':
        break;
    }
  }, [currentCommand, localState, stationPositions, buildPathTo, getGateData, fleet.currentSectorId, fleet.targetStationId, syncFleet]);

  // Main simulation loop
  useFrame((_, rawDelta) => {
    const ship = shipRef.current;
    if (!ship || localState === 'gone') return;

    const delta = rawDelta * timeScale;
    
    // Adjust physics based on ship class (Military ships have better stats)
    let physicsMult = 1.2;
    const shipAccel = BASE_ACCELERATION * physicsMult;
    const shipMaxSpeed = MAX_SPEED * physicsMult;
    const turnRate = BASE_TURN_RATE * physicsMult;

    // Movement Logic
    if (localState === 'docked') {
      if (dockAnchorRef.current) {
         ship.position.lerp(dockAnchorRef.current, 0.1);
         velocityRef.current.multiplyScalar(DOCK_HOLD_DAMPING);
      }
    } else if (localState === 'undocking') {
       // Simple undock: move away from dock anchor
       if (dockAnchorRef.current) {
          const away = ship.position.clone().sub(dockAnchorRef.current).normalize();
          velocityRef.current.add(away.multiplyScalar(shipAccel * delta));
          ship.position.add(velocityRef.current.clone().multiplyScalar(delta));
          
          if (ship.position.distanceTo(dockAnchorRef.current) > DOCK_DISTANCE + 50) {
             setLocalState('idle');
             report('undocked');
             advanceCommand();
          }
       }
    } else if (localState === 'docking') {
       if (dockAnchorRef.current) {
          const dist = ship.position.distanceTo(dockAnchorRef.current);
          if (dist < ARRIVAL_DISTANCE) {
             setLocalState('docked');
             report('docked');
             advanceCommand(true); // Preserve docked state
          } else {
             // Fly towards dock
             const dir = dockAnchorRef.current.clone().sub(ship.position).normalize();
             const desiredVel = dir.multiplyScalar(shipMaxSpeed * 0.5); // Approach slower
             velocityRef.current.lerp(desiredVel, delta);
             ship.position.add(velocityRef.current.clone().multiplyScalar(delta));
             
             // Face target
             const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir);
             ship.quaternion.slerp(targetQuat, delta * turnRate);
          }
       }
    } else {
      // Flying states (station, gate, patrol)
      switch (localState) {
        case 'flying-to-station':
        case 'flying-to-gate':
        case 'entering-gate':
        case 'patrolling': {
          if (localState === 'patrolling') {
             if (performance.now() > nextRepathAtRef.current || pathRef.current.length === 0) {
                const range = 8000;
                const patrolPoint = new Vector3(
                  (Math.random() - 0.5) * range,
                  (Math.random() - 0.5) * range * 0.2,
                  (Math.random() - 0.5) * range
                );
                buildPathTo(patrolPoint);
             }
          }
          
          const target = getCurrentWaypoint(pathRef.current[pathRef.current.length - 1]);
          if (!target) {
              // Reached end of path
              if (localState === 'flying-to-station') {
                  // Switch to docking if close enough? 
                  // For now, let 'dock' command handle the actual docking.
                  // Just switch to idle and let next command take over.
                  // But usually goto-station is followed by dock.
                  setLocalState('idle');
                  report('arrived-at-station');
                  advanceCommand();
              } else if (localState === 'patrolling') {
                  nextRepathAtRef.current = 0; // Force repath
              }
              break;
          }

          const dist = ship.position.distanceTo(target);
          
          // Calculate desired direction
          tmpDir.copy(target).sub(ship.position).normalize();
          
          // Obstacle Avoidance
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

          // Desired velocity
          let desiredSpeed = shipMaxSpeed;
          // Slow down if arriving
          if (pathIndexRef.current >= pathRef.current.length - 1 && dist < BRAKE_DISTANCE) {
             desiredSpeed = Math.max(20, shipMaxSpeed * (dist / BRAKE_DISTANCE));
          }
          if (localState === 'patrolling') {
             desiredSpeed *= 0.6; // Patrol slower
          }

          tmpVec.copy(tmpDir).multiplyScalar(desiredSpeed);

          // Accelerate
          const velDiff = tmpVec.clone().sub(velocityRef.current);
          const accelMag = Math.min(shipAccel * delta, velDiff.length());
          if (accelMag > 0.01) {
            velDiff.normalize().multiplyScalar(accelMag);
            velocityRef.current.add(velDiff);
          }

          ship.position.add(velocityRef.current.clone().multiplyScalar(delta));

          // Rotate ship
          if (velocityRef.current.lengthSq() > 5) {
            tmpDir.copy(velocityRef.current).normalize();
            const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
            ship.quaternion.slerp(targetQuat, delta * turnRate);
          }

          // Gate entry check
          if (localState === 'entering-gate' || localState === 'flying-to-gate') {
              // Check if we are close to ANY gate that matches our target
              const gateData = currentCommand?.targetSectorId ? getGateData(currentCommand.targetSectorId) : null;
              if (gateData && dist < 200) { // Close to target gate pos
                  const enterRadius = Math.max(120, gateData.radius * 0.6);
                  if (dist < enterRadius) {
                      const finalDest = currentCommand?.targetSectorId || fleet.currentSectorId;
                      const nextHop = findNextHop(fleet.currentSectorId, finalDest);
                      const actualTarget = nextHop || finalDest;
                      const isFinalDest = actualTarget === finalDest;
                      
                      enterGate(actualTarget, gateData.pos, isFinalDest, gateData.gateType); // Advance if reached final dest
                  }
              }
          }
          
          if (pathRef.current.length <= 1 && dist < 100 && localState === 'patrolling') {
               nextRepathAtRef.current = 0; 
          }
          break;
        }
      }
    }

    // Stuck detection
    const now = performance.now();
    if (localState === 'flying-to-station' || localState === 'flying-to-gate' || localState === 'entering-gate' || localState === 'patrolling') {
       if (now - lastProgressSampleRef.current.time > 1000) {
          const moved = ship.position.distanceTo(lastProgressSampleRef.current.pos);
          if (moved < 5) {
             lastProgressSampleRef.current.stuckTime += 1;
             if (lastProgressSampleRef.current.stuckTime > 5) {
                // Stuck - force repath
                if (localState === 'patrolling') {
                    nextRepathAtRef.current = 0;
                } else {
                    const target = pathRef.current[pathRef.current.length - 1];
                    buildPathTo(target); // Rebuild path
                }
                lastProgressSampleRef.current.stuckTime = 0;
             }
          } else {
             lastProgressSampleRef.current.stuckTime = 0;
          }
          lastProgressSampleRef.current.time = now;
          lastProgressSampleRef.current.pos.copy(ship.position);
       }
    }

    // Periodic position reporting
    if (now - lastStoreUpdateTimeRef.current > 100) {
      const pos: [number, number, number] = [ship.position.x, ship.position.y, ship.position.z];
      updateFleetPosition(fleet.id, pos);
      lastStoreUpdateTimeRef.current = now;
    }

    if (now - lastPositionReportTimeRef.current > 1000) {
      report('position-update');
      lastPositionReportTimeRef.current = now;
    }
  });

  if (localState === 'gone') {
    return null;
  }

  return (
    <group ref={setShipRef}>
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
