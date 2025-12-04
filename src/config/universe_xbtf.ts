export type UniverseSector = { id: string; name: string; owner: string; neighbors: string[]; x: number; y: number }

export const UNIVERSE_SECTORS_XBTF: UniverseSector[] = [
    // Row 1
    { id: 'kingdom_end', name: "Kingdom End", owner: 'boron', neighbors: ["Rolk's Drift", "Three Worlds"], x: 0, y: 0 },
    { id: 'rolk_s_drift', name: "Rolk's Drift", owner: 'boron', neighbors: ["Kingdom End", "Queen's Space"], x: 1, y: 0 },
    { id: 'queens_space', name: "Queen's Space", owner: 'boron', neighbors: ["Rolk's Drift", "Menelaus' Frontier"], x: 2, y: 0 },
    { id: 'menelaus_frontier', name: "Menelaus' Frontier", owner: 'boron', neighbors: ["Queen's Space", "Ceo's Buckzoid", "Rolk's Fate"], x: 3, y: 0 },
    { id: 'ceo_s_buckzoid', name: "Ceo's Buckzoid", owner: 'teladi', neighbors: ["Menelaus' Frontier", "Teladi Gain", "Profit Share"], x: 4, y: 0 },
    { id: 'teladi_gain', name: "Teladi Gain", owner: 'teladi', neighbors: ["Ceo's Buckzoid", "Family Whi", "Seizewell"], x: 5, y: 0 },
    { id: 'family_whi', name: "Family Whi", owner: 'split', neighbors: ["Teladi Gain", "Family Zein"], x: 6, y: 0 },

    // Row 2
    { id: 'three_worlds', name: "Three Worlds", owner: 'argon', neighbors: ["Kingdom End", "Power Circle", "Cloudbase North West"], x: 0, y: 1 },
    { id: 'power_circle', name: "Power Circle", owner: 'argon', neighbors: ["Three Worlds", "Antigone Memorial", "Herron's Nebula"], x: 1, y: 1 },
    { id: 'antigone_memorial', name: "Antigone Memorial", owner: 'argon', neighbors: ["Power Circle", "The Hole"], x: 2, y: 1 },
    { id: 'rolk_s_fate', name: "Rolk's Fate", owner: 'boron', neighbors: ["Menelaus' Frontier", "Atreus' Clouds"], x: 3, y: 1 },
    { id: 'profit_share', name: "Profit Share", owner: 'teladi', neighbors: ["Ceo's Buckzoid", "Spaceweed Drift", "Seizewell"], x: 4, y: 1 },
    { id: 'seizewell', name: "Seizewell", owner: 'teladi', neighbors: ["Teladi Gain", "Greater Profit", "Profit Share"], x: 5, y: 1 },
    { id: 'family_zein', name: "Family Zein", owner: 'split', neighbors: ["Family Whi", "Thuruk's Pride"], x: 6, y: 1 },

    // Row 3
    { id: 'cloudbase_north_west', name: "Cloudbase North West", owner: 'argon', neighbors: ["Three Worlds", "Herron's Nebula", "Ringo Moon"], x: 0, y: 2 },
    { id: 'herron_s_nebula', name: "Herron's Nebula", owner: 'argon', neighbors: ["Power Circle", "Cloudbase North West", "The Hole", "Argon Prime"], x: 1, y: 2 },
    { id: 'the_hole', name: "The Hole", owner: 'argon', neighbors: ["Antigone Memorial", "Herron's Nebula", "The Wall", "Atreus' Clouds"], x: 2, y: 2 },
    { id: 'atreus_clouds', name: "Atreus' Clouds", owner: 'boron', neighbors: ["Rolk's Fate", "The Hole", "Xenon Sector 1"], x: 3, y: 2 },
    { id: 'spaceweed_drift', name: "Spaceweed Drift", owner: 'teladi', neighbors: ["Profit Share", "Greater Profit"], x: 4, y: 2 },
    { id: 'greater_profit', name: "Greater Profit", owner: 'teladi', neighbors: ["Seizewell", "Spaceweed Drift", "Blue Profit"], x: 5, y: 2 },
    { id: 'thuruks_pride', name: "Thuruk's Pride", owner: 'split', neighbors: ["Family Zein", "Family Pride", "Chin's Fire"], x: 6, y: 2 },
    { id: 'family_pride', name: "Family Pride", owner: 'split', neighbors: ["Thuruk's Pride"], x: 7, y: 2 },

    // Row 4
    { id: 'ringo_moon', name: "Ringo Moon", owner: 'argon', neighbors: ["Cloudbase North West", "Argon Prime", "Red Light"], x: 0, y: 3 },
    { id: 'argon_prime', name: "Argon Prime", owner: 'argon', neighbors: ["Herron's Nebula", "Ringo Moon", "The Wall", "Home of Light"], x: 1, y: 3 },
    { id: 'the_wall', name: "The Wall", owner: 'argon', neighbors: ["The Hole", "Argon Prime", "President's End"], x: 2, y: 3 },
    { id: 'xenon_sector_1', name: "Xenon Sector 1", owner: 'xenon', neighbors: ["Atreus' Clouds", "Xenon Sector 2", "Xenon Sector 3"], x: 3, y: 3 },
    { id: 'xenon_sector_2', name: "Xenon Sector 2", owner: 'xenon', neighbors: ["Xenon Sector 1", "Xenon Sector 4"], x: 4, y: 3 },
    { id: 'blue_profit', name: "Blue Profit", owner: 'teladi', neighbors: ["Greater Profit", "Ceo's Sprite"], x: 5, y: 3 },
    { id: 'chins_fire', name: "Chin's Fire", owner: 'split', neighbors: ["Thuruk's Pride", "Chin's Clouds", "Family Chin"], x: 6, y: 3 },
    { id: 'chins_clouds', name: "Chin's Clouds", owner: 'split', neighbors: ["Chin's Fire"], x: 7, y: 3 },

    // Row 5
    { id: 'red_light', name: "Red Light", owner: 'argon', neighbors: ["Ringo Moon", "Home of Light", "Cloudbase South West"], x: 0, y: 4 },
    { id: 'home_of_light', name: "Home of Light", owner: 'argon', neighbors: ["Argon Prime", "Red Light", "President's End", "Ore Belt"], x: 1, y: 4 },
    { id: 'president_s_end', name: "President's End", owner: 'argon', neighbors: ["The Wall", "Home of Light", "Cloudbase South East", "Xenon Sector 3"], x: 2, y: 4 },
    { id: 'xenon_sector_3', name: "Xenon Sector 3", owner: 'xenon', neighbors: ["Xenon Sector 1", "Xenon Sector 4", "Xenon Sector 5", "President's End"], x: 3, y: 4 },
    { id: 'xenon_sector_4', name: "Xenon Sector 4", owner: 'xenon', neighbors: ["Xenon Sector 2", "Xenon Sector 3", "Xenon Sector 6"], x: 4, y: 4 },
    { id: 'ceo_s_sprite', name: "Ceo's Sprite", owner: 'teladi', neighbors: ["Blue Profit", "Company Pride"], x: 5, y: 4 },
    { id: 'family_chin', name: "Family Chin", owner: 'split', neighbors: ["Chin's Fire", "Thuruk's Beard"], x: 6, y: 4 },

    // Row 6
    { id: 'cloudbase_south_west', name: "Cloudbase South West", owner: 'argon', neighbors: ["Red Light", "Ore Belt", "Emperor Mines"], x: 0, y: 5 },
    { id: 'ore_belt', name: "Ore Belt", owner: 'argon', neighbors: ["Home of Light", "Cloudbase South West", "Cloudbase South East"], x: 1, y: 5 },
    { id: 'cloudbase_south_east', name: "Cloudbase South East", owner: 'argon', neighbors: ["President's End", "Ore Belt"], x: 2, y: 5 },
    { id: 'xenon_sector_5', name: "Xenon Sector 5", owner: 'xenon', neighbors: ["Xenon Sector 3", "Xenon Sector 6", "Priest's Pity"], x: 3, y: 5 },
    { id: 'xenon_sector_6', name: "Xenon Sector 6", owner: 'xenon', neighbors: ["Xenon Sector 4", "Xenon Sector 5", "Xenon Sector 7"], x: 4, y: 5 },
    { id: 'company_pride', name: "Company Pride", owner: 'teladi', neighbors: ["Ceo's Sprite", "Thuruk's Beard"], x: 5, y: 5 },
    { id: 'thuruks_beard', name: "Thuruk's Beard", owner: 'split', neighbors: ["Family Chin", "Company Pride", "Xenon Sector 9"], x: 6, y: 5 },

    // Row 7
    { id: 'emperor_mines', name: "Emperor Mines", owner: 'paranid', neighbors: ["Cloudbase South West", "Paranid Prime"], x: 0, y: 6 },
    { id: 'paranid_prime', name: "Paranid Prime", owner: 'paranid', neighbors: ["Emperor Mines", "Priest Rings", "Empire's Edge"], x: 1, y: 6 },
    { id: 'priest_rings', name: "Priest Rings", owner: 'paranid', neighbors: ["Paranid Prime", "Priest's Pity", "Duke's Domain"], x: 2, y: 6 },
    { id: 'priest_pity', name: "Priest's Pity", owner: 'paranid', neighbors: ["Priest Rings", "Xenon Sector 5", "Emperor's Ridge"], x: 3, y: 6 },
    { id: 'xenon_sector_7', name: "Xenon Sector 7", owner: 'xenon', neighbors: ["Xenon Sector 6", "Xenon Sector 8"], x: 4, y: 6 },
    { id: 'xenon_sector_8', name: "Xenon Sector 8", owner: 'xenon', neighbors: ["Xenon Sector 7", "Xenon Sector 9"], x: 5, y: 6 },
    { id: 'xenon_sector_9', name: "Xenon Sector 9", owner: 'xenon', neighbors: ["Xenon Sector 8", "Thuruk's Beard"], x: 6, y: 6 },

    // Row 8
    { id: 'empires_edge', name: "Empire's Edge", owner: 'paranid', neighbors: ["Paranid Prime", "Duke's Domain"], x: 1, y: 7 },
    { id: 'dukes_domain', name: "Duke's Domain", owner: 'paranid', neighbors: ["Priest Rings", "Empire's Edge", "Emperor's Ridge"], x: 2, y: 7 },
    { id: 'emperors_ridge', name: "Emperor's Ridge", owner: 'paranid', neighbors: ["Priest's Pity", "Duke's Domain"], x: 3, y: 7 },
]
