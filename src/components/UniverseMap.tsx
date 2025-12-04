import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { UNIVERSE_SECTORS_XT } from '../config/universe_xtension'
import type { UniverseSector } from '../config/universe_xtension'

type Vec2 = { x: number; y: number }

const ownerColor: Record<string, string> = {
  argon: '#6ad0ff',
  boron: '#66ffa6',
  paranid: '#ffcc66',
  split: '#ff8888',
  teladi: '#a6ff66',
  pirat: '#ffaa66',
  xenon: '#cccccc'
}

const useLayout = (sectors: UniverseSector[]) => {
  return useMemo(() => {
    const n = sectors.length
    const pos: Record<string, Vec2> = {}
    const ids = sectors.map((s) => s.id)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      pos[ids[i]] = { x: Math.cos(a) * 300, y: Math.sin(a) * 300 }
    }
    const adj = new Map<string, string[]>()
    sectors.forEach((s: UniverseSector) => adj.set(s.id, s.neighbors.map((nm: string) => {
      const t = sectors.find((q: UniverseSector) => q.name.toLowerCase() === nm.toLowerCase())
      return t ? t.id : ''
    }).filter(Boolean)))
    for (let iter = 0; iter < 800; iter++) {
      for (let i = 0; i < n; i++) {
        const id = ids[i]
        const p = pos[id]
        let fx = -p.x * 0.001
        let fy = -p.y * 0.001
        const neigh = adj.get(id) || []
        for (const nb of neigh) {
          const q = pos[nb]
          const dx = q.x - p.x
          const dy = q.y - p.y
          const d = Math.max(1, Math.hypot(dx, dy))
          const k = 0.02
          fx += (dx / d) * k * (d - 120)
          fy += (dy / d) * k * (d - 120)
        }
        for (let j = 0; j < n; j++) {
          if (j === i) continue
          const id2 = ids[j]
          const q = pos[id2]
          const dx = q.x - p.x
          const dy = q.y - p.y
          const d2 = Math.max(1, dx * dx + dy * dy)
          const k2 = 4000 / d2
          fx -= dx * k2
          fy -= dy * k2
        }
        p.x += fx
        p.y += fy
      }
    }
    const xs = ids.map((id) => pos[id].x)
    const ys = ids.map((id) => pos[id].y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const w = maxX - minX, h = maxY - minY
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const norm = Math.max(w, h)
    ids.forEach((id) => {
      pos[id].x = (pos[id].x - cx) / (norm || 1)
      pos[id].y = (pos[id].y - cy) / (norm || 1)
    })
    return pos
  }, [sectors])
}

