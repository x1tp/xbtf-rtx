import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

export const EconomyTicker = () => {
  const syncEconomy = useGameStore((s) => s.syncEconomy)
  useEffect(() => { syncEconomy() }, [syncEconomy])
  useEffect(() => {
    const id = setInterval(() => { syncEconomy() }, 1000)
    return () => clearInterval(id)
  }, [syncEconomy])
  return null
}
