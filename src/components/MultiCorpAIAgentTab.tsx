import { useMemo } from 'react'
import type { Corporation, NPCFleet } from '../types/simulation'
import type { Station } from '../store/gameStore'
import { CorpAIAgentTab } from './CorpAIAgentTab'

export function MultiCorpAIAgentTab(props: {
  corporations: Corporation[]
  stations: Station[]
  fleets: NPCFleet[]
}) {
  const { corporations, stations, fleets } = props
  const corpId = 'teladi_shieldworks'
  const corp = useMemo(() => corporations.find((c) => c.id === corpId) || null, [corporations])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ color: '#8ab6d6', fontSize: 12 }}>Corp</div>
        <div style={{ color: '#c3e7ff', fontSize: 12 }}>
          {corp ? `${corp.name} (${corp.id})` : `Missing corporation: ${corpId} (start a fresh game or reload the devserver)`}
        </div>
        <div style={{ color: '#8ab6d6', fontSize: 12 }}>Model</div>
        <div style={{ color: '#c3e7ff', fontSize: 12 }}>From server env (`OPENROUTER_MODEL_SHIELDWORKS` / `OPENROUTER_MODEL_2` / `OPENROUTER_MODEL`).</div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <CorpAIAgentTab
          corpId={corpId}
          corporations={corporations}
          stations={stations}
          fleets={fleets}
          title="Shieldworks AI"
        />
      </div>
    </div>
  )
}
