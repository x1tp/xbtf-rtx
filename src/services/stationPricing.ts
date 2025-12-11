import type { Station } from '../store/gameStore'

type Recipe = {
  id: string
  productId: string
  inputs: { wareId: string; amount: number }[]
  cycleTimeSec: number
  batchSize: number
  productStorageCap?: number
}

type Ware = { id: string; basePrice: number }

const clampPrice = (v: number) => Math.max(0.5, Math.min(2, v))

/**
 * Calculate a station-specific price for a ware using the same logic
 * as the backend sector price calculation. This lets the UI show the
 * offer price a station is willing to pay for inputs, or the ask price
 * it will sell its product for.
 */
export const computeStationPrice = (
  station: Station,
  recipe: Recipe | undefined,
  wareId: string,
  basePrice: number | undefined
): number | null => {
  if (!recipe || typeof basePrice !== 'number') return null

  const isInput = recipe.inputs.some((i) => i.wareId === wareId)
  if (isInput) {
    const stock = station.inventory[wareId] || 0
    const reorder = station.reorderLevel[wareId] || 0
    const mod = clampPrice(reorder <= 0 ? 1 : 1 + (reorder - stock) / Math.max(reorder, 1))
    return Math.round(basePrice * mod)
  }

  if (recipe.productId === wareId) {
    const stock = station.inventory[wareId] || 0
    const reserve = station.reserveLevel[wareId] || 0
    const mod = clampPrice(reserve <= 0 ? 1 : 1 + (reserve - stock) / Math.max(reserve, 1))
    return Math.round(basePrice * mod)
  }

  return null
}

/**
 * Build a price map for all wares this station trades (inputs + product).
 */
export const getStationPriceMap = (station: Station, recipe: Recipe | undefined, wares: Ware[]) => {
  const baseMap = new Map<string, number>(wares.map((w) => [w.id, w.basePrice]))
  const prices: Record<string, number> = {}
  if (!recipe) return prices

  recipe.inputs.forEach((inp) => {
    const p = computeStationPrice(station, recipe, inp.wareId, baseMap.get(inp.wareId))
    if (p !== null) prices[inp.wareId] = p
  })

  const prodPrice = computeStationPrice(station, recipe, recipe.productId, baseMap.get(recipe.productId))
  if (prodPrice !== null) prices[recipe.productId] = prodPrice

  return prices
}
