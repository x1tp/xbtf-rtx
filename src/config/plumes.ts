export interface PlumeConfig {
    length: number;
    radius: number;
    color: string;
    density: number;
    glow: number;
    noiseScale: number;
    shock: number;
}

export const PLUME_PRESETS: Record<string, PlumeConfig> = {
    'standard': {
        length: 3.8,
        radius: 0.58,
        color: '#9bd0ff',
        density: 1.05,
        glow: 5.0,
        noiseScale: 2.4,
        shock: 1.2
    },
    'ion_red': {
        length: 4.5,
        radius: 0.45,
        color: '#ff4444',
        density: 0.8,
        glow: 4.0,
        noiseScale: 3.0,
        shock: 1.5
    },
    'plasma_green': {
        length: 3.2,
        radius: 0.7,
        color: '#44ff66',
        density: 1.2,
        glow: 6.0,
        noiseScale: 1.8,
        shock: 0.8
    },
    'afterburner_orange': {
        length: 6.0,
        radius: 0.6,
        color: '#ffaa22',
        density: 0.9,
        glow: 4.5,
        noiseScale: 2.0,
        shock: 2.0
    },
    'xenon_purple': {
        length: 4.0,
        radius: 0.5,
        color: '#aa44ff',
        density: 0.7,
        glow: 5.5,
        noiseScale: 2.8,
        shock: 1.1
    }
};
