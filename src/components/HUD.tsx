import React from 'react';
import { useGameStore } from '../store/gameStore';

export const HUD: React.FC = () => {
    const speed = useGameStore((state) => state.speed);
    const throttle = useGameStore((state) => state.throttle);
    const maxSpeed = useGameStore((state) => state.maxSpeed);
    const timeScale = useGameStore((state) => state.timeScale);

    const forwardThrottle = throttle > 0 ? throttle * 100 : 0;
    const reverseThrottle = throttle < 0 ? Math.abs(throttle) * 100 : 0;

    return (
        <div style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            color: '#00ff00',
            fontFamily: 'monospace',
            fontSize: '16px',
            pointerEvents: 'none',
            textShadow: '0 0 5px #00ff00'
        }}>
            <div style={{ marginBottom: '10px' }}>
                SPEED: {speed.toFixed(1)} m/s
            </div>
            <div style={{
                width: '200px',
                height: '20px',
                border: '1px solid #00ff00',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: `${Math.min(1, speed / maxSpeed) * 100}%`,
                    height: '100%',
                    backgroundColor: '#00ff00',
                    opacity: 0.5
                }} />
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    width: `${forwardThrottle}%`,
                    height: '100%',
                    backgroundColor: '#00ff00',
                    opacity: 0.2,
                    borderRight: '2px solid white'
                }} />
                <div style={{
                    position: 'absolute',
                    top: 0,
                    right: '50%',
                    width: `${reverseThrottle}%`,
                    height: '100%',
                    backgroundColor: '#ff6666',
                    opacity: 0.25,
                    borderLeft: '2px solid #ff6666'
                }} />
            </div>
            <div>THROTTLE: {(throttle * 100).toFixed(0)}%</div>
            {timeScale > 1.0 && (
                <div style={{ marginTop: '10px', color: '#ffff00', fontWeight: 'bold', fontSize: '20px', animation: 'blink 1s infinite' }}>
                    SETA {timeScale.toFixed(0)}x
                </div>
            )}
        </div>
    );
};
