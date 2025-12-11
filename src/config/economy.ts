import { type RaceType, type Ware, type Recipe } from '../types/simulation'

export interface StationBlueprint {
    id: string
    name: string
    recipeId: string
    cost: number
    modelPath: string
    race: RaceType
}

// Mapping of Recipe ID to default blueprints (can be expanded later)
export const STATIONS_BY_RECIPE: Record<string, StationBlueprint[]> = {
    'spp_teladi': [
        { id: 'teladi_spp', name: 'Teladi Solar Power Plant', recipeId: 'spp_teladi', cost: 846104, modelPath: '/models/00285.obj', race: 'teladi' },
        { id: 'argon_spp', name: 'Argon Solar Power Plant', recipeId: 'spp_teladi', cost: 846104, modelPath: '/models/00184.obj', race: 'argon' },
        { id: 'paranid_spp', name: 'Paranid Solar Power Plant', recipeId: 'spp_teladi', cost: 846104, modelPath: '/models/00279.obj', race: 'paranid' },
        { id: 'split_spp', name: 'Split Solar Power Plant', recipeId: 'spp_teladi', cost: 846104, modelPath: '/models/00275.obj', race: 'split' },
        { id: 'boron_spp', name: 'Boron Solar Power Plant', recipeId: 'spp_teladi', cost: 846104, modelPath: '/models/00281.obj', race: 'boron' },
    ],
    'ore_mine': [
        { id: 'ore_mine', name: 'Ore Mine', recipeId: 'ore_mine', cost: 588256, modelPath: '/models/00114.obj', race: 'teladi' } // Using Silicon model as placeholder if distinct Ore not found
    ],
    'silicon_mine': [
        { id: 'silicon_mine', name: 'Silicon Mine', recipeId: 'silicon_mine', cost: 1118256, modelPath: '/models/00114.obj', race: 'teladi' }
    ],
    'flower_farm': [
        { id: 'teladi_flower_farm', name: 'Flower Farm', recipeId: 'flower_farm', cost: 461104, modelPath: '/models/00282.obj', race: 'teladi' },
        { id: 'argon_wheat_farm', name: 'Wheat Farm', recipeId: 'flower_farm', cost: 461104, modelPath: '/models/00182.obj', race: 'argon' }, // Mapping wheat to flower logic for now
    ],
    'oil_refinery': [
        { id: 'teladi_oil_refinery', name: 'Sun Oil Refinery', recipeId: 'oil_refinery', cost: 1661104, modelPath: '/models/00283.obj', race: 'teladi' }
    ],
    'teladianium_foundry': [
        // Fallback/Generic
        { id: 'teladianium_foundry', name: 'Teladianium Foundry', recipeId: 'teladianium_foundry', cost: 661104, modelPath: '/models/00283.obj', race: 'teladi' }
    ],
    'ire_forge': [
        { id: 'ire_forge', name: 'Beta I.R.E. Forge', recipeId: 'ire_forge', cost: 2861104, modelPath: '/models/00430.obj', race: 'teladi' }
    ],
    'hept_forge': [
        { id: 'hept_forge', name: 'HEPT Laser Forge', recipeId: 'hept_forge', cost: 3200000, modelPath: '/models/00440.obj', race: 'teladi' }
    ],
    'pac_forge': [
        { id: 'pac_forge', name: 'PAC Laser Forge', recipeId: 'pac_forge', cost: 2000000, modelPath: '/models/00442.obj', race: 'teladi' }
    ],
    'spaceweed_cycle': [
        // Using generic/Teladi defaults
        { id: 'dream_farm', name: 'Dream Farm', recipeId: 'spaceweed_cycle', cost: 1200000, modelPath: '/models/00282.obj', race: 'teladi' }
    ],
    'plankton_farm': [
        { id: 'plankton_farm', name: 'Plankton Farm', recipeId: 'plankton_farm', cost: 350000, modelPath: '/models/00067.obj', race: 'boron' }
    ],
    'bogas_plant': [
        { id: 'bogas_plant', name: 'BoGas Factory', recipeId: 'bogas_plant', cost: 420000, modelPath: '/models/00011.obj', race: 'boron' }
    ],
    'bofu_lab': [
        { id: 'bofu_lab', name: 'BoFu Chemical Lab', recipeId: 'bofu_lab', cost: 520000, modelPath: '/models/00011.obj', race: 'boron' }
    ],
    'argon_farm': [
        { id: 'argon_farm', name: 'Argon Farm', recipeId: 'argon_farm', cost: 400000, modelPath: '/models/00182.obj', race: 'argon' }
    ],
    'cahoona_bakery': [
        { id: 'cahoona_bakery', name: 'Cahoona Bakery', recipeId: 'cahoona_bakery', cost: 600000, modelPath: '/models/00183.obj', race: 'argon' }
    ],
    'scruffin_farm': [
        { id: 'scruffin_farm', name: 'Scruffin Farm', recipeId: 'scruffin_farm', cost: 380000, modelPath: '/models/00272.obj', race: 'split' }
    ],
    'rastar_refinery': [
        { id: 'rastar_refinery', name: 'Rastar Refinery', recipeId: 'rastar_refinery', cost: 520000, modelPath: '/models/00273.obj', race: 'split' }
    ],
    'quantum_tube_fab': [
        { id: 'quantum_tube_fab', name: 'Quantum Tube Fab', recipeId: 'quantum_tube_fab', cost: 900000, modelPath: '/models/00420.obj', race: 'teladi' },
        { id: 'argon_quantum_tube_fab', name: 'Argon Quantum Tube Fab', recipeId: 'quantum_tube_fab', cost: 900000, modelPath: '/models/00232.obj', race: 'argon' },
        { id: 'split_quantum_tube_fab', name: 'Split Quantum Tube Fab', recipeId: 'quantum_tube_fab', cost: 900000, modelPath: '/models/00237.obj', race: 'split' },
        { id: 'paranid_quantum_tube_fab', name: 'Paranid Quantum Tube Fab', recipeId: 'quantum_tube_fab', cost: 900000, modelPath: '/models/00213.obj', race: 'paranid' },
        { id: 'teladi_quantum_tube_fab', name: 'Teladi Quantum Tube Fab', recipeId: 'quantum_tube_fab', cost: 900000, modelPath: '/models/00420.obj', race: 'teladi' },
    ],
    'chip_plant': [
        { id: 'chip_plant', name: 'Chip Plant', recipeId: 'chip_plant', cost: 1100000, modelPath: '/models/00278.obj', race: 'paranid' },
        { id: 'boron_chip_plant', name: 'Boron Chip Plant', recipeId: 'chip_plant', cost: 1100000, modelPath: '/models/00280.obj', race: 'boron' },
    ],
    'computer_plant': [
        { id: 'computer_plant', name: 'Computer Plant', recipeId: 'computer_plant', cost: 1000000, modelPath: '/models/00431.obj', race: 'argon' },
    ],
    'logistics_hub': [
        { id: 'equipment_dock', name: 'Equipment Dock', recipeId: 'logistics_hub', cost: 1500000, modelPath: '/models/00448.obj', race: 'teladi' },
        { id: 'trading_station', name: 'Trading Station', recipeId: 'logistics_hub', cost: 1200000, modelPath: '/models/00001.obj', race: 'teladi' },
    ],
    'shipyard': [
        { id: 'shipyard', name: 'Shipyard', recipeId: 'shipyard', cost: 5000000, modelPath: '/models/00444.obj', race: 'teladi' },
    ],
}

