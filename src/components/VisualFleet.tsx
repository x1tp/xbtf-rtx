import type { FC } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Quaternion } from 'three';
import { ShipModel } from './ShipModel';
import type { NPCFleet } from '../types/simulation';
import { FleetSimulator } from '../simulation/FleetSimulator';

interface VisualFleetProps {
    fleet: NPCFleet;
}

const tmpVec = new Vector3();
const tmpQuat = new Quaternion();
const UP = new Vector3(0, 0, 1);

export const VisualFleet: FC<VisualFleetProps> = ({ fleet }) => {
    const groupRef = useRef<Group | null>(null);
    // We use a ref to track the last seen fleet ID to handle pooling/swapping if needed, 
    // though generally key={fleet.id} prevents this.

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        // Direct read from Simulator state first (most up to date)
        const simState = FleetSimulator.getInstance().getFleetState(fleet.id);

        if (simState && simState.localState !== 'gone') {
            const vel = simState.velocity;

            // Interpolate position? 
            // Logic: The simulator updates fleet.position every frame. 
            // We can just read fleet.position. 
            // Note: fleet object might be stale if store updated and we haven't re-rendered.
            // But fleet is passed as prop?

            // Best approach: Read from simState if available, fall back to fleet prop.
            // simState has NO position, only velocity? 
            // No, FleetRuntimeState uses fleet.position for storage? 
            // FleetSimulator updates fleet.position in place.

            // Actually, let's trust the fleet object passed in props IS the object being mutated 
            // OR the simulator is mutating the store's object.

            // Wait, if Zustand re-creates the fleet object on store update, the 'fleet' prop here might be new,
            // but Simulator might be holding the OLD fleet object ref if we aren't careful?
            // Simulator iterates `useGameStore.getState().fleets`. So it always gets the LATEST array.
            // So it mutates the LATEST object.
            // The `fleet` prop here might be older if React hasn't re-rendered yet.
            // But we want to render the LATEST position.

            // So: Find the fleet in the Sim's view of the world?
            // Or just trust that Sim operates on the same memory?

            // Safest: Sim updates `fleet.position`. We read `fleet.position`.
            // If Sim and React have diverged, we might see jitter.
            // Better: Sim maintains its own "authoritative" position in `FleetRuntimeState`? 
            // No, `FleetRuntimeState` relies on `fleet.position` in `updateFleetPhysics`.

            // Let's modify `FleetRuntimeState` to hold `position: Vector3` and sync it to fleet object.
            // I'll update FleetSimulator.ts to do that.

            // For now, let's assume fleet.position is updated.
            groupRef.current.position.set(fleet.position[0], fleet.position[1], fleet.position[2]);

            // Orientation
            if (vel.lengthSq() > 1) {
                tmpVec.copy(vel).normalize();
                tmpQuat.setFromUnitVectors(UP, tmpVec);
                groupRef.current.quaternion.slerp(tmpQuat, delta * 2.0);
            }
        } else {
            // If logic says gone, hide it
            groupRef.current.visible = false;
            // Or render based on fleet prop if sim is missing (static?)
            if (!simState) {
                groupRef.current.position.set(fleet.position[0], fleet.position[1], fleet.position[2]);
            }
        }
    });

    return (
        <group ref={groupRef}>
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
