
export const SHIP_CATALOG = {
    vulture: {
        id: 'vulture',
        name: 'Vulture',
        cost: 85000,
        capacity: 2800,
        speed: 1.0,
        modelPath: '/models/00007.obj',
        description: "The Teladi Vulture is a robust mining and transport vessel. Known for its sturdy hull and large cargo bay, it is the backbone of Teladi commerce. While slow, its reliability is unmatched in the sector."
    },
    albatross: {
        id: 'albatross',
        name: 'Albatross',
        cost: 450000,
        capacity: 8000,
        speed: 0.7,
        modelPath: '/models/00187.obj',
        description: "A heavy transport class (TL) ship, the Albatross is designed to move station components and massive quantities of bulk goods. It is sluggish and vulnerable without escorts, but essential for industrial expansion."
    },
    express: {
        id: 'express',
        name: 'Express',
        cost: 60000,
        capacity: 1500,
        speed: 1.6,
        modelPath: '/models/00007.obj',
        description: "The Argon Express is a rapid personnel and light cargo transport. Its high speed allows it to outrun most pirates, making it a favorite for blockade running and urgent deliveries."
    },
    toucan: {
        id: 'toucan',
        name: 'Toucan',
        cost: 55000,
        capacity: 1600,
        speed: 1.5,
        modelPath: '/models/00007.obj',
        description: "The Teladi Toucan is a specialized light transport. It strikes a balance between speed and capacity, often used for transporting high-value technology components across dangerous sectors."
    },
    buster: {
        id: 'buster',
        name: 'Buster Fighter',
        cost: 400000,
        capacity: 100,
        speed: 2.5,
        modelPath: '/models/00140.obj',
        description: "The classic M4 Interceptor. The Buster offers a good mix of speed, shielding, and firepower. It is the standard patrol craft for the Argon Federation."
    },
    discoverer: {
        id: 'discoverer',
        name: 'Discoverer Scout',
        cost: 60000,
        capacity: 50,
        speed: 4.0,
        modelPath: '/models/00140.obj',
        description: "A fast M5 scout ship. The Discoverer sacrifices armor and cargo space for pure speed. It is ideal for exploration, satellite deployment, and hit-and-run tactics."
    },
} as const;

export type ShipType = keyof typeof SHIP_CATALOG;
