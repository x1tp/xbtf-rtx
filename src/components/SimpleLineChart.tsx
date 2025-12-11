import React, { useMemo } from 'react';

interface ChartDataPoint {
    label: string;
    value: number;
}

interface SimpleLineChartProps {
    data: ChartDataPoint[];
    width?: number;
    height?: number;
    color?: string;
    title?: string;
    yLabel?: string;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
    data,
    width = 600,
    height = 300,
    color = '#3fb6ff',
    title,
    yLabel
}) => {
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    const points = useMemo(() => {
        if (data.length === 0) return '';

        const values = data.map(d => d.value);
        let min = Math.min(...values);
        let max = Math.max(...values);

        if (max === min) {
            max += 1;
            min -= 1;
        }

        // Add 10% buffering
        const range = max - min;
        const paddedMin = min - range * 0.05;
        const paddedMax = max + range * 0.05;
        const paddedRange = paddedMax - paddedMin;

        return data.map((d, i) => {
            const x = (i / (data.length - 1 || 1)) * graphWidth + padding;
            const y = height - padding - ((d.value - paddedMin) / paddedRange) * graphHeight;
            return `${x},${y}`;
        }).join(' ');
    }, [data, width, height, graphWidth, graphHeight, padding]);

    if (data.length === 0) {
        return (
            <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #184b6a', borderRadius: 6, background: '#0a1520', color: '#6090a0' }}>
                No Data
            </div>
        );
    }

    // Calculate generic axis labels
    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {title && <div style={{ marginBottom: 8, color: '#c3e7ff', fontWeight: 'bold' }}>{title}</div>}
            <svg width={width} height={height} style={{ background: '#0a1520', border: '1px solid #184b6a', borderRadius: 6 }}>
                {/* Grid lines (simple) */}
                <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#184b6a" strokeWidth="1" />
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#184b6a" strokeWidth="1" />

                {/* Max/Min Y Labels */}
                <text x={padding - 5} y={padding + 5} fill="#6090a0" fontSize="10" textAnchor="end">{Math.round(maxVal)}</text>
                <text x={padding - 5} y={height - padding} fill="#6090a0" fontSize="10" textAnchor="end">{Math.round(minVal)}</text>
                <text x={padding - 5} y={height / 2} fill="#6090a0" fontSize="10" textAnchor="end" transform={`rotate(-90, ${padding - 15}, ${height / 2})`}>{yLabel}</text>

                {/* The Line */}
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    points={points}
                />

                {/* X Axis Labels (First and Last) */}
                <text x={padding} y={height - padding + 15} fill="#6090a0" fontSize="10" textAnchor="middle">{data[0].label}</text>
                <text x={width - padding} y={height - padding + 15} fill="#6090a0" fontSize="10" textAnchor="middle">{data[data.length - 1].label}</text>
            </svg>
        </div>
    );
};
