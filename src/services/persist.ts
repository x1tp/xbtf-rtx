export type UserData = {
    categories?: Record<string, string>;
    names?: Record<string, string>;
    plumes?: Record<string, { positions: { x: number; y: number; z: number; type?: string }[] }>;
    cockpits?: Record<string, { position: { x: number; y: number; z: number } | null }>;
    weapons?: Record<string, { positions: { x: number; y: number; z: number }[] }>;
};

let cache: UserData = {};
let loaded = false;

async function load() {
    if (loaded) return cache;
    try {
        const res = await fetch('/__persist/load');
        if (res.ok) {
            cache = await res.json();
            loaded = true;
        }
    } catch (e) {
        console.error('Failed to load user data', e);
    }
    return cache;
}

async function save() {
    try {
        await fetch('/__persist/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cache, null, 2)
        });
    } catch (e) {
        console.error('Failed to save user data', e);
    }
}

const listeners: (() => void)[] = [];

function notify() {
    listeners.forEach(l => l());
}

export const persist = {
    async init() {
        await load();
        notify();
    },

    subscribe(listener: () => void) {
        listeners.push(listener);
        return () => {
            const idx = listeners.indexOf(listener);
            if (idx !== -1) listeners.splice(idx, 1);
        };
    },

    getCategory(modelPath: string): string | undefined {
        return cache.categories?.[modelPath];
    },

    async setCategory(modelPath: string, category: string) {
        if (!cache.categories) cache.categories = {};
        cache.categories[modelPath] = category;
        await save();
        notify();
    },

    getName(modelPath: string): string | undefined {
        return cache.names?.[modelPath];
    },

    async setName(modelPath: string, name: string) {
        if (!cache.names) cache.names = {};
        cache.names[modelPath] = name;
        await save();
        notify();
    },


    getPlumes(modelPath: string) {
        return cache.plumes?.[`ship:engineMarkers:${modelPath}`]?.positions || [];
    },

    async setPlumes(modelPath: string, positions: { x: number; y: number; z: number; type?: string }[]) {
        if (!cache.plumes) cache.plumes = {};
        cache.plumes[`ship:engineMarkers:${modelPath}`] = { positions };
        await save();
        notify();
    },

    getCockpit(modelPath: string) {
        return cache.cockpits?.[`ship:cockpit:${modelPath}`]?.position || null;
    },

    async setCockpit(modelPath: string, position: { x: number; y: number; z: number } | null) {
        if (!cache.cockpits) cache.cockpits = {};
        cache.cockpits[`ship:cockpit:${modelPath}`] = { position };
        await save();
        notify();
    },

    getWeapons(modelPath: string) {
        return cache.weapons?.[`ship:weapons:${modelPath}`]?.positions || [];
    },

    async setWeapons(modelPath: string, positions: { x: number; y: number; z: number }[]) {
        if (!cache.weapons) cache.weapons = {};
        cache.weapons[`ship:weapons:${modelPath}`] = { positions };
        await save();
        notify();
    }
};
