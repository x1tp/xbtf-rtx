import type { FC } from 'react';
import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Quaternion } from 'three';
import { ShipModel } from './ShipModel';
import { useGameStore, type GameState } from '../store/gameStore';
import type { NPCFleet, ShipReportType } from '../types/simulation';

interface GateInfo {
  position: [number, number, number];
  destinationSectorId: string;
}

interface NPCTraderProps {
  fleet: NPCFleet;
  stationPositions: Map<string, [number, number, number]>;
  gatePositions: GateInfo[];
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
const GATE_DISTANCE = 150;     // Distance to enter a gate
const ARRIVAL_DISTANCE = 50;   // Distance to complete arrival

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
  onReport 
}) => {
  const shipRef = useRef<Group | null>(null);
  const velocityRef = useRef(new Vector3());
  const orbitAngleRef = useRef(Math.random() * Math.PI * 2);
  const initializedRef = useRef(false);
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

  // Get gate position for a destination sector
  const getGatePosition = useCallback((destSectorId: string): Vector3 | null => {
    const gate = gatePositions.find(g => g.destinationSectorId === destSectorId);
    if (gate) {
      return new Vector3(gate.position[0], gate.position[1], gate.position[2]);
    }
    return null;
  }, [gatePositions]);

  // Report an action to the backend
  const report = useCallback((type: ShipReportType, extra?: { stationId?: string; wareId?: string; amount?: number }) => {
    const ship = shipRef.current;
    if (!ship || !onReport) return;
    
    const reportKey = `${type}-${extra?.stationId || ''}-${extra?.wareId || ''}`;
    if (lastReportRef.current === reportKey) return; // Prevent duplicate reports
    lastReportRef.current = reportKey;
    
    onReport(fleet.id, type, {
      sectorId: fleet.currentSectorId,
      position: [ship.position.x, ship.position.y, ship.position.z],
      ...extra
    });
  }, [fleet.id, fleet.currentSectorId, onReport]);

  // Advance to next command
  const advanceCommand = useCallback(() => {
    setCurrentCommandIndex(prev => prev + 1);
    actionTimerRef.current = 0;
    setLocalState('idle');
  }, []);

  // Process current command to determine what to do
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
          // Check if station is in current sector or need gate travel
          const stationPos = currentCommand.targetStationId ? 
            stationPositions.get(currentCommand.targetStationId) : null;
          if (stationPos) {
            setLocalState('flying-to-station');
          } else {
            // Station not in current sector - need to find gate
            // For now, just go idle - backend should issue goto-gate command
            console.log(`[NPCTrader] Station ${currentCommand.targetStationId} not in sector`);
          }
        }
        break;
        
      case 'goto-gate':
        if (localState === 'idle') {
          setLocalState('flying-to-gate');
        }
        break;
        
      case 'dock':
        if (localState === 'idle') {
          setLocalState('docking');
        }
        break;
        
      case 'load-cargo':
        if (localState === 'idle' || localState === 'docked') {
          setLocalState('loading');
          actionTimerRef.current = 0;
        }
        break;
        
      case 'unload-cargo':
        if (localState === 'idle' || localState === 'docked') {
          setLocalState('unloading');
          actionTimerRef.current = 0;
        }
        break;
        
      case 'undock':
        if (localState === 'idle' || localState === 'docked') {
          setLocalState('undocking');
        }
        break;
        
      case 'use-gate':
        if (localState === 'idle') {
          setLocalState('entering-gate');
        }
        break;
        
      case 'patrol':
      case 'wait':
        // Stay idle, just patrol/orbit
        break;
    }
  }, [currentCommand, localState, stationPositions]);

  // Main simulation loop
  useFrame((_, rawDelta) => {
    const ship = shipRef.current;
    if (!ship || localState === 'gone') return;
    
    const delta = rawDelta * timeScale;
    const shipMaxSpeed = MAX_SPEED * fleet.speed;
    const shipAccel = ACCELERATION * fleet.speed;

    switch (localState) {
      case 'idle': {
        // Gentle orbit / patrol - slowly drift and rotate
        orbitAngleRef.current += delta * 0.02;
        
        // Apply gentle thrust in orbit direction
        tmpDir.set(
          Math.cos(orbitAngleRef.current),
          0,
          Math.sin(orbitAngleRef.current)
        ).multiplyScalar(shipAccel * 0.1);
        
        velocityRef.current.add(tmpDir.multiplyScalar(delta));
        
        // Limit patrol speed
        const patrolSpeed = velocityRef.current.length();
        if (patrolSpeed > 20) {
          velocityRef.current.multiplyScalar(20 / patrolSpeed);
        }
        
        // Apply velocity
        ship.position.add(velocityRef.current.clone().multiplyScalar(delta));
        
        // Face velocity direction
        if (velocityRef.current.lengthSq() > 1) {
          tmpDir.copy(velocityRef.current).normalize();
          const targetQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tmpDir);
          ship.quaternion.slerp(targetQuat, delta * TURN_RATE * 0.5);
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
        
        const dist = ship.position.distanceTo(targetPos);
        
        if (dist > DOCK_DISTANCE) {
          // Calculate desired direction
          tmpDir.copy(targetPos).sub(ship.position).normalize();
          
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
          advanceCommand();
        }
        break;
      }

      case 'flying-to-gate': {
        if (!currentCommand?.targetSectorId) break;
        
        const gatePos = getGatePosition(currentCommand.targetSectorId);
        if (!gatePos) {
          console.warn(`[NPCTrader] Cannot find gate to ${currentCommand.targetSectorId}`);
          advanceCommand();
          break;
        }
        
        const dist = ship.position.distanceTo(gatePos);
        
        if (dist > GATE_DISTANCE) {
          // Calculate desired direction
          tmpDir.copy(gatePos).sub(ship.position).normalize();
          
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
          advanceCommand();
        }
        break;
      }

      case 'docking': {
        // Slow approach for docking animation
        const stationId = currentCommand?.targetStationId || fleet.targetStationId;
        if (!stationId) break;
        
        const targetPos = getStationPosition(stationId);
        
        if (targetPos) {
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
            setLocalState('docked');
            report('docked', { stationId });
            advanceCommand();
          }
        }
        break;
      }

      case 'docked': {
        // Hold position with slight drift
        velocityRef.current.multiplyScalar(0.95);
        break;
      }

      case 'loading': {
        // Simulate loading time
        actionTimerRef.current += delta;
        if (actionTimerRef.current >= 3) { // 3 seconds to load
          report('cargo-loaded', { 
            stationId: currentCommand?.targetStationId || fleet.targetStationId,
            wareId: currentCommand?.wareId,
            amount: currentCommand?.amount
          });
          setLocalState('docked');
          advanceCommand();
          actionTimerRef.current = 0;
        }
        break;
      }

      case 'unloading': {
        // Simulate unloading time
        actionTimerRef.current += delta;
        if (actionTimerRef.current >= 2) { // 2 seconds to unload
          report('cargo-unloaded', { 
            stationId: currentCommand?.targetStationId || fleet.targetStationId,
            wareId: currentCommand?.wareId,
            amount: currentCommand?.amount
          });
          setLocalState('docked');
          advanceCommand();
          actionTimerRef.current = 0;
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
          advanceCommand();
          actionTimerRef.current = 0;
        }
        break;
      }

      case 'entering-gate': {
        if (!currentCommand?.targetSectorId) break;
        
        const gatePos = getGatePosition(currentCommand.targetSectorId);
        if (gatePos) {
          const dist = ship.position.distanceTo(gatePos);
          
          // Accelerate into the gate
          tmpDir.copy(gatePos).sub(ship.position).normalize();
          
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
          
          if (dist < 50) {
            // Entered the gate - disappear
            report('entered-sector', { stationId: currentCommand.targetSectorId });
            setLocalState('gone');
            advanceCommand();
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
      <ShipModel 
        modelPath={fleet.modelPath} 
        name={fleet.name}
        enableLights={false}
      />
    </group>
  );
};

export default NPCTrader;
