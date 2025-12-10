export interface ShipStats {
  name: string;
  class: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'TS' | 'TL' | 'TP' | 'GO' | 'UNKNOWN';
  maxSpeed: number; // m/s (fully upgraded)
  acceleration: number; // m/s^2
  turnRate: number; // 0-10 scale (approx 1.0 = 100%)
  shield: {
    max: number; // MW
    count: number;
  };
  hull: number; // Estimated based on class if not available
  cargo: {
    min: number;
    max: number;
    class?: 'S' | 'M' | 'L' | 'XL';
  };
  price: {
    s?: number;
    m?: number;
    l?: number;
    base?: number;
  };
  weapons: {
    lasers: string;
    missiles: string;
  };
  desc?: string;
}

// Map model paths to ship names (from user-data.json)
export const MODEL_MAP: Record<string, string> = {
    "/models/00000.obj": "Argon Elite",
    "/models/00002.obj": "Argon Lifter",
    "/models/00003.obj": "Argon Discoverer",
    "/models/00004.obj": "Boron Octopus",
    "/models/00005.obj": "Xenon M",
    "/models/00007.obj": "Teladi Vulture",
    "/models/00009.obj": "Boron Piranha",
    "/models/00016.obj": "Xenon L",
    "/models/00017.obj": "Teladi Falcon",
    "/models/00018.obj": "Paranid Pegasus",
    "/models/00019.obj": "Argon Buster",
    "/models/00020.obj": "Boron Eel",
    "/models/00021.obj": "Xenon M0 Mother Ship",
    "/models/00038.obj": "Xenon Transporter",
    "/models/00052.obj": "Split Wolf",
    "/models/00055.obj": "Earth Ship",
    "/models/00101.obj": "Argon Destroyer",
    "/models/00102.obj": "Argon Mammoth",
    "/models/00103.obj": "Argon One",
    "/models/00104.obj": "Teladi Condor",
    "/models/00110.obj": "Split Elephant",
    "/models/00115.obj": "Paranid M5",
    "/models/00117.obj": "Split Mule",
    "/models/00118.obj": "Xenon Destroyer",
    "/models/00119.obj": "Xenon Carrier",
    "/models/00121.obj": "Split Raptor",
    "/models/00123.obj": "Boron Shark",
    "/models/00124.obj": "Xperimental Shuttle",
    "/models/00125.obj": "Paranid Odysseus",
    "/models/00126.obj": "Split Mamba",
    "/models/00128.obj": "Teladi Bat",
    "/models/00129.obj": "Paranid Hercules",
    "/models/00130.obj": "Paranid Prometheus",
    "/models/00133.obj": "Split Python",
    "/models/00134.obj": "Boron Ray",
    "/models/00135.obj": "Boron Orca",
    "/models/00137.obj": "Split Scorpion",
    "/models/00138.obj": "Teladi Hawk",
    "/models/00139.obj": "Unknown Ship",
    "/models/00140.obj": "Teladi Phoenix",
    "/models/00141.obj": "Boron Dolphin",
    "/models/00142.obj": "Boron Piranha",
    "/models/00187.obj": "Teladi Albatross",
    "/models/00188.obj": "Teladi Vulture",
    "/models/00189.obj": "Xenon Freighter",
    "/models/00192.obj": "Paranid Zeus",
    "/models/00262.obj": "Earth Carrier",
    "/models/00391.obj": "Pirate Lifter",
    "/models/00392.obj": "Pirate Dolphin",
    "/models/00393.obj": "Paranid Ganymede",
    "/models/00394.obj": "Pirate Mule",
    "/models/00395.obj": "Pirate Vulture",
    "/models/00396.obj": "Pirate Xenon Freighter"
};