export const getBlueprintFor = (recipeId: string, preferredRace: RaceType = 'teladi'): StationBlueprint | null => {
    const options = STATIONS_BY_RECIPE[recipeId]
    if (!options || options.length === 0) return null

    // Try to find preferred race
    const match = options.find(bp => bp.race === preferredRace)
    if (match) return match

    // Fallback to first available
    return options[0]
}

export const WARES_CONFIG: Ware[] = [
    // --- RAW RESOURCES (Minerals/Gases) ---
    { id: 'energy_cells', name: 'Energy Cells', category: 'primary', basePrice: 16, volume: 1 },
    { id: 'ore', name: 'Ore', category: 'primary', basePrice: 50, volume: 10 },
    { id: 'silicon_wafers', name: 'Silicon Wafers', category: 'primary', basePrice: 200, volume: 18 },
    { id: 'ice', name: 'Ice', category: 'primary', basePrice: 30, volume: 8 },
    { id: 'hydrogen', name: 'Hydrogen', category: 'primary', basePrice: 50, volume: 6 },
    { id: 'helium', name: 'Helium', category: 'primary', basePrice: 45, volume: 6 },
    { id: 'methane', name: 'Methane', category: 'primary', basePrice: 60, volume: 6 },
    { id: 'nividium', name: 'Nividium', category: 'primary', basePrice: 800, volume: 20 },

    // --- REFINED GOODS (Tier 1) ---
    { id: 'water', name: 'Water', category: 'intermediate', basePrice: 50, volume: 6 },
    { id: 'refined_metals', name: 'Refined Metals', category: 'intermediate', basePrice: 150, volume: 14 },
    { id: 'teladianium', name: 'Teladianium', category: 'intermediate', basePrice: 180, volume: 15 },
    { id: 'graphene', name: 'Graphene', category: 'intermediate', basePrice: 180, volume: 10 },
    { id: 'superfluid_coolant', name: 'Superfluid Coolant', category: 'intermediate', basePrice: 160, volume: 8 },
    { id: 'antimatter_cells', name: 'Antimatter Cells', category: 'intermediate', basePrice: 200, volume: 12 },

    // --- FOOD & BIO (Race Specific) ---
    // Teladi
    { id: 'sunrise_flowers', name: 'Sunrise Flowers', category: 'food', basePrice: 30, volume: 4 },
    { id: 'sun_oil', name: 'Sunrise Flowers Oil', category: 'food', basePrice: 80, volume: 5 },
    { id: 'nostrop_oil', name: 'Nostrop Oil', category: 'food', basePrice: 80, volume: 5 },
    // Argon
    { id: 'wheat', name: 'Wheat', category: 'food', basePrice: 30, volume: 4 },
    { id: 'cahoonas', name: 'Meatsteak Cahoonas', category: 'food', basePrice: 70, volume: 6 },
    { id: 'meat', name: 'Argnu Beef', category: 'food', basePrice: 40, volume: 6 },
    // Boron
    { id: 'plankton', name: 'Plankton', category: 'food', basePrice: 25, volume: 4 },
    { id: 'bogas', name: 'BoGas', category: 'food', basePrice: 40, volume: 6 },
    { id: 'bofu', name: 'BoFu', category: 'food', basePrice: 90, volume: 8 },
    // Split
    { id: 'scruffin_fruit', name: 'Scruffin Fruit', category: 'food', basePrice: 25, volume: 4 },
    { id: 'chelt_meat', name: 'Chelt Meat', category: 'food', basePrice: 50, volume: 6 },
    { id: 'rastar_oil', name: 'Rastar Oil', category: 'food', basePrice: 120, volume: 8 },
    // Paranid
    { id: 'soya_beans', name: 'Soya Beans', category: 'food', basePrice: 25, volume: 4 },
    { id: 'soya_husk', name: 'Soya Husk', category: 'food', basePrice: 100, volume: 7 },
    { id: 'maja_snails', name: 'Maja Snails', category: 'food', basePrice: 40, volume: 5 },
    { id: 'majaglit', name: 'Majaglit', category: 'end', basePrice: 60, volume: 2 },

    { id: 'swamp_plant', name: 'Swamp Plant', category: 'food', basePrice: 80, volume: 5 },
    { id: 'space_weed', name: 'Space Weed', category: 'food', basePrice: 500, volume: 3 },
    { id: 'space_fuel', name: 'Space Fuel', category: 'end', basePrice: 300, volume: 3 },

    // --- COMPONENTS (Tier 2 & 3) ---
    { id: 'hull_parts', name: 'Hull Parts', category: 'intermediate', basePrice: 250, volume: 15 },
    { id: 'engine_parts', name: 'Engine Components', category: 'intermediate', basePrice: 350, volume: 20 },
    { id: 'weapon_components', name: 'Weapon Components', category: 'intermediate', basePrice: 400, volume: 20 },
    { id: 'shield_components', name: 'Shield Components', category: 'intermediate', basePrice: 400, volume: 20 },
    { id: 'turret_components', name: 'Turret Components', category: 'intermediate', basePrice: 380, volume: 20 },
    { id: 'missile_components', name: 'Missile Components', category: 'intermediate', basePrice: 200, volume: 10 },
    { id: 'drone_components', name: 'Drone Components', category: 'intermediate', basePrice: 250, volume: 15 },
    { id: 'scanning_arrays', name: 'Scanning Arrays', category: 'intermediate', basePrice: 500, volume: 10 },
    { id: 'smart_chips', name: 'Smart Chips', category: 'intermediate', basePrice: 150, volume: 2 },
    { id: 'advanced_composites', name: 'Advanced Composites', category: 'intermediate', basePrice: 400, volume: 18 },
    { id: 'field_coils', name: 'Field Coils', category: 'intermediate', basePrice: 300, volume: 10 },
    { id: 'quantum_tubes', name: 'Quantum Tubes', category: 'intermediate', basePrice: 280, volume: 8 },
    { id: 'microchips', name: 'Microchips', category: 'intermediate', basePrice: 350, volume: 4 },
    { id: 'computer_components', name: 'Computer Components', category: 'intermediate', basePrice: 450, volume: 5 },

    // --- END PRODUCTS ---
    { id: 'crystals', name: 'Crystals', category: 'intermediate', basePrice: 1600, volume: 2 },
    { id: 'advanced_electronics', name: 'Advanced Electronics', category: 'end', basePrice: 900, volume: 12 },
    { id: 'claytronics', name: 'Claytronics', category: 'end', basePrice: 2000, volume: 20 },
    { id: 'ship_parts', name: 'Ship Parts', category: 'end', basePrice: 800, volume: 4 },
    { id: 'trade_goods', name: 'Trade Goods', category: 'end', basePrice: 300, volume: 5 },
    { id: 'passengers', name: 'Passengers', category: 'end', basePrice: 80, volume: 1 },

    // Equipment
    { id: '1mw_shield', name: '1MW Shield', category: 'end', basePrice: 3000, volume: 2 },
    { id: '5mw_shield', name: '5MW Shield', category: 'end', basePrice: 15000, volume: 4 },
    { id: '25mw_shield', name: '25MW Shield', category: 'end', basePrice: 85000, volume: 10 },
    { id: '125mw_shield', name: '125MW Shield', category: 'end', basePrice: 250000, volume: 10 },

    { id: 'ire_laser', name: 'IRE Laser', category: 'end', basePrice: 2980, volume: 5 },
    { id: 'pac_laser', name: 'PAC Laser', category: 'end', basePrice: 40000, volume: 6 },
    { id: 'hept_laser', name: 'HEPT Laser', category: 'end', basePrice: 120000, volume: 8 },

    { id: 'mosquito_missile', name: 'Mosquito Missile', category: 'end', basePrice: 150, volume: 1 },
    { id: 'wasp_missile', name: 'Wasp Missile', category: 'end', basePrice: 1000, volume: 1 },
    { id: 'hornet_missile', name: 'Hornet Missile', category: 'end', basePrice: 10000, volume: 3 },

    // --- SHIPS (High Volume Assets) ---
    { id: 'ship_vulture', name: 'Vulture Hauler', category: 'end', basePrice: 85000, volume: 500 },
    { id: 'ship_toucan', name: 'Toucan Transport', category: 'end', basePrice: 120000, volume: 500 },
    { id: 'ship_express', name: 'Express Hauler', category: 'end', basePrice: 150000, volume: 500 },
    { id: 'ship_buster', name: 'Buster Fighter', category: 'end', basePrice: 400000, volume: 300 },
    { id: 'ship_discoverer', name: 'Discoverer Scout', category: 'end', basePrice: 60000, volume: 100 },
]

