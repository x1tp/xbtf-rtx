export interface PlumeConfig {
    length: number;
    radius: number;
    color: string;
    density: number;
    glow: number;
    noiseScale: number;
    shock: number;
    shockFrequency?: number;
    animationSpeed?: number;
    smoothness?: number;
    // New particle parameters for NebulaPlume
    particleCount?: number;
    emissionRate?: number;
    particleLife?: number;
    startScale?: number;
    endScale?: number;
    startAlpha?: number;
    velocity?: number;
    spread?: number;
    textureSoftness?: number;
}

// Load custom presets from localStorage and merge with built-in presets
function loadCustomPresets(): Record<string, PlumeConfig> {
    if (typeof window === 'undefined') return {};
    try {
        const stored = localStorage.getItem('custom_plume_presets');
        if (!stored) return {};
        const parsed = JSON.parse(stored);
        
        // Validate each preset has required fields
        const validated: Record<string, PlumeConfig> = {};
        for (const [name, preset] of Object.entries(parsed)) {
            const p = preset as Partial<PlumeConfig>;
            // Only include if it has at least color and length (basic validation)
            if (p && typeof p.color === 'string' && typeof p.length === 'number') {
                validated[name] = {
                    length: p.length ?? 2.5,
                    radius: p.radius ?? 0.5,
                    color: p.color ?? '#76baff',
                    density: p.density ?? 1.0,
                    glow: p.glow ?? 2.0,
                    noiseScale: p.noiseScale ?? 2.0,
                    shock: p.shock ?? 1.0,
                    shockFrequency: p.shockFrequency ?? 20.0,
                    animationSpeed: p.animationSpeed ?? 10.0,
                    smoothness: p.smoothness ?? 0.5,
                    particleCount: p.particleCount ?? 10,
                    emissionRate: p.emissionRate ?? 0.075,
                    particleLife: p.particleLife ?? 0.75,
                    startScale: p.startScale ?? 2.0,
                    endScale: p.endScale ?? 0.3,
                    startAlpha: p.startAlpha ?? 0.8,
                    velocity: p.velocity ?? 15,
                    spread: p.spread ?? 12,
                    textureSoftness: p.textureSoftness ?? 0.5,
                };
            }
        }
        return validated;
    } catch {
        // If parsing fails, clear the corrupted data
        localStorage.removeItem('custom_plume_presets');
        return {};
    }
}

export const PLUME_PRESETS: Record<string, PlumeConfig> = {
    'standard': {
        length: 3.8, radius: 0.58, color: '#4a9eff', density: 1.05, glow: 3.0, noiseScale: 2.4, shock: 1.2,
        shockFrequency: 20.0, animationSpeed: 10.0, smoothness: 0.5,
        particleCount: 40, emissionRate: 0.02, particleLife: 0.6, startScale: 1.5, endScale: 0.1, startAlpha: 0.9, velocity: 20, spread: 8, textureSoftness: 0.5
    },
    'chemical': {
        length: 4.2, radius: 0.65, color: '#ff6600', density: 1.5, glow: 1.5, noiseScale: 6.0, shock: 0.5,
        shockFrequency: 10.0, animationSpeed: 15.0, smoothness: 0.1
    },
    'ion_red': {
        length: 5.0, radius: 0.45, color: '#ff0000', density: 0.8, glow: 4.0, noiseScale: 0.5, shock: 0.2,
        shockFrequency: 50.0, animationSpeed: 20.0, smoothness: 0.95
    },
    'plasma_green': {
        length: 3.5, radius: 0.7, color: '#00ff00', density: 1.5, glow: 3.0, noiseScale: 4.0, shock: 1.5,
        shockFrequency: 8.0, animationSpeed: 5.0, smoothness: 0.3
    },
    'nuclear_blue': {
        length: 4.5, radius: 0.6, color: '#0022ff', density: 1.3, glow: 5.0, noiseScale: 2.0, shock: 2.0,
        shockFrequency: 25.0, animationSpeed: 12.0, smoothness: 0.4
    },
    'antimatter': {
        length: 6.0, radius: 0.4, color: '#aa00ff', density: 0.9, glow: 3.5, noiseScale: 8.0, shock: 1.0,
        shockFrequency: 40.0, animationSpeed: 25.0, smoothness: 0.7
    },
    'fusion': {
        length: 3.0, radius: 0.8, color: '#ffcc00', density: 1.8, glow: 4.0, noiseScale: 5.0, shock: 1.8,
        shockFrequency: 12.0, animationSpeed: 8.0, smoothness: 0.2
    },
    'impulse': {
        length: 2.0, radius: 0.5, color: '#ffffff', density: 0.7, glow: 2.0, noiseScale: 1.0, shock: 0.2,
        shockFrequency: 50.0, animationSpeed: 30.0, smoothness: 0.8
    }
};

// Get all presets including custom ones from localStorage
export function getAllPresets(): Record<string, PlumeConfig> {
    return {
        ...PLUME_PRESETS,
        ...loadCustomPresets()
    };
}