export const SHIP_STATS: Record<string, ShipStats> = {
  // --- M5 (Scout) ---
  'argon_discoverer': {
    name: 'Argon Discoverer',
    class: 'M5',
    maxSpeed: 490,
    acceleration: 11,
    turnRate: 1.50, // 150%
    shield: { max: 1, count: 2 }, // 2x1MW
    hull: 1000,
    cargo: { min: 10, max: 50 },
    price: { s: 36885, m: 47321, l: 55409 },
    weapons: { lasers: '2 x G.I.R.E.', missiles: 'Dragonfly' }
  },
  'boron_octopus': {
    name: 'Boron Octopus',
    class: 'M5',
    maxSpeed: 541,
    acceleration: 184,
    turnRate: 6.82, // 682%
    shield: { max: 1, count: 1 },
    hull: 800,
    cargo: { min: 5, max: 5 },
    price: { s: 56146, m: 60178, l: 64222 },
    weapons: { lasers: '3 x B.I.R.E.', missiles: 'Dragonfly' }
  },
  'paranid_pegasus': {
    name: 'Paranid Pegasus',
    class: 'M5',
    maxSpeed: 1261,
    acceleration: 226,
    turnRate: 8.02,
    shield: { max: 1, count: 1 },
    hull: 600,
    cargo: { min: 2, max: 5 },
    price: { s: 59955, m: 62647, l: 66691 },
    weapons: { lasers: '1 x G.I.R.E.', missiles: 'Dragonfly' }
  },
  'pirate_mandalay': {
    name: 'Pirate Mandalay',
    class: 'M5',
    maxSpeed: 260,
    acceleration: 27,
    turnRate: 0.51,
    shield: { max: 1, count: 2 },
    hull: 900,
    cargo: { min: 20, max: 90 },
    price: { base: 33000 },
    weapons: { lasers: '2 x G.I.R.E.', missiles: 'Dragonfly' }
  },
  'split_wolf': {
    name: 'Split Wolf',
    class: 'M5',
    maxSpeed: 440,
    acceleration: 24,
    turnRate: 1.40,
    shield: { max: 1, count: 2 },
    hull: 900,
    cargo: { min: 10, max: 50 },
    price: { s: 32960, m: 43396, l: 51484 },
    weapons: { lasers: '2 x G.I.R.E.', missiles: 'Dragonfly' }
  },
  'teladi_bat': {
    name: 'Teladi Bat',
    class: 'M5',
    maxSpeed: 340,
    acceleration: 18,
    turnRate: 1.01,
    shield: { max: 1, count: 2 },
    hull: 1100,
    cargo: { min: 10, max: 50 },
    price: { s: 63733, m: 74169, l: 82257 },
    weapons: { lasers: '2 x G.I.R.E.', missiles: 'Dragonfly' }
  },
  'xenon_n': {
    name: 'Xenon N',
    class: 'M5',
    maxSpeed: 371,
    acceleration: 16,
    turnRate: 3.02,
    shield: { max: 1, count: 2 },
    hull: 900,
    cargo: { min: 10, max: 50 },
    price: { base: 23800 },
    weapons: { lasers: '2 x G.I.R.E.', missiles: 'Dragonfly' }
  },
  'paranid_m5': { // Fallback from user-data
    name: 'Paranid M5',
    class: 'M5',
    maxSpeed: 1000, // Est
    acceleration: 200,
    turnRate: 7.0,
    shield: { max: 1, count: 1 },
    hull: 600,
    cargo: { min: 2, max: 5 },
    price: { base: 60000 },
    weapons: { lasers: '1 x G.I.R.E.', missiles: 'Dragonfly' }
  },

  // --- M4 (Interceptor) ---
  'argon_buster': {
    name: 'Argon Buster',
    class: 'M4',
    maxSpeed: 143,
    acceleration: 7,
    turnRate: 0.60,
    shield: { max: 5, count: 2 },
    hull: 2000,
    cargo: { min: 15, max: 100 },
    price: { s: 278945, m: 348005, l: 529933 },
    weapons: { lasers: '2 x G.P.A.C.', missiles: 'Silkworm' }
  },
  'boron_piranha': {
    name: 'Boron Piranha',
    class: 'M4',
    maxSpeed: 192,
    acceleration: 7,
    turnRate: 2.00,
    shield: { max: 5, count: 2 },
    hull: 1800,
    cargo: { min: 15, max: 80 },
    price: { s: 218755, m: 287815, l: 469743 },
    weapons: { lasers: '2 x G.P.A.C.', missiles: 'Silkworm' }
  },
  'paranid_poseidon': {
    name: 'Paranid Poseidon',
    class: 'M4',
    maxSpeed: 126,
    acceleration: 7,
    turnRate: 2.00,
    shield: { max: 5, count: 2 },
    hull: 1900,
    cargo: { min: 15, max: 100 },
    price: { s: 244710, m: 313770, l: 495698 },
    weapons: { lasers: '2 x G.P.A.C.', missiles: 'Silkworm' }
  },
  'pirate_bayamon': {
    name: 'Pirate Bayamon',
    class: 'M4',
    maxSpeed: 206,
    acceleration: 8,
    turnRate: 0.40,
    shield: { max: 5, count: 1 },
    hull: 1800,
    cargo: { min: 30, max: 150 },
    price: { base: 128000 },
    weapons: { lasers: '4 x A.P.A.C.', missiles: 'Wasp' }
  },
  'split_scorpion': {
    name: 'Split Scorpion',
    class: 'M4',
    maxSpeed: 75, // Note: Doc says 75, seems low for Split, but following source
    acceleration: 7,
    turnRate: 2.40,
    shield: { max: 5, count: 2 },
    hull: 1600,
    cargo: { min: 15, max: 100 },
    price: { s: 187806, m: 256866, l: 438794 },
    weapons: { lasers: '2 x G.P.A.C.', missiles: 'Silkworm' }
  },
  'teladi_hawk': {
    name: 'Teladi Hawk',
    class: 'M4',
    maxSpeed: 145,
    acceleration: 7,
    turnRate: 0.80,
    shield: { max: 5, count: 2 },
    hull: 2200,
    cargo: { min: 15, max: 120 },
    price: { s: 313185, m: 382245, l: 564173 },
    weapons: { lasers: '2 x G.P.A.C.', missiles: 'Silkworm' }
  },
  'xenon_m': {
    name: 'Xenon M',
    class: 'M4',
    maxSpeed: 142,
    acceleration: 7,
    turnRate: 2.10,
    shield: { max: 5, count: 2 },
    hull: 1900,
    cargo: { min: 15, max: 100 },
    price: { base: 128000 },
    weapons: { lasers: '2 x G.P.A.C.', missiles: 'Silkworm' }
  },

  // --- M3 (Fighter) ---
  'argon_elite': {
    name: 'Argon Elite',
    class: 'M3',
    maxSpeed: 125,
    acceleration: 7,
    turnRate: 0.50,
    shield: { max: 25, count: 2 },
    hull: 5000,
    cargo: { min: 20, max: 200 },
    price: { s: 816600, m: 959780, l: 2199580 },
    weapons: { lasers: '2 x A.H.E.P.T.', missiles: 'Hornet' }
  },
  'xperimental_shuttle': {
    name: 'Xperimental Shuttle',
    class: 'M3',
    maxSpeed: 306,
    acceleration: 9,
    turnRate: 0.60,
    shield: { max: 25, count: 2 },
    hull: 6000,
    cargo: { min: 30, max: 100 },
    price: { base: 0 }, // Not for sale
    weapons: { lasers: '2 x B.H.E.P.T.', missiles: 'Hornet' }
  },
  'boron_eel': {
    name: 'Boron Eel',
    class: 'M3',
    maxSpeed: 123,
    acceleration: 7,
    turnRate: 0.82,
    shield: { max: 25, count: 2 },
    hull: 4500,
    cargo: { min: 20, max: 200 },
    price: { s: 816600, m: 959780, l: 2199580 },
    weapons: { lasers: '2 x A.H.E.P.T.', missiles: 'Hornet' }
  },
  'paranid_prometheus': {
    name: 'Paranid Prometheus',
    class: 'M3',
    maxSpeed: 176,
    acceleration: 7,
    turnRate: 0.82,
    shield: { max: 25, count: 2 },
    hull: 4800,
    cargo: { min: 20, max: 30 },
    price: { s: 946448, m: 1089628, l: 2329428 },
    weapons: { lasers: '2 x A.H.E.P.T.', missiles: 'Hornet' }
  },
  'paranid_perseus': {
    name: 'Paranid Perseus',
    class: 'M3',
    maxSpeed: 245,
    acceleration: 7,
    turnRate: 0.82,
    shield: { max: 25, count: 3 },
    hull: 5000,
    cargo: { min: 20, max: 25 },
    price: { base: 0 }, // Mission ship?
    weapons: { lasers: '3 x A.H.E.P.T.', missiles: 'Silkworm' }
  },
  'pirate_orinoco': {
    name: 'Pirate Orinoco',
    class: 'M3',
    maxSpeed: 93,
    acceleration: 7,
    turnRate: 0.46,
    shield: { max: 5, count: 2 }, // Note: Orinoco usually has 2x5MW in XT
    hull: 4000,
    cargo: { min: 60, max: 350 },
    price: { base: 486883 },
    weapons: { lasers: '2 x G.P.A.C.', missiles: 'Dragonfly' }
  },
  'split_mamba': {
    name: 'Split Mamba',
    class: 'M3',
    maxSpeed: 286,
    acceleration: 11,
    turnRate: 1.00,
    shield: { max: 25, count: 1 },
    hull: 4000,
    cargo: { min: 20, max: 200 },
    price: { s: 1206140, m: 1288680, l: 2029864 },
    weapons: { lasers: '2 x A.H.E.P.T.', missiles: 'Silkworm' }
  },
  'teladi_falcon': {
    name: 'Teladi Falcon',
    class: 'M3',
    maxSpeed: 129,
    acceleration: 7,
    turnRate: 0.92,
    shield: { max: 25, count: 2 },
    hull: 6000,
    cargo: { min: 20, max: 250 },
    price: { s: 1076296, m: 1219476, l: 2459276 },
    weapons: { lasers: '2 x A.H.E.P.T.', missiles: 'Hornet' }
  },
  'xenon_l': {
    name: 'Xenon L',
    class: 'M3',
    maxSpeed: 94,
    acceleration: 7,
    turnRate: 1.82,
    shield: { max: 25, count: 2 },
    hull: 5000,
    cargo: { min: 20, max: 200 },
    price: { base: 486883 },
    weapons: { lasers: '2 x A.H.E.P.T.', missiles: 'Hornet' }
  },

  // --- TS (Transport Small) ---
  'argon_lifter': {
    name: 'Argon Lifter',
    class: 'TS',
    maxSpeed: 143,
    acceleration: 3,
    turnRate: 0.14,
    shield: { max: 25, count: 2 },
    hull: 8000,
    cargo: { min: 500, max: 1500 },
    price: { s: 103939, m: 220167, l: 1217399 },
    weapons: { lasers: 'none', missiles: 'none' }
  },
  'boron_dolphin': {
    name: 'Boron Dolphin',
    class: 'TS',
    maxSpeed: 70,
    acceleration: 3,
    turnRate: 0.03,
    shield: { max: 25, count: 2 },
    hull: 7000,
    cargo: { min: 800, max: 3000 },
    price: { s: 165877, m: 282105, l: 1279337 },
    weapons: { lasers: 'none', missiles: 'none' }
  },
  'paranid_ganymede': {
    name: 'Paranid Ganymede',
    class: 'TS',
    maxSpeed: 97,
    acceleration: 3,
    turnRate: 0.14,
    shield: { max: 25, count: 2 },
    hull: 7500,
    cargo: { min: 600, max: 1400 },
    price: { s: 103939, m: 220167, l: 1217399 },
    weapons: { lasers: 'none', missiles: 'none' }
  },
  'split_mule': {
    name: 'Split Mule',
    class: 'TS',
    maxSpeed: 97,
    acceleration: 3,
    turnRate: 0.08,
    shield: { max: 25, count: 2 },
    hull: 6500,
    cargo: { min: 800, max: 1200 },
    price: { s: 97006, m: 213234, l: 1210466 },
    weapons: { lasers: 'none', missiles: 'none' }
  },
  'teladi_vulture': {
    name: 'Teladi Vulture',
    class: 'TS',
    maxSpeed: 84,
    acceleration: 3,
    turnRate: 0.03,
    shield: { max: 25, count: 2 },
    hull: 9000,
    cargo: { min: 400, max: 1600 },
    price: { s: 118074, m: 234302, l: 1231534 },
    weapons: { lasers: 'none', missiles: 'none' }
  },
  'pirate_freighter': {
    name: 'Pirate Freighter',
    class: 'TS',
    maxSpeed: 58,
    acceleration: 3,
    turnRate: 0.12,
    shield: { max: 5, count: 1 },
    hull: 6000,
    cargo: { min: 150, max: 150 },
    price: { s: 313185, m: 395725, l: 902201 },
    weapons: { lasers: '1 x G.H.E.P.T.', missiles: 'Silkworm' }
  },
  'pirate_lifter': {
    name: 'Pirate Lifter',
    class: 'TS',
    maxSpeed: 56,
    acceleration: 3,
    turnRate: 0.05,
    shield: { max: 25, count: 1 },
    hull: 6000,
    cargo: { min: 150, max: 150 },
    price: { base: 97384 },
    weapons: { lasers: '1 x A.H.E.P.T.', missiles: 'Hornet' }
  },
  'pirate_dolphin': {
    name: 'Pirate Dolphin',
    class: 'TS',
    maxSpeed: 55,
    acceleration: 3,
    turnRate: 0.05,
    shield: { max: 25, count: 1 },
    hull: 6000,
    cargo: { min: 200, max: 200 },
    price: { base: 97384 },
    weapons: { lasers: '1 x B.P.A.C.', missiles: 'Hornet' }
  },
  'pirate_ganymede': {
    name: 'Pirate Ganymede',
    class: 'TS',
    maxSpeed: 57,
    acceleration: 3,
    turnRate: 0.10,
    shield: { max: 25, count: 1 },
    hull: 6000,
    cargo: { min: 350, max: 350 },
    price: { base: 97384 },
    weapons: { lasers: '1 x B.P.A.C.', missiles: 'Hornet' }
  },
  'pirate_mule': {
    name: 'Pirate Mule',
    class: 'TS',
    maxSpeed: 57,
    acceleration: 3,
    turnRate: 0.10,
    shield: { max: 25, count: 1 },
    hull: 6000,
    cargo: { min: 300, max: 300 },
    price: { base: 97384 },
    weapons: { lasers: '1 x B.P.A.C.', missiles: 'Hornet' }
  },
  'pirate_vulture': {
    name: 'Pirate Vulture',
    class: 'TS',
    maxSpeed: 55,
    acceleration: 3,
    turnRate: 0.09,
    shield: { max: 25, count: 1 },
    hull: 6000,
    cargo: { min: 200, max: 200 },
    price: { base: 97384 },
    weapons: { lasers: '1 x A.P.A.C.', missiles: 'Hornet' }
  },
  'pirate_xenon_freighter': {
    name: 'Pirate Xenon Freighter',
    class: 'TS',
    maxSpeed: 58, // Same as regular Pirate Freighter
    acceleration: 3,
    turnRate: 0.12,
    shield: { max: 5, count: 1 },
    hull: 6000,
    cargo: { min: 150, max: 150 },
    price: { base: 100000 },
    weapons: { lasers: '1 x G.H.E.P.T.', missiles: 'Silkworm' }
  },
  'xenon_transporter': {
      name: 'Xenon Transporter',
      class: 'TS',
      maxSpeed: 150,
      acceleration: 5,
      turnRate: 0.20,
      shield: { max: 25, count: 2 },
      hull: 5000,
      cargo: { min: 100, max: 500 },
      price: { base: 0 },
      weapons: { lasers: 'none', missiles: 'none' }
  },
  'xenon_freighter': {
    name: 'Xenon Freighter',
    class: 'TS',
    maxSpeed: 150,
    acceleration: 5,
    turnRate: 0.20,
    shield: { max: 25, count: 2 },
    hull: 5000,
    cargo: { min: 100, max: 500 },
    price: { base: 0 },
    weapons: { lasers: 'none', missiles: 'none' }
  },

  // --- TL (Transport Large) ---
  'argon_mammoth': {
    name: 'Argon Mammoth',
    class: 'TL',
    maxSpeed: 243,
    acceleration: 6,
    turnRate: 0.02, // 1.9%
    shield: { max: 125, count: 5 },
    hull: 50000,
    cargo: { min: 19500, max: 19500 },
    price: { base: 45446720 },
    weapons: { lasers: 'none', missiles: 'Hornet' }
  },
  'boron_orca': {
    name: 'Boron Orca',
    class: 'TL',
    maxSpeed: 252,
    acceleration: 6,
    turnRate: 0.016,
    shield: { max: 125, count: 5 },
    hull: 45000,
    cargo: { min: 15000, max: 15000 },
    price: { base: 25969552 },
    weapons: { lasers: 'none', missiles: 'Hornet' }
  },
  'paranid_hercules': {
    name: 'Paranid Hercules',
    class: 'TL',
    maxSpeed: 227,
    acceleration: 6,
    turnRate: 0.016,
    shield: { max: 125, count: 5 },
    hull: 48000,
    cargo: { min: 11000, max: 11000 },
    price: { base: 16230972 },
    weapons: { lasers: 'none', missiles: 'Hornet' }
  },
  'split_elephant': {
    name: 'Split Elephant',
    class: 'TL',
    maxSpeed: 229,
    acceleration: 7,
    turnRate: 0.013,
    shield: { max: 125, count: 5 },
    hull: 40000,
    cargo: { min: 11000, max: 11000 },
    price: { base: 19477164 },
    weapons: { lasers: 'none', missiles: 'Hornet' }
  },
  'teladi_albatross': {
    name: 'Teladi Albatross',
    class: 'TL',
    maxSpeed: 234,
    acceleration: 7,
    turnRate: 0.019,
    shield: { max: 125, count: 5 },
    hull: 60000,
    cargo: { min: 13000, max: 13000 },
    price: { base: 32461944 },
    weapons: { lasers: 'none', missiles: 'Hornet' }
  },

  // --- GO (Goner) ---
  'goner_ship': {
    name: 'Goner Ship',
    class: 'GO',
    maxSpeed: 216,
    acceleration: 3,
    turnRate: 0.30,
    shield: { max: 25, count: 2 },
    hull: 1500,
    cargo: { min: 150, max: 400 },
    price: { base: 97384 },
    weapons: { lasers: 'none', missiles: 'Dragonfly' }
  },

  // --- M2 (Destroyer) - Estimated Stats ---
  'argon_destroyer': {
    name: 'Argon Titan',
    class: 'M2',
    maxSpeed: 150,
    acceleration: 3,
    turnRate: 0.05,
    shield: { max: 125, count: 4 },
    hull: 80000,
    cargo: { min: 2000, max: 2000 },
    price: { base: 80000000 },
    weapons: { lasers: '18 x G.H.E.P.T.', missiles: 'Hornet' }
  },
  'xenon_destroyer': {
    name: 'Xenon K',
    class: 'M2',
    maxSpeed: 300,
    acceleration: 5,
    turnRate: 0.06,
    shield: { max: 125, count: 5 },
    hull: 90000,
    cargo: { min: 2000, max: 2000 },
    price: { base: 0 },
    weapons: { lasers: '18 x G.P.P.C.', missiles: 'Hornet' }
  },
  'paranid_odysseus': {
    name: 'Paranid Odysseus',
    class: 'M2',
    maxSpeed: 170,
    acceleration: 4,
    turnRate: 0.06,
    shield: { max: 125, count: 5 },
    hull: 85000,
    cargo: { min: 2000, max: 2000 },
    price: { base: 90000000 },
    weapons: { lasers: '18 x G.P.S.G.', missiles: 'Hornet' }
  },
  'split_python': {
    name: 'Split Python',
    class: 'M2',
    maxSpeed: 290,
    acceleration: 5,
    turnRate: 0.04,
    shield: { max: 125, count: 3 },
    hull: 70000,
    cargo: { min: 2000, max: 2000 },
    price: { base: 75000000 },
    weapons: { lasers: '18 x G.H.E.P.T.', missiles: 'Hornet' }
  },
  'boron_ray': {
    name: 'Boron Ray',
    class: 'M2',
    maxSpeed: 210,
    acceleration: 4,
    turnRate: 0.06,
    shield: { max: 125, count: 4 },
    hull: 75000,
    cargo: { min: 2000, max: 2000 },
    price: { base: 70000000 },
    weapons: { lasers: '18 x I.D.', missiles: 'Hornet' }
  },
  'teladi_phoenix': {
    name: 'Teladi Phoenix',
    class: 'M2',
    maxSpeed: 120,
    acceleration: 2,
    turnRate: 0.03,
    shield: { max: 125, count: 6 },
    hull: 100000,
    cargo: { min: 3000, max: 3000 },
    price: { base: 95000000 },
    weapons: { lasers: '18 x G.H.E.P.T.', missiles: 'Hornet' }
  },

  // --- M1 (Carrier) - Estimated Stats ---
  'argon_one': {
      name: 'Argon One',
      class: 'M1',
      maxSpeed: 100,
      acceleration: 2,
      turnRate: 0.02,
      shield: { max: 125, count: 6 },
      hull: 200000,
      cargo: { min: 5000, max: 5000 },
      price: { base: 0 },
      weapons: { lasers: '12 x G.H.E.P.T.', missiles: 'Hornet' }
  },
  'xenon_carrier': {
      name: 'Xenon J',
      class: 'M1',
      maxSpeed: 150,
      acceleration: 3,
      turnRate: 0.03,
      shield: { max: 125, count: 4 },
      hull: 120000,
      cargo: { min: 5000, max: 5000 },
      price: { base: 0 },
      weapons: { lasers: '12 x G.P.P.C.', missiles: 'Hornet' }
  },
  'split_raptor': {
      name: 'Split Raptor',
      class: 'M1',
      maxSpeed: 240,
      acceleration: 4,
      turnRate: 0.03,
      shield: { max: 125, count: 3 },
      hull: 90000,
      cargo: { min: 5000, max: 5000 },
      price: { base: 80000000 },
      weapons: { lasers: '12 x G.H.E.P.T.', missiles: 'Hornet' }
  },
  'boron_shark': {
      name: 'Boron Shark',
      class: 'M1',
      maxSpeed: 190,
      acceleration: 3,
      turnRate: 0.04,
      shield: { max: 125, count: 4 },
      hull: 100000,
      cargo: { min: 5000, max: 5000 },
      price: { base: 75000000 },
      weapons: { lasers: '12 x I.D.', missiles: 'Hornet' }
  },
  'teladi_condor': {
      name: 'Teladi Condor',
      class: 'M1',
      maxSpeed: 110,
      acceleration: 2,
      turnRate: 0.02,
      shield: { max: 125, count: 5 },
      hull: 140000,
      cargo: { min: 6000, max: 6000 },
      price: { base: 85000000 },
      weapons: { lasers: '12 x G.H.E.P.T.', missiles: 'Hornet' }
  },
  'paranid_zeus': {
      name: 'Paranid Zeus',
      class: 'M1',
      maxSpeed: 160,
      acceleration: 3,
      turnRate: 0.04,
      shield: { max: 125, count: 4 },
      hull: 110000,
      cargo: { min: 5000, max: 5000 },
      price: { base: 80000000 },
      weapons: { lasers: '12 x G.P.S.G.', missiles: 'Hornet' }
  },
  'earth_carrier': {
      name: 'Earth Carrier',
      class: 'M1',
      maxSpeed: 150,
      acceleration: 3,
      turnRate: 0.03,
      shield: { max: 125, count: 5 },
      hull: 150000,
      cargo: { min: 5000, max: 5000 },
      price: { base: 0 },
      weapons: { lasers: 'Unknown', missiles: 'Unknown' }
  },
  'earth_ship': {
      name: 'Earth Ship',
      class: 'M3', // Assumption
      maxSpeed: 200,
      acceleration: 10,
      turnRate: 1.0,
      shield: { max: 25, count: 2 },
      hull: 5000,
      cargo: { min: 50, max: 50 },
      price: { base: 0 },
      weapons: { lasers: 'Unknown', missiles: 'Unknown' }
  },
  'xenon_m0_mother_ship': {
      name: 'Xenon M0 Mother Ship',
      class: 'M1', // Super carrier
      maxSpeed: 50,
      acceleration: 1,
      turnRate: 0.01,
      shield: { max: 125, count: 10 },
      hull: 500000,
      cargo: { min: 10000, max: 10000 },
      price: { base: 0 },
      weapons: { lasers: 'Unknown', missiles: 'Unknown' }
  },
  'unknown_ship': {
      name: 'Unknown Ship',
      class: 'UNKNOWN',
      maxSpeed: 100,
      acceleration: 5,
      turnRate: 1.0,
      shield: { max: 25, count: 1 },
      hull: 1000,
      cargo: { min: 0, max: 0 },
      price: { base: 0 },
      weapons: { lasers: 'None', missiles: 'None' }
  },

  // --- Default Fallback ---
  'default': {
    name: 'Unknown Ship',
    class: 'M5',
    maxSpeed: 100,
    acceleration: 10,
    turnRate: 1.0,
    shield: { max: 1, count: 1 },
    hull: 1000,
    cargo: { min: 0, max: 0 },
    price: { base: 0 },
    weapons: { lasers: 'None', missiles: 'None' }
  },
  // Legacy generic entries (kept for backward compatibility)
  'player': {
    name: 'Xperimental Shuttle',
    class: 'M3',
    maxSpeed: 306,
    acceleration: 9,
    turnRate: 0.60,
    shield: { max: 25, count: 2 },
    hull: 6000,
    cargo: { min: 30, max: 100 },
    price: { base: 0 },
    weapons: { lasers: '2 x B.H.E.P.T.', missiles: 'Hornet' }
  },
  'destroyer': {
    name: 'Destroyer',
    class: 'M2',
    maxSpeed: 150,
    acceleration: 5,
    turnRate: 0.05,
    shield: { max: 125, count: 3 },
    hull: 50000,
    cargo: { min: 1000, max: 5000 },
    price: { base: 80000000 },
    weapons: { lasers: 'GHEPT', missiles: 'Hornet' }
  },
  'fighter': {
    name: 'Fighter',
    class: 'M3',
    maxSpeed: 250,
    acceleration: 20,
    turnRate: 0.8,
    shield: { max: 25, count: 1 },
    hull: 5000,
    cargo: { min: 50, max: 200 },
    price: { base: 1000000 },
    weapons: { lasers: 'HEPT', missiles: 'Silkworm' }
  }
};

