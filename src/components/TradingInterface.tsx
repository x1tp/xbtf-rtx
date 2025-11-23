import React from 'react';
import { useGameStore } from '../store/gameStore';

export const TradingInterface: React.FC = () => {
    const isDocked = useGameStore((state) => state.isDocked);
    const setDocked = useGameStore((state) => state.setDocked);

    if (!isDocked) return null;

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '400px',
            backgroundColor: 'rgba(0, 20, 0, 0.9)',
            border: '2px solid #00ff00',
            color: '#00ff00',
            fontFamily: 'monospace',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>TELADI TRADING STATION</h2>
                <button
                    onClick={() => setDocked(false)}
                    style={{
                        background: 'none',
                        border: '1px solid #00ff00',
                        color: '#00ff00',
                        cursor: 'pointer',
                        padding: '5px 10px'
                    }}
                >
                    UNDOCK
                </button>
            </div>

            <div style={{ flex: 1, border: '1px solid #004400', padding: '10px' }}>
                <h3>COMMODITIES</h3>
                <table style={{ width: '100%', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th>ITEM</th>
                            <th>STOCK</th>
                            <th>PRICE</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Energy Cells</td>
                            <td>12,405</td>
                            <td>16 Cr</td>
                        </tr>
                        <tr>
                            <td>Nostrop Oil</td>
                            <td>450</td>
                            <td>72 Cr</td>
                        </tr>
                        <tr>
                            <td>Teladianium</td>
                            <td>890</td>
                            <td>150 Cr</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.8em', color: '#00aa00' }}>
                "Profitssss..."
            </div>
        </div>
    );
};
