export type BlueprintObject = {
    name: string;
    modelPath: string;
    position: [number, number, number];
    scale?: number;
    rotationAxis?: 'x' | 'y' | 'z';
    rotationSpeed?: number;
    collisions?: boolean;
    rotation?: [number, number, number];
};

export interface SeizewellLayout {
    sun: { position: [number, number, number]; size: number; color: string; intensity: number };
    planet: { position: [number, number, number]; size: number };
    stations: BlueprintObject[];
    gates: BlueprintObject[];
    ships: BlueprintObject[];
    asteroids: { count: number; range: number; center: [number, number, number] };
    playerStart?: [number, number, number];
}

/**
 * Seizewell layout derived from the supplied blueprint. Positions are taken
 * directly from the map annotations (x, y, z). These can be tweaked in the
 * editor if you need tighter alignment.
 */
export const SEIZEWELL_BLUEPRINT: SeizewellLayout = {
    // Use a roughly Earth-sized planet (meters) but push it farther out so its
    // apparent size stays close to the previous view.
    // Push the sun to a near-realistic scale: ~1 AU from the origin along the original direction vector,
    // with an actual solar radius so its apparent size matches reality.
    sun: { position: [115_200_000_000, 76_800_000_000, 57_600_000_000], size: 696_340_000, color: '#ffdfc4', intensity: 14.0 },
    planet: { position: [-453400, -170400, -8430000], size: 6371000 },
    asteroids: { count: 520, range: 1400, center: [40, 40, -160] },
    playerStart: [0, 50, 900],
    stations: [
        { name: 'Teladi Trading Station', modelPath: '/models/00001.obj', position: [-40, -10, -20], scale: 32, rotationAxis: 'z', rotationSpeed: -0.08, collisions: true },
        { name: 'Teladi Shipyard (a)', modelPath: '/models/00444.obj', position: [-120, -80, -140], scale: 38, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
        { name: 'Teladi Space Equipment Dock', modelPath: '/models/00448.obj', position: [120, -60, -120], scale: 34, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
        { name: 'Solar Power Plant (b)', modelPath: '/models/00285.obj', position: [-140, 0, 40], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
        { name: 'Solar Power Plant (delta)', modelPath: '/models/00285.obj', position: [-40, 40, 280], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
        { name: 'Sun Oil Refinery (beta)', modelPath: '/models/00283.obj', position: [20, -20, 160], scale: 32, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
        { name: 'Beta I.R.E. Laser Forge (alpha)', modelPath: '/models/00044.obj', position: [120, -20, 450], scale: 28, rotationAxis: 'y', rotationSpeed: 0.000, collisions: true },
        { name: 'Flower Farm (beta)', modelPath: '/models/00403.obj', position: [120, -20, 420], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
        { name: 'Flower Farm (gamma)', modelPath: '/models/00403.obj', position: [1120, 19, 308], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
        { name: 'Flower Farm (delta)', modelPath: '/models/00403.obj', position: [1190, 19, 380], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true }
    ],
    gates: [
        { name: 'West Gate', modelPath: '/models/00088.obj', position: [-1200, 0, 0], scale: 50, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0] },
        { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 900, 0], scale: 50, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0] },
        { name: 'East Gate', modelPath: '/models/00088.obj', position: [1200, 0, 0], scale: 50, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0] }
    ],
    ships: [
        { name: 'Teladi Destroyer Phoenix (M2)', modelPath: '/models/00140.obj', position: [550, 10, 200], scale: 20, rotationAxis: 'y', rotationSpeed: 0, collisions: false },
        { name: 'Albatross (TL)', modelPath: '/models/00187.obj', position: [590, 10, 300], scale: 18, rotationAxis: 'y', rotationSpeed: 0, collisions: false }
    ]
};
