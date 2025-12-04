import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import react from '@vitejs/plugin-react'

type Ware = { id: string; name: string; category: 'primary' | 'food' | 'intermediate' | 'end'; basePrice: number; volume: number }
type Recipe = { id: string; productId: string; inputs: { wareId: string; amount: number }[]; cycleTimeSec: number; batchSize: number; productStorageCap: number }
type Station = { id: string; name: string; recipeId: string; sectorId: string; inventory: Record<string, number>; reorderLevel: Record<string, number>; reserveLevel: Record<string, number> }
type UniverseState = { wares: Ware[]; recipes: Recipe[]; stations: Station[]; sectorPrices: Record<string, Record<string, number>>; timeScale: number; acc: number }

function createUniverse() {
  const state: UniverseState = { wares: [], recipes: [], stations: [], sectorPrices: {}, timeScale: 1, acc: 0 }
  const init = () => {
    const wares: Ware[] = [
      { id: 'energy_cells', name: 'Energy Cells', category: 'primary', basePrice: 16, volume: 1 },
      { id: 'crystals', name: 'Crystals', category: 'intermediate', basePrice: 1684, volume: 1 },
      { id: 'meatsteak', name: 'Meatsteak Cahoonas', category: 'food', basePrice: 72, volume: 1 }
    ]
    const recipes: Recipe[] = [
      { id: 'spp_argon', productId: 'energy_cells', inputs: [{ wareId: 'crystals', amount: 1 }], cycleTimeSec: 60, batchSize: 10, productStorageCap: 5000 },
      { id: 'cahoona_bakery', productId: 'meatsteak', inputs: [
        { wareId: 'energy_cells', amount: 15 }
      ], cycleTimeSec: 120, batchSize: 30, productStorageCap: 10000 }
    ]
    const stations: Station[] = [
      { id: 'argon_spp_01', name: 'Solar Power Plant', recipeId: 'spp_argon', sectorId: 'argon_prime', inventory: { energy_cells: 0, crystals: 10 }, reorderLevel: { crystals: 5 }, reserveLevel: { energy_cells: 100 } },
      { id: 'cahoona_bakery_01', name: 'Cahoona Bakery', recipeId: 'cahoona_bakery', sectorId: 'home_of_light', inventory: { energy_cells: 200 }, reorderLevel: { energy_cells: 150 }, reserveLevel: { meatsteak: 200 } }
    ]
    state.wares = wares
    state.recipes = recipes
    state.stations = stations
    state.sectorPrices = {}
  }
  const tick = (deltaSec: number) => {
    const tickLen = 10
    if (deltaSec < tickLen) return
    const nextStations = state.stations.map((st) => ({ ...st, inventory: { ...st.inventory } }))
    const recipeById = new Map(state.recipes.map((r) => [r.id, r]))
    for (const st of nextStations) {
      const r = recipeById.get(st.recipeId)
      if (!r) continue
      const canRun = r.inputs.every((x) => (st.inventory[x.wareId] || 0) >= x.amount)
      if (canRun) {
        for (const x of r.inputs) st.inventory[x.wareId] = (st.inventory[x.wareId] || 0) - x.amount
        st.inventory[r.productId] = (st.inventory[r.productId] || 0) + r.batchSize
      }
    }
    const sectorPrices = { ...state.sectorPrices }
    for (const st of nextStations) {
      const r = recipeById.get(st.recipeId)
      if (!r) continue
      const sp = sectorPrices[st.sectorId] || {}
      for (const x of r.inputs) {
        const base = state.wares.find((w) => w.id === x.wareId)?.basePrice || 1
        const stock = st.inventory[x.wareId] || 0
        const rl = st.reorderLevel[x.wareId] || 0
        const mod = Math.max(0.5, Math.min(2.0, rl <= 0 ? 1 : 1 + (rl - stock) / Math.max(rl, 1)))
        sp[x.wareId] = base * mod
      }
      const baseProd = state.wares.find((w) => w.id === r.productId)?.basePrice || 1
      const prodStock = st.inventory[r.productId] || 0
      const reserve = st.reserveLevel[r.productId] || 0
      const modProd = Math.max(0.5, Math.min(2.0, reserve <= 0 ? 1 : 1 - (reserve - prodStock) / Math.max(reserve, 1)))
      sp[r.productId] = baseProd * modProd
      sectorPrices[st.sectorId] = sp
    }
    state.stations = nextStations
    state.sectorPrices = sectorPrices
  }
  const loop = () => {
    state.acc += 1 * Math.max(0.1, state.timeScale)
    if (state.acc >= 10) {
      tick(state.acc)
      state.acc = 0
    }
  }
  const setTimeScale = (v: number) => { state.timeScale = v }
  return { state, init, tick, loop, setTimeScale }
}

function universePlugin() {
  return {
    name: 'universe-instance',
    configureServer(server: ViteDevServer) {
      const u = createUniverse()
      u.init()
      const i = setInterval(() => u.loop(), 1000)
      server.httpServer?.on('close', () => clearInterval(i))
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || ''
        if (req.method === 'GET' && url.startsWith('/__universe/state')) {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ wares: u.state.wares, recipes: u.state.recipes, stations: u.state.stations, sectorPrices: u.state.sectorPrices, timeScale: u.state.timeScale }))
          return
        }
        if (req.method === 'POST' && url.startsWith('/__universe/init')) {
          u.init()
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method === 'POST' && url.startsWith('/__universe/tick')) {
          const full = new URL(url, 'http://localhost')
          const d = Number(full.searchParams.get('delta') || '0')
          u.tick(d)
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method === 'POST' && url.startsWith('/__universe/time-scale')) {
          const full = new URL(url, 'http://localhost')
          const v = Number(full.searchParams.get('value') || '1')
          u.setTimeScale(v)
          res.statusCode = 204
          res.end()
          return
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), universePlugin()],
})