export const UniverseMap: React.FC = () => {
  const open = useGameStore((s) => s.universeMapOpen)
  const setOpen = useGameStore((s) => s.setUniverseMapOpen)
  const setSelectedSectorId = useGameStore((s) => s.setSelectedSectorId)
  const setSectorMapOpen = useGameStore((s) => s.setSectorMapOpen)
  const currentSectorId = useGameStore((s) => s.currentSectorId)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [activeOwner, setActiveOwner] = useState<string>('all')
  const sectors = UNIVERSE_SECTORS_XT
  const pos = useLayout(sectors)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1024, h: 768 })
  useLayoutEffect(() => {
    if (!open) return
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      setSize({ w: Math.max(400, cr.width), h: Math.max(300, cr.height) })
    })
    ro.observe(el)
    const r = el.getBoundingClientRect()
    setSize({ w: Math.max(400, r.width), h: Math.max(300, r.height) })
    return () => { ro.disconnect() }
  }, [open])
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyU' || e.code === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      } else {
        e.stopPropagation()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation() }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [open, setOpen])
  if (!open) return null
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const d = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((z) => Math.max(0.2, Math.min(5, z * d)))
  }
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 2) setDrag({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (drag) setPan({ x: e.clientX - drag.x, y: e.clientY - drag.y })
  }
  const onMouseUp = () => setDrag(null)
  const toMap = (p: Vec2) => ({ x: p.x * (size.w * 0.85) * zoom + size.w / 2 + pan.x, y: p.y * (size.h * 0.85) * zoom + size.h / 2 + pan.y })
  const selectSector = (id: string) => {
    setSelectedSectorId(id)
    setOpen(false)
    setSectorMapOpen(true)
  }
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0, 5, 15, 0.95)', zIndex: 1000, display: 'flex', fontFamily: 'monospace', userSelect: 'none'
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '2px solid #1a3a50' }}
      >
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px',
            background: 'linear-gradient(180deg, rgba(30, 50, 70, 0.9) 0%, rgba(20, 35, 50, 0.95) 100%)', borderBottom: '1px solid #2a5070'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#6ad0ff', fontSize: 14, letterSpacing: 1 }}>Universe Map</span>
            <span style={{ color: '#ffaa44', fontSize: 12 }}>Top (X-Y)</span>
            <span style={{ color: '#4a8ab0', fontSize: 12 }}>+{zoom.toFixed(1)}</span>
            <span style={{ color: '#4a8ab0', fontSize: 12 }}>{sectors.length} sectors</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: '1px solid #4a6a80', color: '#8ac0e0', padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}
          >✕</button>
        </div>
        <div
          ref={containerRef}
          style={{
            flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(10, 25, 40, 0.95) 0%, rgba(5, 15, 25, 0.98) 100%)', overflow: 'hidden', position: 'relative'
          }}
        >
          <svg
            width={size.w}
            height={size.h}
            style={{ cursor: drag ? 'grabbing' : 'grab', background: 'transparent', position: 'absolute', top: 0, left: 0, userSelect: 'none' }}
            onWheel={onWheel}
            onMouseDown={(e) => { e.preventDefault(); onMouseDown(e) }}
            onMouseMove={(e) => { if (drag) e.preventDefault(); onMouseMove(e) }}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onDragStart={(e) => e.preventDefault()}
          >
            <g>
              {(() => {
                const gridSpacingNorm = 0.08
                const gridCount = 40
                const grid: React.ReactElement[] = []
                for (let i = -gridCount; i <= gridCount; i++) {
                  const offY = i * gridSpacingNorm * (size.h * 0.85) * zoom
                  const offX = i * gridSpacingNorm * (size.w * 0.85) * zoom
                  grid.push(
                    <line key={'h' + i} x1={0} y1={size.h / 2 + offY + pan.y} x2={size.w} y2={size.h / 2 + offY + pan.y} stroke="rgba(40, 80, 120, 0.3)" strokeWidth={1} />,
                    <line key={'v' + i} x1={size.w / 2 + offX + pan.x} y1={0} x2={size.w / 2 + offX + pan.x} y2={size.h} stroke="rgba(40, 80, 120, 0.3)" strokeWidth={1} />
                  )
                }
                return grid
              })()}
              <line x1={0} y1={size.h / 2 + pan.y} x2={size.w} y2={size.h / 2 + pan.y} stroke="rgba(60, 120, 160, 0.5)" strokeWidth={1} />
              <line x1={size.w / 2 + pan.x} y1={0} x2={size.w / 2 + pan.x} y2={size.h} stroke="rgba(60, 120, 160, 0.5)" strokeWidth={1} />
              <text x={size.w - 25} y={size.h / 2 + pan.y - 5} fill="#4080a0" fontSize={11} style={{ userSelect: 'none' }}>+x</text>
              <text x={10} y={size.h / 2 + pan.y - 5} fill="#4080a0" fontSize={11} style={{ userSelect: 'none' }}>-x</text>
              <text x={size.w / 2 + pan.x + 5} y={20} fill="#4080a0" fontSize={11} style={{ userSelect: 'none' }}>-y</text>
              <text x={size.w / 2 + pan.x + 5} y={size.h - 10} fill="#4080a0" fontSize={11} style={{ userSelect: 'none' }}>+y</text>
            </g>
            <g>
              {sectors.flatMap((s: UniverseSector) => {
                const a = toMap(pos[s.id])
                return s.neighbors.map((nm: string, j: number) => {
                  const t = sectors.find((q: UniverseSector) => q.name.toLowerCase() === nm.toLowerCase())
                  if (!t) return null
                  const b = toMap(pos[t.id])
                  return <line key={s.id + ':' + j} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(120,160,200,0.35)" strokeWidth={1} />
                }).filter(Boolean)
              })}
              {sectors.filter((s: UniverseSector) => activeOwner === 'all' || s.owner === activeOwner).map((s: UniverseSector) => {
                const p = toMap(pos[s.id])
                const c = ownerColor[s.owner] || '#8aa0b0'
                const isCur = s.id === currentSectorId
                return (
                  <g key={s.id} transform={`translate(${p.x}, ${p.y})`} style={{ cursor: 'pointer' }} onClick={() => selectSector(s.id)}>
                    {isCur && <rect x={-10} y={-10} width={20} height={20} fill="none" stroke="#ffff00" strokeWidth={1} strokeDasharray="4,2" />}
                    <rect x={-5} y={-5} width={10} height={10} fill={c} opacity={0.85} />
                    <rect x={-5} y={-5} width={10} height={10} fill="none" stroke="#22384f" strokeWidth={1} />
                    <text x={0} y={18} textAnchor="middle" fill={isCur ? '#ffff00' : '#cde8ff'} fontSize={10} style={{ userSelect: 'none' }}>{s.name}</text>
                  </g>
                )
              })}
          </g>
          </svg>
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => setZoom((z) => Math.min(5, z * 1.2))} style={{ width: 24, height: 24, background: 'rgba(30, 50, 70, 0.8)', border: '1px solid #3a6a90', color: '#8ac0e0', cursor: 'pointer', fontSize: 14 }}>+</button>
            <button onClick={() => setZoom((z) => Math.max(0.2, z * 0.8))} style={{ width: 24, height: 24, background: 'rgba(30, 50, 70, 0.8)', border: '1px solid #3a6a90', color: '#8ac0e0', cursor: 'pointer', fontSize: 14 }}>−</button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={{ width: 24, height: 24, background: 'rgba(30, 50, 70, 0.8)', border: '1px solid #3a6a90', color: '#8ac0e0', cursor: 'pointer', fontSize: 10 }}>⟲</button>
          </div>
        </div>
      </div>
      <div style={{ width: 280, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, rgba(25, 45, 65, 0.95) 0%, rgba(15, 30, 45, 0.98) 100%)' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a5070', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#ff9944', fontSize: 14, fontWeight: 'bold' }}>Legend</span>
        </div>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(ownerColor).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setActiveOwner((cur) => (cur === k ? 'all' : k))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, background: activeOwner === k ? 'rgba(50,80,110,0.6)' : 'transparent',
                border: '1px solid #2a5070', color: '#c0d0e0', padding: '4px 8px', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <div style={{ width: 14, height: 14, background: v }} />
              <span style={{ fontSize: 11 }}>{k}</span>
              <span style={{ fontSize: 11, marginLeft: 'auto', color: '#6a90b0' }}>{sectors.filter((s) => s.owner === k).length}</span>
            </button>
          ))}
          <div style={{ color: '#5080a0', fontSize: 10, marginTop: 8, textAlign: 'center' }}>{sectors.length} sectors | U: Close</div>
        </div>
      </div>
    </div>
  )
}
