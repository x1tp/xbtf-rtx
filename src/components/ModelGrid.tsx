
import { useState, useEffect } from 'react';
import { ModelCard } from './ModelCard';

interface ModelGridProps {
    onSelect: (modelPath: string) => void;
    currentModel?: string;
    page: number;
    onPageChange: (page: number) => void;
}

export function ModelGrid({ onSelect, currentModel, page, onPageChange }: ModelGridProps) {
    const [models, setModels] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const pageSize = 12;

    useEffect(() => {
        fetch('/models.json')
            .then(res => res.json())
            .then(data => {
                setModels(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load models:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div style={{ color: '#8ab6d6', padding: 20 }}>Loading models...</div>;
    }

    const totalPages = Math.ceil(models.length / pageSize);
    const start = page * pageSize;
    const visibleModels = models.slice(start, start + pageSize);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
                width: '100%'
            }}>
                {visibleModels.map((path) => (
                    <ModelCard
                        key={path}
                        modelPath={path}
                        selected={path === currentModel}
                        onClick={() => onSelect(path)}
                    />
                ))}
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <button
                        onClick={() => onPageChange(Math.max(0, page - 1))}
                        disabled={page === 0}
                        style={{
                            padding: '6px 12px',
                            background: '#0f2230',
                            border: '1px solid #3fb6ff',
                            color: '#c3e7ff',
                            opacity: page === 0 ? 0.5 : 1,
                            cursor: page === 0 ? 'default' : 'pointer',
                            borderRadius: 4
                        }}
                    >
                        Prev
                    </button>
                    <span style={{ color: '#8ab6d6', fontFamily: 'monospace' }}>
                        Page {page + 1} of {totalPages}
                    </span>
                    <button
                        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                        disabled={page === totalPages - 1}
                        style={{
                            padding: '6px 12px',
                            background: '#0f2230',
                            border: '1px solid #3fb6ff',
                            color: '#c3e7ff',
                            opacity: page === totalPages - 1 ? 0.5 : 1,
                            cursor: page === totalPages - 1 ? 'default' : 'pointer',
                            borderRadius: 4
                        }}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
