import React from 'react';
import { useGameStore, type GameState, type Station } from '../store/gameStore';
import { getStationPriceMap } from '../services/stationPricing';

export const StationInfo: React.FC = () => {
    const open = useGameStore((state: GameState) => state.stationInfoOpen);
    const target = useGameStore((state: GameState) => state.selectedTarget);
    const stations = useGameStore((state: GameState) => state.stations);
    const wares = useGameStore((state: GameState) => state.wares);
    const recipes = useGameStore((state: GameState) => state.recipes);
    const setOpen = useGameStore((state: GameState) => state.setStationInfoOpen);

    if (!open || !target || target.type !== 'station') return null;

    // Try to find detailed station info
    const stationData = stations.find((s: Station) => s.name === target.name);
    const recipe = stationData ? recipes.find((r) => r.id === stationData.recipeId) : undefined;
    const priceMap = stationData ? getStationPriceMap(stationData, recipe, wares) : {};
    const wareNameMap = new Map(wares.map((w) => [w.id, w.name]));
    const warePriceMap = new Map(wares.map((w) => [w.id, w.basePrice]));
    const combinedWares = stationData
        ? (recipe
            ? Array.from(new Set<string>([
                ...Object.keys(stationData.inventory),
                ...recipe.inputs.map((i) => i.wareId),
                recipe.productId,
            ]))
            : Object.keys(stationData.inventory))
        : [];
    const rows = combinedWares.map((wid) => {
        const qty = stationData?.inventory[wid] || 0;
        const price = priceMap[wid] ?? warePriceMap.get(wid);
        const mode = recipe
            ? (recipe.productId === wid ? 'sell' : recipe.inputs.some((i) => i.wareId === wid) ? 'buy' : 'store')
            : 'store';
        return { wid, qty, price, mode };
    });

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            backgroundColor: 'rgba(0, 10, 20, 0.95)',
            border: '1px solid #00aaff',
            color: '#00aaff',
            fontFamily: 'monospace',
            padding: '2px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            boxShadow: '0 0 15px rgba(0, 170, 255, 0.3)'
        }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(90deg, rgba(0, 170, 255, 0.2) 0%, rgba(0,0,0,0) 100%)',
                padding: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #004466'
            }}>
                <h2 style={{ margin: 0, fontSize: '18px', textTransform: 'uppercase' }}>{target.name}</h2>
                <button
                    onClick={() => setOpen(false)}
                    style={{
                        background: 'none',
                        border: '1px solid #004466',
                        color: '#00aaff',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '14px'
                    }}
                >
                    X
                </button>
            </div>

            {/* Content */}
            <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ color: '#006699' }}>SECTOR</div>
                    <div>{useGameStore.getState().currentSectorId}</div>

                    <div style={{ color: '#006699' }}>DISTANCE</div>
                    <div>{(Math.sqrt(
                        Math.pow(target.position[0] - useGameStore.getState().position.x, 2) +
                        Math.pow(target.position[1] - useGameStore.getState().position.y, 2) +
                        Math.pow(target.position[2] - useGameStore.getState().position.z, 2)
                    ) / 1000).toFixed(2)} km</div>

                    <div style={{ color: '#006699' }}>RELATION</div>
                    <div style={{ color: '#00ff00' }}>FRIENDLY</div>
                </div>

                {stationData ? (
                    <div>
                        {/* Demographics Area */}
                        {(stationData.recipeId && (stationData.recipeId.includes('planetary_hub') || stationData.recipeId.includes('orbital_habitat'))) && (
                            <div style={{ marginBottom: '15px' }}>
                                <h3 style={{ fontSize: '14px', borderBottom: '1px solid #004466', paddingBottom: '5px', marginBottom: '10px' }}>POPULATION</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div style={{ color: '#006699' }}>TYPE</div>
                                    <div>{stationData.recipeId.includes('planetary_hub') ? 'PLANETARY SURFACE' : 'ORBITAL HABITAT'}</div>

                                    <div style={{ color: '#006699' }}>RESIDENTS</div>
                                    <div>{stationData.recipeId.includes('planetary_hub') ? '~15,000,000' : '~5,000'}</div>

                                    <div style={{ color: '#006699' }}>TRANSIENT</div>
                                    <div>{stationData.inventory && stationData.inventory['passengers'] ? stationData.inventory['passengers'] : 0}</div>
                                </div>
                            </div>
                        )}

                        <h3 style={{ fontSize: '14px', borderBottom: '1px solid #004466', paddingBottom: '5px', marginBottom: '10px' }}>PRODUCTION INFO</h3>
                        {/* If we had recipe info, we could show it here. For now, show inventory if available */}
                        {rows.length > 0 ? (
                            <table style={{ width: '100%', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ color: '#006699', textAlign: 'left' }}>
                                        <th>WARE</th>
                                        <th style={{ textAlign: 'right' }}>STOCK</th>
                                        <th style={{ textAlign: 'right' }}>PRICE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.wid}>
                                            <td>{wareNameMap.get(row.wid) || row.wid}</td>
                                            <td style={{ textAlign: 'right' }}>{Math.round(row.qty).toString()}</td>
                                            <td style={{ textAlign: 'right', color: row.mode === 'buy' ? '#00ffcc' : '#88cc44' }}>
                                                {row.price ? (
                                                    <>
                                                        {row.mode === 'buy' ? 'Bid ' : 'Ask '}
                                                        {Math.round(row.price)} Cr
                                                    </>
                                                ) : 'n/a'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ fontStyle: 'italic', color: '#006699' }}>No production data available</div>
                        )}

                        {stationData.productionProgress !== undefined && (
                            <div style={{ marginTop: '15px' }}>
                                <div style={{ color: '#006699', fontSize: '12px', marginBottom: '5px' }}>CYCLE PROGRESS</div>
                                <div style={{
                                    width: '100%',
                                    height: '10px',
                                    backgroundColor: '#002233',
                                    border: '1px solid #004466',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        width: `${Math.min(100, Math.max(0, stationData.productionProgress * 100))}%`,
                                        height: '100%',
                                        backgroundColor: '#00aaff',
                                        transition: 'width 0.5s linear'
                                    }} />
                                </div>
                                <div style={{ textAlign: 'right', fontSize: '11px', color: '#00aaff', marginTop: '2px' }}>
                                    {(stationData.productionProgress * 100).toFixed(0)}%
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed #004466', color: '#006699' }}>
                        Scanning station details...
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                padding: '10px',
                borderTop: '1px solid #004466',
                textAlign: 'right',
                fontSize: '12px',
                color: '#006699'
            }}>
                PRESS 'I' TO CLOSE
            </div>
        </div>
    );
};
