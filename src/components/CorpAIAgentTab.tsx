import { useEffect, useMemo, useRef, useState } from 'react'
import type { Corporation, NPCFleet } from '../types/simulation'
import type { Station } from '../store/gameStore'

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

type AppliedAction =
  | { type: 'set_station_reorder_level'; stationId: string; wareId: string; reorderLevel: number }
  | { type: 'set_station_reserve_level'; stationId: string; wareId: string; reserveLevel: number }
  | { type: 'assign_trade'; fleetId: string; buyStationId: string; sellStationId: string; wareId: string; qty: number }
  | { type: 'set_corp_goal'; corpId: string; goal: string }

type CorpLogKind = 'context' | 'plan' | 'decision' | 'actions' | 'error'
type CorpLogEntry = {
  id: number
  ingameTimeSec: number
  kind: CorpLogKind
  data: any
}

type CorpLive = {
  corpId: string
  status: 'idle' | 'running' | 'done' | 'error'
  startedAtMs: number
  updatedAtMs: number
  pass: number
  text: string
  error?: string
}

export function CorpAIAgentTab(props: {
  corpId: string
  corporations: Corporation[]
  stations: Station[]
  fleets: NPCFleet[]
  title?: string
}) {
  const { corpId, corporations, stations, fleets, title } = props
  const corp = corporations.find((c) => c.id === corpId)

  const corpStations = useMemo(() => stations.filter((s) => s.ownerId === corpId), [stations, corpId])
  const corpFleets = useMemo(() => fleets.filter((f) => f.ownerId === corpId), [fleets, corpId])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [logEntries, setLogEntries] = useState<CorpLogEntry[]>([])
  // `live` is intentionally loosely typed since it is best-effort streaming data from the devserver.
  const [live, setLive] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastActions, setLastActions] = useState<AppliedAction[] | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [stationSales, setStationSales] = useState<{
    windowSec: number
    externalStationSalesTotal: number
    externalStationSalesWindow: number
    externalStationSalesTradesTotal: number
    externalStationSalesTradesWindow: number
    byWareWindow: { wareId: string; revenue: number }[]
  } | null>(null)
  const [lastLogId, setLastLogId] = useState(0)
  const pollingRef = useRef<number | null>(null)
  const lastLogIdRef = useRef(0)
  const logScrollRef = useRef<HTMLDivElement | null>(null)
  const stickLogToBottomRef = useRef(true)
  lastLogIdRef.current = lastLogId

  const appendMessage = (m: ChatMessage) => setMessages((prev) => [...prev, m].slice(-200))

  const runNow = async () => {
    if (busy) return
    setBusy(true)
    setLastError(null)
    try {
      const res = await fetch(`/__ai/corp-autopilot-run?corpId=${encodeURIComponent(corpId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
    } catch (e: any) {
      setLastError(e?.message || 'Run failed')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const el = logScrollRef.current
    if (!el) return
    if (!stickLogToBottomRef.current) return

    const raf = window.requestAnimationFrame(() => {
      const node = logScrollRef.current
      if (!node) return
      node.scrollTop = node.scrollHeight
    })
    return () => window.cancelAnimationFrame(raf)
  }, [logEntries.length, messages.length, live?.text])

  const formatJson = (obj: any) => {
    let s = ''
    try { s = JSON.stringify(obj, null, 2) } catch { s = String(obj) }
    const limit = 12000
    if (s.length > limit) s = `${s.slice(0, limit)}\n… (truncated)`
    return s
  }

  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const r = s % 60
    return `${h}h ${String(m).padStart(2, '0')}m ${String(r).padStart(2, '0')}s`
  }

  const formatDecision = (text: string) => {
    const trimmed = (text || '').trim()
    if (!trimmed) return ''
    // Common patterns: **DECISION** / **RATIONALE** etc. Make them stand out.
    return trimmed
      .replaceAll('**DECISION**', 'DECISION')
      .replaceAll('**RATIONALE**', 'RATIONALE')
      .replaceAll('**ACTIONS**', 'ACTIONS')
  }

  const formatActionLine = (a: any) => {
    const type = String(a?.type || '')
    const ok = typeof a?.ok === 'boolean' ? a.ok : null
    const suffix = ok == null ? '' : ok ? ' (ok)' : ' (failed)'
    if (type === 'assign_trade') {
      return `Assign trade: fleet=${a.fleetId} buy=${a.wareId} x${a.qty} @${a.buyStationId} -> sell @${a.sellStationId}${suffix}`
    }
    if (type === 'set_station_reorder_level') {
      return `Set reorder level: station=${a.stationId} ware=${a.wareId} reorderLevel=${a.reorderLevel}${suffix}`
    }
    if (type === 'set_station_reserve_level') {
      return `Set reserve level: station=${a.stationId} ware=${a.wareId} reserveLevel=${a.reserveLevel}${suffix}`
    }
    if (type === 'set_corp_goal') {
      return `Set corp goal: corp=${a.corpId} goal=${a.goal}${suffix}`
    }
    if (type === 'buy_trader_vulture') {
      const err = a?.error ? ` error=${a.error}` : ''
      return `Buy trader: Vulture fleet=${a.fleetId ?? 'n/a'} price=${a.price ?? 'n/a'} shipyard=${a.shipyardId ?? 'n/a'}${suffix}${err}`
    }
    if (type === 'queue_station_construction') {
      return `Queue station: type=${a.stationType} sector=${a.targetSectorId}${suffix}`
    }
    if (type === 'update_llm_plan') {
      return `Update plan${suffix}`
    }
    return JSON.stringify(a)
  }

  const renderContextSummary = (ctx: any) => {
    const corpState = ctx?.corp || null
    const stationsState: any[] = Array.isArray(ctx?.stations) ? ctx.stations : []
    const fleetsState: any[] = Array.isArray(ctx?.fleets) ? ctx.fleets : []
    const relevantWares: any[] = Array.isArray(ctx?.relevantWares) ? ctx.relevantWares : []
    const recentTrades: any[] = Array.isArray(ctx?.recentTrades) ? ctx.recentTrades : []
    const meta = ctx?._meta || null

    const topCredits = typeof corpState?.credits === 'number' ? Math.floor(corpState.credits).toLocaleString() : 'n/a'
    const goal = corpState?.aiState?.currentGoal || corpState?.aiState?.currentGoal || 'unknown'

    const activeOrders = fleetsState.filter((f) => f?.currentOrder)
    const stationsWithInventory = stationsState.filter((s) => s && s.inventory && Object.keys(s.inventory).length > 0)
    const contextTokens = typeof meta?.contextTokensEstimated === 'number' ? meta.contextTokensEstimated : null
    const contextChars = typeof meta?.contextChars === 'number' ? meta.contextChars : null

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        <div style={{ background: '#0a1520', border: '1px solid #12384f', borderRadius: 8, padding: 10 }}>
          <div style={{ color: '#6090a0', fontSize: 10 }}>CORP</div>
          <div style={{ color: '#c3e7ff', fontSize: 13, marginTop: 4 }}>{corpState?.name || 'unknown'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
            <span style={{ color: '#8ab6d6' }}>Credits</span>
            <span style={{ color: '#88cc44' }}>{topCredits} Cr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
            <span style={{ color: '#8ab6d6' }}>Goal</span>
            <span style={{ color: '#c3e7ff' }}>{String(goal)}</span>
          </div>
        </div>

        <div style={{ background: '#0a1520', border: '1px solid #12384f', borderRadius: 8, padding: 10 }}>
          <div style={{ color: '#6090a0', fontSize: 10 }}>SNAPSHOT</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
            <span style={{ color: '#8ab6d6' }}>Stations</span>
            <span style={{ color: '#c3e7ff' }}>{stationsState.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
            <span style={{ color: '#8ab6d6' }}>Fleets</span>
            <span style={{ color: '#c3e7ff' }}>{fleetsState.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
            <span style={{ color: '#8ab6d6' }}>Active Orders</span>
            <span style={{ color: '#ffaa44' }}>{activeOrders.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
            <span style={{ color: '#8ab6d6' }}>Context Sent</span>
            <span style={{ color: '#c3e7ff' }}>
              {contextTokens == null ? 'n/a' : `≈${Number(contextTokens).toLocaleString()} tok`}
              {contextChars == null ? '' : ` (${Number(contextChars).toLocaleString()} ch)`}
            </span>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', background: '#0a1520', border: '1px solid #12384f', borderRadius: 8, padding: 10 }}>
          <div style={{ color: '#6090a0', fontSize: 10, marginBottom: 8 }}>HIGHLIGHTS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
            <div>
              <div style={{ color: '#8ab6d6', marginBottom: 4 }}>Stations w/ stock</div>
              <div style={{ color: '#c3e7ff' }}>{stationsWithInventory.length}</div>
            </div>
            <div>
              <div style={{ color: '#8ab6d6', marginBottom: 4 }}>Recent trades</div>
              <div style={{ color: '#c3e7ff' }}>{recentTrades.length}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: '#8ab6d6', marginBottom: 4 }}>Relevant wares</div>
              <div style={{ color: '#c3e7ff' }}>
                {relevantWares.length === 0 ? 'none' : relevantWares.map((w) => w.name || w.id).slice(0, 12).join(', ') + (relevantWares.length > 12 ? '…' : '')}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderPlan = (plan: any) => {
    const strategy = typeof plan?.strategy === 'string' ? plan.strategy.trim() : ''
    const todos: any[] = Array.isArray(plan?.todos) ? plan.todos : []
    const outcomes: any[] = Array.isArray(plan?.lastOutcomes) ? plan.lastOutcomes : []

    const byStatus = (s: string) => todos.filter((t) => String(t?.status || 'open') === s).length

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        <div style={{ background: '#0a1520', border: '1px solid #12384f', borderRadius: 8, padding: 10 }}>
          <div style={{ color: '#6090a0', fontSize: 10 }}>STRATEGY</div>
          <div style={{ color: '#c3e7ff', fontSize: 12, marginTop: 6, whiteSpace: 'pre-wrap' }}>
            {strategy || 'n/a'}
          </div>
        </div>
        <div style={{ background: '#0a1520', border: '1px solid #12384f', borderRadius: 8, padding: 10 }}>
          <div style={{ color: '#6090a0', fontSize: 10 }}>TODOs</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginTop: 8 }}>
            <div><div style={{ color: '#8ab6d6' }}>Open</div><div style={{ color: '#c3e7ff' }}>{byStatus('open')}</div></div>
            <div><div style={{ color: '#8ab6d6' }}>Doing</div><div style={{ color: '#c3e7ff' }}>{byStatus('doing')}</div></div>
            <div><div style={{ color: '#8ab6d6' }}>Blocked</div><div style={{ color: '#c3e7ff' }}>{byStatus('blocked')}</div></div>
            <div><div style={{ color: '#8ab6d6' }}>Done</div><div style={{ color: '#c3e7ff' }}>{byStatus('done')}</div></div>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', background: '#0a1520', border: '1px solid #12384f', borderRadius: 8, padding: 10 }}>
          <div style={{ color: '#6090a0', fontSize: 10, marginBottom: 8 }}>LIST</div>
          {todos.length === 0 ? (
            <div style={{ color: '#6090a0', fontSize: 12 }}>none</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todos.slice(0, 20).map((t, idx) => (
                <div key={idx} style={{ border: '1px solid #12384f', borderRadius: 8, padding: 8, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ color: '#c3e7ff', fontSize: 12, whiteSpace: 'pre-wrap' }}>{String(t?.title || '')}</div>
                  <div style={{ color: String(t?.status) === 'done' ? '#88cc44' : String(t?.status) === 'blocked' ? '#ff6666' : String(t?.status) === 'doing' ? '#ffaa44' : '#8ab6d6', fontSize: 12 }}>
                    {String(t?.status || 'open')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {outcomes.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', color: '#8ab6d6', fontSize: 12 }}>Recent outcomes</summary>
              <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: '#c3e7ff', fontSize: 11 }}>{formatJson(outcomes.slice(0, 20))}</pre>
            </details>
          )}
        </div>
      </div>
    )
  }

  useEffect(() => {
    const poll = async () => {
      try {
        const since = lastLogIdRef.current
        const [logsRes, liveRes] = await Promise.all([
          fetch(`/__ai/corp-logs?corpId=${encodeURIComponent(corpId)}&since=${encodeURIComponent(String(since))}`),
          fetch(`/__ai/corp-live?corpId=${encodeURIComponent(corpId)}`),
        ])
        const data = await logsRes.json().catch(() => ({}))
        const liveData = liveRes.ok ? await liveRes.json().catch(() => ({})) : null
        const entries = Array.isArray(data?.entries) ? data.entries : []
        if (!liveRes.ok) {
          setLive({
            corpId,
            status: 'error',
            startedAtMs: Date.now(),
            updatedAtMs: Date.now(),
            pass: 0,
            text: '',
            error: `corp-live unavailable (HTTP ${liveRes.status}) — restart dev server?`,
          })
        } else {
          const nextLive = (liveData as any)?.live || null
          setLive(nextLive && typeof nextLive === 'object' ? (nextLive as CorpLive) : null)
        }
        if (entries.length === 0) return

        const normalized: CorpLogEntry[] = entries
          .map((e: any) => ({
            id: Number(e?.id || 0),
            ingameTimeSec: Number(e?.ingameTimeSec || 0),
            kind: String(e?.kind || 'context') as CorpLogKind,
            data: e?.data,
          }))
          .filter((e: CorpLogEntry) => e.id > 0)

        if (normalized.length > 0) {
          setLogEntries((prev) => {
            const byId = new Map<number, CorpLogEntry>()
            for (const e of prev) byId.set(e.id, e)
            for (const e of normalized) byId.set(e.id, e)
            return Array.from(byId.values())
              .sort((a, b) => a.id - b.id)
              .slice(-300)
          })
        }

        const maxId = entries.reduce((m: number, e: any) => Math.max(m, Number(e?.id || 0)), since)
        setLastLogId(maxId)
      } catch {
        // ignore polling errors
      }
    }

    if (pollingRef.current) window.clearInterval(pollingRef.current)
    pollingRef.current = window.setInterval(() => { void poll() }, 1000)
    void poll()

    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [corpId])

  useEffect(() => {
    let stopped = false
    const windowSec = 3600

    const poll = async () => {
      try {
        const res = await fetch(`/__universe/corp-revenue?corpId=${encodeURIComponent(corpId)}&windowSec=${windowSec}`)
        const data = await res.json().catch(() => null)
        if (!res.ok) return
        if (!stopped && data && typeof data === 'object') setStationSales(data)
      } catch {
        // ignore
      }
    }

    const id = window.setInterval(() => { void poll() }, 2000)
    void poll()
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [corpId])

  const send = async () => {
    const text = prompt.trim()
    if (!text || busy) return

    stickLogToBottomRef.current = true
    setBusy(true)
    setLastError(null)
    setLastActions(null)
    setPrompt('')

    appendMessage({ role: 'user', content: text })

    try {
      const res = await fetch('/__ai/corp-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corpId, messages: [{ role: 'user', content: text }] }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)

      const assistantMessage = typeof data?.assistantMessage === 'string' ? data.assistantMessage : ''
      const appliedActions = Array.isArray(data?.appliedActions) ? (data.appliedActions as AppliedAction[]) : null

      if (assistantMessage) appendMessage({ role: 'assistant', content: `DECISION\n${formatDecision(assistantMessage)}` })
      setLastActions(appliedActions)
    } catch (e: any) {
      setLastError(e?.message || 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  if (!corp) {
    return (
      <div style={{ padding: 16, color: '#ff6666' }}>
        Corp not found: <span style={{ color: '#c3e7ff' }}>{corpId}</span>
      </div>
    )
  }

  return (
      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12, overflow: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#c3e7ff', marginBottom: 6 }}>{corp.name}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: 12 }}>
          <div style={{ background: '#0a1520', border: '1px solid #12384f', borderRadius: 6, padding: 8 }}>
            <div style={{ color: '#6090a0', fontSize: 10 }}>CREDITS</div>
            <div style={{ color: '#88cc44', fontSize: 14 }}>{Math.floor(corp.credits).toLocaleString()} Cr</div>
          </div>
          <div style={{ background: '#0a1520', border: '1px solid #12384f', borderRadius: 6, padding: 8 }}>
            <div style={{ color: '#6090a0', fontSize: 10 }}>GOAL</div>
            <div style={{ color: '#c3e7ff', fontSize: 14 }}>{corp.aiState?.currentGoal || 'unknown'}</div>
          </div>
        </div>
        {stationSales && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: 12 }}>
            <div style={{ background: '#0a1520', border: '1px solid #12384f', borderRadius: 6, padding: 8 }}>
              <div style={{ color: '#6090a0', fontSize: 10 }}>STATION SALES (1H)</div>
              <div style={{ color: '#c3e7ff', fontSize: 14 }}>{Number(stationSales.externalStationSalesWindow || 0).toLocaleString()} Cr</div>
              <div style={{ color: '#6090a0', fontSize: 10 }}>{Number(stationSales.externalStationSalesTradesWindow || 0).toLocaleString()} trades</div>
            </div>
            <div style={{ background: '#0a1520', border: '1px solid #12384f', borderRadius: 6, padding: 8 }}>
              <div style={{ color: '#6090a0', fontSize: 10 }}>STATION SALES (LOG)</div>
              <div style={{ color: '#c3e7ff', fontSize: 14 }}>{Number(stationSales.externalStationSalesTotal || 0).toLocaleString()} Cr</div>
              <div style={{ color: '#6090a0', fontSize: 10 }}>{Number(stationSales.externalStationSalesTradesTotal || 0).toLocaleString()} trades</div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <div style={{ marginBottom: 6, color: '#8ab6d6' }}>Stations ({corpStations.length})</div>
          {corpStations.length === 0 ? (
            <div style={{ color: '#6090a0', fontSize: 12 }}>none</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {corpStations.slice(0, 60).map((st) => (
                <div key={st.id} style={{ padding: 8, borderRadius: 6, border: '1px solid #12384f', background: '#0a1520' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ color: '#c3e7ff', fontSize: 12 }}>{st.name}</div>
                    <div style={{ color: '#6090a0', fontSize: 11 }}>{st.sectorId}</div>
                  </div>
                  <div style={{ color: '#6090a0', fontSize: 10, marginTop: 4 }}>{st.recipeId}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ marginBottom: 6, color: '#8ab6d6' }}>Fleets ({corpFleets.length})</div>
          {corpFleets.length === 0 ? (
            <div style={{ color: '#6090a0', fontSize: 12 }}>none</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {corpFleets.slice(0, 60).map((f) => (
                <div key={f.id} style={{ padding: 8, borderRadius: 6, border: '1px solid #12384f', background: '#0a1520' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ color: '#c3e7ff', fontSize: 12 }}>{f.name}</div>
                    <div style={{ color: '#6090a0', fontSize: 11 }}>{f.currentSectorId}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10 }}>
                    <div style={{ color: '#8ab6d6' }}>{f.shipType}</div>
                    <div style={{ color: '#ffaa44' }}>{f.state}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, height: '100%', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0, background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ color: '#8ab6d6', fontWeight: 'bold' }}>{title || 'Corp AI Autopilot Log'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={busy}
                onClick={() => {
                  void runNow()
                }}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #88cc44',
                  background: '#0a1520',
                  color: '#88cc44',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  borderRadius: 6,
                  fontWeight: 'bold',
                  fontSize: 12,
                }}
              >
                Run Now
              </button>
              <button
                disabled={busy}
                onClick={() => { stickLogToBottomRef.current = true; setMessages([]); setLogEntries([]); setLastActions(null); setLastError(null); setLastLogId(0) }}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #184b6a',
                  background: '#0a1520',
                  color: '#8ab6d6',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div
            ref={logScrollRef}
            onScroll={(evt) => {
              const el = evt.currentTarget
              const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
              stickLogToBottomRef.current = distanceToBottom < 80
            }}
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}
          >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {false && live && (live.status === 'running' || live.status === 'error') && (
              <div style={{ background: '#0a1520', border: '1px solid #3fb6ff55', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#081018', borderBottom: '1px solid #3fb6ff33' }}>
                  <div style={{ color: '#c3e7ff', fontSize: 12, fontWeight: 'bold' }}>
                    <span style={{ color: '#3fb6ff' }}>DECISION (live)</span>
                    <span style={{ color: '#6090a0' }}> · pass {live.pass}</span>
                  </div>
                  <div style={{ color: '#2f4d60', fontSize: 11 }}>stream</div>
                </div>
                <div style={{ padding: 10 }}>
                  {live.status === 'error' ? (
                    <div style={{ color: '#ff8888', fontSize: 12, whiteSpace: 'pre-wrap' }}>{live.error || 'live_error'}</div>
                  ) : live.text ? (
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#c3e7ff', fontSize: 12, margin: 0 }}>{formatDecision(live.text)}</pre>
                  ) : (
                    <div style={{ color: '#6090a0', fontSize: 12 }}>Waiting for first tokens…</div>
                  )}
                </div>
              </div>
            )}
            {logEntries.length === 0 ? (
              <div style={{ color: '#6090a0', fontSize: 12 }}>
                Waiting for autopilot logs… (runs every 1 in-game hour by default)
              </div>
            ) : (
              logEntries.map((e) => {
                const time = formatTime(e.ingameTimeSec)
                const headerColor =
                  e.kind === 'context' ? '#aa88ff' :
                    e.kind === 'plan' ? '#d6a8ff' :
                    e.kind === 'decision' ? '#3fb6ff' :
                      e.kind === 'actions' ? '#88cc44' :
                        '#ff6666'

                const ctxTok =
                  e.kind === 'context' && typeof e?.data?._meta?.contextTokensEstimated === 'number'
                    ? Number(e.data._meta.contextTokensEstimated)
                    : null

                return (
                  <div key={e.id} style={{ background: '#0a1520', border: `1px solid ${headerColor}55`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#081018', borderBottom: `1px solid ${headerColor}33` }}>
                      <div style={{ color: '#c3e7ff', fontSize: 12, fontWeight: 'bold' }}>
                        <span style={{ color: headerColor }}>{e.kind.toUpperCase()}</span>
                        {ctxTok == null ? null : <span style={{ color: '#6090a0' }}> (~{ctxTok.toLocaleString()} tok)</span>}
                        <span style={{ color: '#6090a0' }}> · {time}</span>
                      </div>
                      <div style={{ color: '#2f4d60', fontSize: 11 }}>#{e.id}</div>
                    </div>

                    <div style={{ padding: 10 }}>
                      {e.kind === 'context' ? (
                        <>
                          {renderContextSummary(e.data)}
                          <details style={{ marginTop: 10 }}>
                            <summary style={{ cursor: 'pointer', color: '#8ab6d6', fontSize: 12 }}>Raw context JSON</summary>
                            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: '#c3e7ff', fontSize: 11 }}>{formatJson(e.data)}</pre>
                          </details>
                        </>
                      ) : e.kind === 'plan' ? (
                        <>
                          {renderPlan(e.data)}
                          <details style={{ marginTop: 10 }}>
                            <summary style={{ cursor: 'pointer', color: '#8ab6d6', fontSize: 12 }}>Raw plan JSON</summary>
                            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: '#c3e7ff', fontSize: 11 }}>{formatJson(e.data)}</pre>
                          </details>
                        </>
                      ) : e.kind === 'decision' ? (
                        <pre style={{ whiteSpace: 'pre-wrap', color: '#c3e7ff', fontSize: 12, margin: 0 }}>
                          {formatDecision(String(e.data || ''))}
                        </pre>
                      ) : e.kind === 'actions' ? (
                        <>
                          {Array.isArray(e.data) && e.data.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {e.data.slice(0, 50).map((a: any, idx: number) => (
                                <div key={idx} style={{ border: '1px solid #12384f', borderRadius: 8, padding: 8 }}>
                                  <div style={{ color: '#88cc44', fontWeight: 'bold', fontSize: 12 }}>{String(a?.type || 'action')}</div>
                                  <div style={{ color: '#c3e7ff', fontSize: 12, marginTop: 4 }}>{formatActionLine(a)}</div>
                                  <details style={{ marginTop: 6 }}>
                                    <summary style={{ cursor: 'pointer', color: '#8ab6d6', fontSize: 11 }}>Raw</summary>
                                    <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: '#c3e7ff', fontSize: 11 }}>{formatJson(a)}</pre>
                                  </details>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: '#6090a0', fontSize: 12 }}>No actions taken.</div>
                          )}
                        </>
                      ) : (
                        <div style={{ color: '#ff8888', fontSize: 12, whiteSpace: 'pre-wrap' }}>{String(e.data || '')}</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}

            {messages.length > 0 && (
              <div style={{ marginTop: 8, borderTop: '1px solid #12384f', paddingTop: 10 }}>
                <div style={{ color: '#6090a0', fontSize: 11, marginBottom: 8 }}>Manual messages</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: 'min(820px, 92%)',
                        background: m.role === 'user' ? '#102535' : m.role === 'system' ? '#11131a' : '#0a1520',
                        border: m.role === 'user' ? '1px solid #3fb6ff' : m.role === 'system' ? '1px solid #aa88ff' : '1px solid #12384f',
                        borderRadius: 8,
                        padding: 10,
                        color: '#c3e7ff',
                        whiteSpace: 'pre-wrap',
                        fontSize: 12,
                      }}
                    >
                      {m.content}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {live && (live.status === 'running' || live.status === 'error') && (
              <div style={{ background: '#0a1520', border: '1px solid #3fb6ff55', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#081018', borderBottom: '1px solid #3fb6ff33' }}>
                  <div style={{ color: '#c3e7ff', fontSize: 12, fontWeight: 'bold' }}>
                    <span style={{ color: '#3fb6ff' }}>DECISION (live)</span>
                    <span style={{ color: '#6090a0' }}> · pass {live.pass}</span>
                  </div>
                  <div style={{ color: '#2f4d60', fontSize: 11 }}>stream</div>
                </div>
                <div style={{ padding: 10 }}>
                  {live.status === 'error' ? (
                    <div style={{ color: '#ff8888', fontSize: 12, whiteSpace: 'pre-wrap' }}>{live.error || 'live_error'}</div>
                  ) : live.text ? (
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#c3e7ff', fontSize: 12, margin: 0 }}>{formatDecision(live.text)}</pre>
                  ) : (
                    <div style={{ color: '#6090a0', fontSize: 12 }}>Waiting for first tokens…</div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        {lastError && (
          <div style={{ padding: 10, borderRadius: 6, border: '1px solid #ff4444', background: '#1a0f12', color: '#ff8888' }}>
            {lastError}
          </div>
        )}

        {lastActions && (
          <div style={{ padding: 10, borderRadius: 6, border: '1px solid #184b6a', background: '#0a1520', color: '#c3e7ff' }}>
            <div style={{ color: '#8ab6d6', marginBottom: 6 }}>Applied actions ({lastActions.length})</div>
            {lastActions.length === 0 ? (
              <div style={{ color: '#6090a0', fontSize: 12 }}>none</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, fontSize: 12 }}>
                {lastActions.slice(0, 50).map((a, idx) => (
                  <div key={idx} style={{ border: '1px solid #12384f', borderRadius: 6, padding: 8 }}>
                    <div style={{ color: '#88cc44', fontWeight: 'bold' }}>{a.type}</div>
                    <div style={{ color: '#8ab6d6', marginTop: 2, whiteSpace: 'pre-wrap' }}>{JSON.stringify(a)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Optional manual instruction (one-shot), e.g. “Sell excess energy cells and buy ore if cheap”."
              style={{
                flex: 1,
                minHeight: 68,
                resize: 'vertical',
                padding: 10,
                background: '#0a1520',
                border: '1px solid #12384f',
                borderRadius: 6,
                color: '#c3e7ff',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                disabled={busy || !prompt.trim()}
                onClick={send}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #3fb6ff',
                  background: busy ? '#0a1520' : '#102535',
                  color: busy ? '#6090a0' : '#c3e7ff',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  borderRadius: 6,
                  fontWeight: 'bold',
                }}
              >
                {busy ? 'Working…' : 'Send'}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8, color: '#6090a0', fontSize: 11 }}>
            Autopilot uses OpenRouter tools; log shows context + decisions + actions.
          </div>
        </div>
      </div>
    </div>
  )
}