export const RECIPES_CONFIG: Recipe[] = [
    // 1. RAW RESOURCE GATHERING (Mines/Pumps)
    { id: 'ore_mine', productId: 'ore', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 20, productStorageCap: 5000 },
    { id: 'silicon_mine', productId: 'silicon_wafers', inputs: [{ wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 80, batchSize: 10, productStorageCap: 2000 },
    { id: 'ice_mine', productId: 'ice', inputs: [{ wareId: 'energy_cells', amount: 8 }], cycleTimeSec: 60, batchSize: 30, productStorageCap: 4000 },
    { id: 'hydrogen_pump', productId: 'hydrogen', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 20, productStorageCap: 5000 },
    { id: 'helium_pump', productId: 'helium', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 20, productStorageCap: 5000 },
    { id: 'methane_pump', productId: 'methane', inputs: [{ wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 20, productStorageCap: 5000 },

    // 2. ENERGY
    { id: 'spp_teladi', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 2 }], cycleTimeSec: 60, batchSize: 300, productStorageCap: 20000 },
    { id: 'spp_argon', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 2 }], cycleTimeSec: 60, batchSize: 280, productStorageCap: 20000 },
    { id: 'spp_boron', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 2 }], cycleTimeSec: 60, batchSize: 290, productStorageCap: 20000 },
    { id: 'spp_split', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 2 }], cycleTimeSec: 50, batchSize: 250, productStorageCap: 20000 },
    { id: 'spp_paranid', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 2 }], cycleTimeSec: 60, batchSize: 280, productStorageCap: 20000 },
    { id: 'spp_xenon', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 0 }], cycleTimeSec: 10, batchSize: 50, productStorageCap: 10000 },

    // 3. REFINING (Tier 1)
    { id: 'water_refinery', productId: 'water', inputs: [{ wareId: 'ice', amount: 20 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 40, productStorageCap: 5000 },
    { id: 'ore_refinery', productId: 'refined_metals', inputs: [{ wareId: 'ore', amount: 20 }, { wareId: 'energy_cells', amount: 30 }], cycleTimeSec: 60, batchSize: 10, productStorageCap: 2000 },
    { id: 'teladianium_foundry', productId: 'teladianium', inputs: [{ wareId: 'ore', amount: 20 }, { wareId: 'energy_cells', amount: 30 }], cycleTimeSec: 60, batchSize: 12, productStorageCap: 2000 },
    { id: 'graphene_refinery', productId: 'graphene', inputs: [{ wareId: 'methane', amount: 20 }, { wareId: 'energy_cells', amount: 30 }], cycleTimeSec: 80, batchSize: 15, productStorageCap: 1500 },
    { id: 'coolant_factory', productId: 'superfluid_coolant', inputs: [{ wareId: 'helium', amount: 20 }, { wareId: 'energy_cells', amount: 30 }], cycleTimeSec: 80, batchSize: 15, productStorageCap: 1500 },
    { id: 'antimatter_cell_factory', productId: 'antimatter_cells', inputs: [{ wareId: 'hydrogen', amount: 20 }, { wareId: 'energy_cells', amount: 40 }], cycleTimeSec: 100, batchSize: 10, productStorageCap: 1000 },

    // 4. FOOD (Race Specific)
    { id: 'flower_farm', productId: 'sunrise_flowers', inputs: [{ wareId: 'water', amount: 10 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 90, batchSize: 40, productStorageCap: 2000 },
    { id: 'sun_oil_refinery', productId: 'sun_oil', inputs: [{ wareId: 'sunrise_flowers', amount: 20 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 120, batchSize: 20, productStorageCap: 1500 },

    { id: 'argon_cattle_ranch', productId: 'meat', inputs: [{ wareId: 'wheat', amount: 20 }, { wareId: 'water', amount: 10 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 120, batchSize: 15, productStorageCap: 1500 },
    { id: 'argon_wheat_farm', productId: 'wheat', inputs: [{ wareId: 'water', amount: 15 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 90, batchSize: 30, productStorageCap: 2000 },
    { id: 'cahoona_bakery', productId: 'cahoonas', inputs: [{ wareId: 'meat', amount: 10 }, { wareId: 'wheat', amount: 5 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 20, productStorageCap: 1500 },

    { id: 'plankton_farm', productId: 'plankton', inputs: [{ wareId: 'water', amount: 20 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 90, batchSize: 30, productStorageCap: 2000 },
    { id: 'bogas_plant', productId: 'bogas', inputs: [{ wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 60, batchSize: 20, productStorageCap: 1500 },
    { id: 'bofu_lab', productId: 'bofu', inputs: [{ wareId: 'bogas', amount: 10 }, { wareId: 'plankton', amount: 5 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 15, productStorageCap: 1500 },

    { id: 'chelt_aquarium', productId: 'chelt_meat', inputs: [{ wareId: 'water', amount: 10 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 20, productStorageCap: 1500 },
    { id: 'scruffin_farm', productId: 'scruffin_fruit', inputs: [{ wareId: 'water', amount: 10 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 30, productStorageCap: 2000 },
    { id: 'rastar_refinery', productId: 'rastar_oil', inputs: [{ wareId: 'chelt_meat', amount: 15 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 15, productStorageCap: 1500 },

    { id: 'soyfarm', productId: 'soya_beans', inputs: [{ wareId: 'water', amount: 15 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 30, productStorageCap: 2000 },
    { id: 'soyery', productId: 'soya_husk', inputs: [{ wareId: 'soya_beans', amount: 15 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 20, productStorageCap: 1500 },
    { id: 'snail_ranch', productId: 'maja_snails', inputs: [{ wareId: 'water', amount: 10 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 15, productStorageCap: 1500 },
    { id: 'majaglit_factory', productId: 'majaglit', inputs: [{ wareId: 'maja_snails', amount: 10 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 90, batchSize: 10, productStorageCap: 1000 },

    { id: 'dream_farm', productId: 'swamp_plant', inputs: [{ wareId: 'water', amount: 15 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 90, batchSize: 20, productStorageCap: 1500 },
    { id: 'bliss_place', productId: 'space_weed', inputs: [{ wareId: 'swamp_plant', amount: 20 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 120, batchSize: 5, productStorageCap: 500 },
    { id: 'space_fuel_distillery', productId: 'space_fuel', inputs: [{ wareId: 'wheat', amount: 20 }, { wareId: 'water', amount: 10 }, { wareId: 'energy_cells', amount: 15 }], cycleTimeSec: 120, batchSize: 5, productStorageCap: 500 },

    // 5. COMPONENTS (Tier 2/3)
    { id: 'hull_part_factory', productId: 'hull_parts', inputs: [{ wareId: 'refined_metals', amount: 10 }, { wareId: 'graphene', amount: 2 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 8, productStorageCap: 1000 },
    { id: 'hull_part_factory_teladi', productId: 'hull_parts', inputs: [{ wareId: 'teladianium', amount: 8 }, { wareId: 'graphene', amount: 2 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 8, productStorageCap: 1000 },
    { id: 'engine_part_factory', productId: 'engine_parts', inputs: [{ wareId: 'refined_metals', amount: 10 }, { wareId: 'antimatter_cells', amount: 4 }, { wareId: 'energy_cells', amount: 25 }], cycleTimeSec: 150, batchSize: 5, productStorageCap: 500 },
    { id: 'chip_plant', productId: 'microchips', inputs: [{ wareId: 'silicon_wafers', amount: 10 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 5, productStorageCap: 500 },
    { id: 'scanning_array_factory', productId: 'scanning_arrays', inputs: [{ wareId: 'microchips', amount: 4 }, { wareId: 'refined_metals', amount: 5 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 150, batchSize: 2, productStorageCap: 200 },
    { id: 'quantum_tube_fab', productId: 'quantum_tubes', inputs: [{ wareId: 'graphene', amount: 5 }, { wareId: 'superfluid_coolant', amount: 2 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 5, productStorageCap: 500 },
    { id: 'weapon_component_factory', productId: 'weapon_components', inputs: [{ wareId: 'hull_parts', amount: 5 }, { wareId: 'scanning_arrays', amount: 1 }, { wareId: 'energy_cells', amount: 30 }], cycleTimeSec: 180, batchSize: 5, productStorageCap: 500 },
    { id: 'shield_component_factory', productId: 'shield_components', inputs: [{ wareId: 'quantum_tubes', amount: 5 }, { wareId: 'field_coils', amount: 2 }, { wareId: 'energy_cells', amount: 30 }], cycleTimeSec: 180, batchSize: 5, productStorageCap: 500 },
    { id: 'field_coil_factory', productId: 'field_coils', inputs: [{ wareId: 'refined_metals', amount: 10 }, { wareId: 'superfluid_coolant', amount: 5 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 10, productStorageCap: 800 },
    { id: 'advanced_composite_factory', productId: 'advanced_composites', inputs: [{ wareId: 'graphene', amount: 10 }, { wareId: 'refined_metals', amount: 5 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 10, productStorageCap: 800 },
    { id: 'smart_chip_factory', productId: 'smart_chips', inputs: [{ wareId: 'silicon_wafers', amount: 2 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 60, batchSize: 20, productStorageCap: 1000 },

    // Crystals
    { id: 'crystal_fab_teladi', productId: 'crystals', inputs: [{ wareId: 'silicon_wafers', amount: 10 }, { wareId: 'sun_oil', amount: 5 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 5, productStorageCap: 200 },
    { id: 'crystal_fab_argon', productId: 'crystals', inputs: [{ wareId: 'silicon_wafers', amount: 10 }, { wareId: 'cahoonas', amount: 5 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 5, productStorageCap: 200 },
    { id: 'crystal_fab_boron', productId: 'crystals', inputs: [{ wareId: 'silicon_wafers', amount: 10 }, { wareId: 'bofu', amount: 5 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 5, productStorageCap: 200 },
    { id: 'crystal_fab_split', productId: 'crystals', inputs: [{ wareId: 'silicon_wafers', amount: 10 }, { wareId: 'rastar_oil', amount: 5 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 5, productStorageCap: 200 },
    { id: 'crystal_fab_paranid', productId: 'crystals', inputs: [{ wareId: 'silicon_wafers', amount: 10 }, { wareId: 'soya_husk', amount: 5 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 120, batchSize: 5, productStorageCap: 200 },

    // High End
    { id: 'claytronics_factory', productId: 'claytronics', inputs: [{ wareId: 'microchips', amount: 10 }, { wareId: 'antimatter_cells', amount: 10 }, { wareId: 'quantum_tubes', amount: 5 }, { wareId: 'energy_cells', amount: 100 }], cycleTimeSec: 300, batchSize: 2, productStorageCap: 100 },

    // Weapons / Shields
    { id: 'missile_factory_mosquito', productId: 'mosquito_missile', inputs: [{ wareId: 'missile_components', amount: 2 }, { wareId: 'energy_cells', amount: 10 }], cycleTimeSec: 120, batchSize: 10, productStorageCap: 200 },
    { id: 'missile_factory_wasp', productId: 'wasp_missile', inputs: [{ wareId: 'missile_components', amount: 5 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 180, batchSize: 5, productStorageCap: 100 },
    { id: 'shield_prod_1mw', productId: '1mw_shield', inputs: [{ wareId: 'shield_components', amount: 2 }, { wareId: 'energy_cells', amount: 30 }], cycleTimeSec: 200, batchSize: 5, productStorageCap: 50 },
    { id: 'shield_prod_25mw', productId: '25mw_shield', inputs: [{ wareId: 'shield_components', amount: 10 }, { wareId: 'energy_cells', amount: 100 }], cycleTimeSec: 600, batchSize: 1, productStorageCap: 20 },
    { id: 'ire_forge', productId: 'ire_laser', inputs: [{ wareId: 'weapon_components', amount: 5 }, { wareId: 'energy_cells', amount: 50 }], cycleTimeSec: 300, batchSize: 1, productStorageCap: 20 },
    { id: 'hept_forge', productId: 'hept_laser', inputs: [{ wareId: 'weapon_components', amount: 20 }, { wareId: 'advanced_electronics', amount: 2 }, { wareId: 'energy_cells', amount: 200 }], cycleTimeSec: 600, batchSize: 1, productStorageCap: 5 },

    // Logistics
    { id: 'logistics_hub', productId: 'trade_goods', inputs: [], cycleTimeSec: 120, batchSize: 5, productStorageCap: 500 },

    // SHIPYARD PRODUCTION (Dynamic)
    {
        id: 'build_vulture', productId: 'ship_vulture', inputs: [
            { wareId: 'hull_parts', amount: 50 },
            { wareId: 'engine_parts', amount: 20 },
            { wareId: 'energy_cells', amount: 200 }, // Labor/Power
            { wareId: 'shield_components', amount: 5 },
        ], cycleTimeSec: 300, batchSize: 1, productStorageCap: 10
    },
    {
        id: 'build_toucan', productId: 'ship_toucan', inputs: [
            { wareId: 'hull_parts', amount: 60 },
            { wareId: 'engine_parts', amount: 30 },
            { wareId: 'energy_cells', amount: 250 },
            { wareId: 'scanning_arrays', amount: 5 },
        ], cycleTimeSec: 400, batchSize: 1, productStorageCap: 10
    },
    {
        id: 'build_express', productId: 'ship_express', inputs: [
            { wareId: 'hull_parts', amount: 80 },
            { wareId: 'engine_parts', amount: 40 },
            { wareId: 'energy_cells', amount: 300 },
            { wareId: 'advanced_composites', amount: 10 },
        ], cycleTimeSec: 500, batchSize: 1, productStorageCap: 10
    },
    {
        id: 'build_buster', productId: 'ship_buster', inputs: [
            { wareId: 'hull_parts', amount: 40 },
            { wareId: 'weapon_components', amount: 20 },
            { wareId: 'shield_components', amount: 20 },
            { wareId: 'energy_cells', amount: 300 },
            { wareId: 'advanced_electronics', amount: 5 },
        ], cycleTimeSec: 600, batchSize: 1, productStorageCap: 5
    },
    {
        id: 'build_discoverer', productId: 'ship_discoverer', inputs: [
            { wareId: 'hull_parts', amount: 20 },
            { wareId: 'engine_parts', amount: 20 },
            { wareId: 'energy_cells', amount: 150 },
            { wareId: 'scanning_arrays', amount: 2 },
        ], cycleTimeSec: 200, batchSize: 1, productStorageCap: 10
    },

    // Planetary
    { id: 'planetary_hub_argon', productId: 'passengers', inputs: [{ wareId: 'cahoonas', amount: 20 }, { wareId: 'water', amount: 20 }, { wareId: 'energy_cells', amount: 40 }], cycleTimeSec: 300, batchSize: 50, productStorageCap: 2000 },
    { id: 'planetary_hub_teladi', productId: 'passengers', inputs: [{ wareId: 'sun_oil', amount: 20 }, { wareId: 'water', amount: 20 }, { wareId: 'energy_cells', amount: 40 }], cycleTimeSec: 300, batchSize: 50, productStorageCap: 2000 },
    { id: 'orbital_habitat_argon', productId: 'trade_goods', inputs: [{ wareId: 'passengers', amount: 10 }, { wareId: 'cahoonas', amount: 20 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 600, batchSize: 5, productStorageCap: 100 },
    { id: 'orbital_habitat_teladi', productId: 'trade_goods', inputs: [{ wareId: 'passengers', amount: 10 }, { wareId: 'sun_oil', amount: 20 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 600, batchSize: 5, productStorageCap: 100 },
    { id: 'orbital_habitat_boron', productId: 'trade_goods', inputs: [{ wareId: 'passengers', amount: 10 }, { wareId: 'bofu', amount: 20 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 600, batchSize: 5, productStorageCap: 100 },
    { id: 'orbital_habitat_paranid', productId: 'trade_goods', inputs: [{ wareId: 'passengers', amount: 10 }, { wareId: 'soya_husk', amount: 20 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 600, batchSize: 5, productStorageCap: 100 },
    { id: 'orbital_habitat_split', productId: 'trade_goods', inputs: [{ wareId: 'passengers', amount: 10 }, { wareId: 'rastar_oil', amount: 20 }, { wareId: 'energy_cells', amount: 20 }], cycleTimeSec: 600, batchSize: 5, productStorageCap: 100 },
]
