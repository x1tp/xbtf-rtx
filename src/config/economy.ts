import { type RaceType } from '../types/simulation'

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
