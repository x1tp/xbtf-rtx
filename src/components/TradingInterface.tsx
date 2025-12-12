import React from 'react';
import { useGameStore } from '../store/gameStore';
import { SHIP_CATALOG, type ShipType } from '../config/ship_catalog';


export const TradingInterface: React.FC = () => {
    const isDocked = useGameStore((state) => state.isDocked);
    const dockedStationId = useGameStore((state) => state.dockedStationId);
    const setDocked = useGameStore((state) => state.setDocked);
    const stations = useGameStore((state) => state.stations);
    const wares = useGameStore((state) => state.wares);
    const playerCredits = useGameStore((state) => state.player.credits);
    // const addNotification = useGameStore((state) => state.addNotification); 

    const [selectedShipId, setSelectedShipId] = React.useState<string | null>(null);

    // Actions (To be implemented)
    const buyShip = (shipWareId: string) => {
        // Optimistic UI or just send command
        // We'll dispatch a command via fetch for now or use a store action if connected
        fetch('/__universe/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: 'buy-ship',
                stationId: dockedStationId,
                wareId: shipWareId
            })
        }).catch(err => console.error("Buy ship failed", err));
    };

    if (!isDocked || !dockedStationId) return null;

    const station = stations.find(s => s.id === dockedStationId);
    if (!station) return null;

    // Categorize inventory
    const wareItems: { id: string; name: string; qty: number; price: number }[] = [];
    const shipItems: { id: string; name: string; qty: number; price: number; catalogId: string }[] = [];

    const wareMap = new Map(wares.map(w => [w.id, w]));

    Object.entries(station.inventory).forEach(([wid, qty]) => {
        // Allow ships to be listed even if out of stock, so players know what is sold here
        if (qty <= 0 && !wid.startsWith('ship_')) return;
        const w = wareMap.get(wid);
        if (!w) return;

        const price = w.basePrice; // Simplified client-side price looking (should ideally come from price map)

        if (wid.startsWith('ship_')) {
            const catalogId = wid.replace('ship_', '');
            shipItems.push({ id: wid, name: w.name, qty, price, catalogId });
        } else {
            wareItems.push({ id: wid, name: w.name, qty, price });
        }
    });

    const selectedShipData = selectedShipId ? SHIP_CATALOG[selectedShipId as ShipType] : null;

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '800px', // Slightly wider for details
            height: '600px',
            backgroundColor: 'rgba(0, 20, 0, 0.95)',
            border: '2px solid #00ff00',
            color: '#00ff00',
            fontFamily: 'monospace',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            zIndex: 200, // Above HUD
            boxShadow: '0 0 20px rgba(0, 255, 0, 0.2)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #004400', paddingBottom: '10px' }}>
                <div>
                    <h2 style={{ margin: 0 }}>{station.name.toUpperCase()}</h2>
                    <div style={{ fontSize: '0.9em', color: '#00cc00' }}>CREDITS: {playerCredits.toLocaleString()} Cr</div>
                </div>
                <button
                    onClick={() => setDocked(false)}
                    style={{
                        background: '#002200',
                        border: '1px solid #00ff00',
                        color: '#00ff00',
                        cursor: 'pointer',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    UNDOCK
                </button>
            </div>

            <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
                {/* Left Panel: Inventory */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
                    {/* Shipyard Section */}
                    {shipItems.length > 0 && (
                        <div style={{ marginBottom: '20px', border: '1px solid #004400', padding: '10px', background: 'rgba(0, 40, 0, 0.3)' }}>
                            <h3 style={{ marginTop: 0, borderBottom: '1px solid #004400', color: '#88ff88' }}>SHIPYARD</h3>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ color: '#008800', fontSize: '0.8em' }}>
                                        <th style={{ padding: '5px' }}>SHIP</th>
                                        <th style={{ padding: '5px', textAlign: 'right' }}>STOCK</th>
                                        <th style={{ padding: '5px', textAlign: 'right' }}>PRICE</th>
                                        <th style={{ padding: '5px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shipItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            style={{
                                                borderBottom: '1px solid #002200',
                                                cursor: 'pointer',
                                                background: selectedShipId === item.catalogId ? 'rgba(0, 255, 0, 0.2)' : 'transparent'
                                            }}
                                            onClick={() => setSelectedShipId(item.catalogId)}
                                        >
                                            <td style={{ padding: '5px', color: '#ccffcc', fontWeight: 'bold' }}>{item.name}</td>
                                            <td style={{ padding: '5px', textAlign: 'right' }}>{item.qty}</td>
                                            <td style={{ padding: '5px', textAlign: 'right' }}>{item.price.toLocaleString()} Cr</td>
                                            <td style={{ padding: '5px', textAlign: 'right' }}>
                                                <button
                                                    disabled={item.qty <= 0 || playerCredits < item.price}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        buyShip(item.id);
                                                    }}
                                                    style={{
                                                        background: (item.qty > 0 && playerCredits >= item.price) ? '#004400' : '#220000',
                                                        border: '1px solid #00ff00',
                                                        color: '#00ff00',
                                                        cursor: (item.qty > 0 && playerCredits >= item.price) ? 'pointer' : 'not-allowed',
                                                        opacity: (item.qty > 0 && playerCredits >= item.price) ? 1 : 0.5,
                                                        fontSize: '0.8em',
                                                        padding: '2px 8px'
                                                    }}
                                                >
                                                    BUY
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Commodities Section */}
                    {wareItems.length > 0 && (
                        <div>
                            <h3 style={{ marginTop: 0, borderBottom: '1px solid #004400', color: '#88ff88' }}>COMMODITIES</h3>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ color: '#008800', fontSize: '0.8em' }}>
                                        <th style={{ padding: '5px' }}>ITEM</th>
                                        <th style={{ padding: '5px', textAlign: 'right' }}>STOCK</th>
                                        <th style={{ padding: '5px', textAlign: 'right' }}>AVG PRICE</th>
                                        <th style={{ padding: '5px', textAlign: 'right' }}>TRADE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wareItems.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #002200' }}>
                                            <td style={{ padding: '5px' }}>{item.name}</td>
                                            <td style={{ padding: '5px', textAlign: 'right' }}>{item.qty.toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', padding: '5px' }}>{item.price.toLocaleString()} Cr</td>
                                            <td style={{ padding: '5px', textAlign: 'right', fontSize: '0.8em', color: '#666' }}>
                                                (Trade WIP)
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right Panel: DETAILS */}
                {selectedShipData && (
                    <div style={{
                        width: '280px',
                        borderLeft: '1px solid #004400',
                        paddingLeft: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}>
                        <h3 style={{ marginTop: 0, color: '#ccffcc', borderBottom: '1px solid #00ff00', paddingBottom: '5px' }}>
                            {selectedShipData.name.toUpperCase()}
                        </h3>

                        {/* Placeholder for 3D preview image/canvas could go here */}
                        <div style={{
                            width: '100%',
                            height: '150px',
                            background: 'rgba(0,20,0,0.5)',
                            border: '1px solid #004400',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#004400',
                            fontSize: '0.8em'
                        }}>
                            [NO PREVIEW]
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9em' }}>
                            <div style={{ color: '#008800' }}>CLASS:</div>
                            <div style={{ textAlign: 'right' }}>UNKNOWN</div>

                            <div style={{ color: '#008800' }}>SPEED:</div>
                            <div style={{ textAlign: 'right' }}>{(selectedShipData.speed * 100).toFixed(0)} m/s</div>

                            <div style={{ color: '#008800' }}>CARGO:</div>
                            <div style={{ textAlign: 'right' }}>{selectedShipData.capacity}</div>

                            <div style={{ color: '#008800' }}>HULL:</div>
                            <div style={{ textAlign: 'right' }}>-</div>

                            <div style={{ color: '#008800' }}>SHIELD:</div>
                            <div style={{ textAlign: 'right' }}>-</div>

                            <div style={{ color: '#008800' }}>PRICE:</div>
                            <div style={{ textAlign: 'right', color: '#ffff00' }}>{selectedShipData.cost.toLocaleString()} Cr</div>
                        </div>

                        <div style={{ marginTop: 'auto', borderTop: '1px solid #004400', paddingTop: '10px', fontSize: '0.8em', color: '#00aa00' }}>
                            <p>{selectedShipData.description}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8em', color: '#004400' }}>
                "Profitssss..."
            </div>
        </div>
    );
};