export const getShipStats = (modelPathOrName: string): ShipStats => {
  const input = modelPathOrName.trim();
  
  // 1. Check direct mapping from MODEL_MAP
  // Normalize path separators to /
  const normalizedPath = input.replace(/\\/g, '/');
  
  // Try to find exact path match in MODEL_MAP
  let mappedName = MODEL_MAP[normalizedPath];
  
  // If not found, try to find by checking if the input *ends with* a known model file
  if (!mappedName) {
      for (const [path, name] of Object.entries(MODEL_MAP)) {
          if (normalizedPath.endsWith(path)) {
              mappedName = name;
              break;
          }
      }
  }

  // Use the mapped name if found, otherwise use the input as the key
  const keyName = mappedName || input;
  
  // 2. Normalize key for lookup (lower case, replace spaces with underscores)
  const lookupKey = keyName.toLowerCase().replace(/ /g, '_').replace(/['"-]/g, '');
  
  // 3. Lookup in SHIP_STATS
  if (SHIP_STATS[lookupKey]) {
      return SHIP_STATS[lookupKey];
  }
  
  // 4. Fuzzy lookup
  const statsKeys = Object.keys(SHIP_STATS);
  for (const key of statsKeys) {
      // Check if the lookup key contains the stats key (e.g. "argon_discoverer_raider" matches "argon_discoverer")
      // or vice versa
      if (key.includes(lookupKey) || lookupKey.includes(key)) {
          return SHIP_STATS[key];
      }
  }
  
  // 5. Special handling for generic terms
  if (lookupKey.includes('m1') || lookupKey.includes('carrier')) return SHIP_STATS['argon_one'];
  if (lookupKey.includes('m2') || lookupKey.includes('destroyer')) return SHIP_STATS['argon_destroyer'];
  if (lookupKey.includes('m3') || lookupKey.includes('fighter')) return SHIP_STATS['argon_elite'];
  if (lookupKey.includes('m4') || lookupKey.includes('interceptor')) return SHIP_STATS['argon_buster'];
  if (lookupKey.includes('m5') || lookupKey.includes('scout')) return SHIP_STATS['argon_discoverer'];
  if (lookupKey.includes('ts') || lookupKey.includes('transport')) return SHIP_STATS['argon_lifter'];
  if (lookupKey.includes('tl') || lookupKey.includes('mammoth')) return SHIP_STATS['argon_mammoth'];

  console.warn(`Ship stats not found for: ${modelPathOrName} (mapped to: ${keyName}, lookup: ${lookupKey})`);
  return SHIP_STATS['default'];
};
