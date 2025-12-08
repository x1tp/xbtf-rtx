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
    'spp_cycle': [
        { id: 'teladi_spp', name: 'Teladi Solar Power Plant', recipeId: 'spp_cycle', cost: 846104, modelPath: '/models/00285.obj', race: 'teladi' },
        { id: 'argon_spp', name: 'Argon Solar Power Plant', recipeId: 'spp_cycle', cost: 846104, modelPath: '/models/00184.obj', race: 'argon' },
        { id: 'paranid_spp', name: 'Paranid Solar Power Plant', recipeId: 'spp_cycle', cost: 846104, modelPath: '/models/00279.obj', race: 'paranid' },
        { id: 'split_spp', name: 'Split Solar Power Plant', recipeId: 'spp_cycle', cost: 846104, modelPath: '/models/00275.obj', race: 'split' },
        { id: 'boron_spp', name: 'Boron Solar Power Plant', recipeId: 'spp_cycle', cost: 846104, modelPath: '/models/00281.obj', race: 'boron' },
    ],
    'mine_ore': [
        { id: 'ore_mine', name: 'Ore Mine', recipeId: 'mine_ore', cost: 588256, modelPath: '/models/00114.obj', race: 'teladi' } // Using Silicon model as placeholder if distinct Ore not found
    ],
    'mine_silicon': [
        { id: 'silicon_mine', name: 'Silicon Mine', recipeId: 'mine_silicon', cost: 1118256, modelPath: '/models/00114.obj', race: 'teladi' }
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
    'spaceweed_cycle': [
        // Using generic/Teladi defaults
        { id: 'dream_farm', name: 'Dream Farm', recipeId: 'spaceweed_cycle', cost: 1200000, modelPath: '/models/00282.obj', race: 'teladi' }
    ]
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
