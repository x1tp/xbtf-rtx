import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrthographicCamera, MapControls } from '@react-three/drei';
import { NebulaPlume } from '../components/NebulaPlume';
import { getAllPresets, type PlumeConfig } from '../config/plumes';

export const PlumeEditor: React.FC = () => {
  // Load existing presets (including custom ones from localStorage)
  const [allPresets, setAllPresets] = useState(getAllPresets());
  const presetNames = Object.keys(allPresets);
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');
  const [presetName, setPresetName] = useState<string>('');
  const [isNewPreset, setIsNewPreset] = useState(false);
  
  // Plume parameters
  const std = allPresets['standard'] || {} as Partial<PlumeConfig>;
  const [length, setLength] = useState(std.length ?? 2.5);
  const [radius, setRadius] = useState(std.radius ?? 0.5);
  const [color, setColor] = useState(std.color ?? '#76baff');
  const [throttle, setThrottle] = useState(1.0);
  
  // Advanced particle controls
  const [particleCount, setParticleCount] = useState(10); // Particles per emission
  const [emissionRate, setEmissionRate] = useState(0.075); // Time between emissions
  const [particleLife, setParticleLife] = useState(0.75); // How long particles live
  const [startScale, setStartScale] = useState(2.0); // Initial particle size
  const [endScale, setEndScale] = useState(0.3); // Final particle size
  const [startAlpha, setStartAlpha] = useState(0.8); // Initial opacity
  const [velocity, setVelocity] = useState(15); // Particle speed multiplier
  const [spread, setSpread] = useState(12); // Cone spread angle
  const [textureSoftness, setTextureSoftness] = useState(0.5); // Gradient softness (0=hard, 1=soft)

  // Reload presets when component mounts or storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setAllPresets(getAllPresets());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const loadPreset = (name: string) => {
    if (!allPresets[name]) return;
    const preset = allPresets[name];
    setLength(preset.length ?? 2.5);
    setRadius(preset.radius ?? 0.5);
    setColor(preset.color ?? '#76baff');
    setParticleCount(preset.particleCount ?? 10);
    setEmissionRate(preset.emissionRate ?? 0.075);
    setParticleLife(preset.particleLife ?? 0.75);
    setStartScale(preset.startScale ?? 2.0);
    setEndScale(preset.endScale ?? 0.3);
    setStartAlpha(preset.startAlpha ?? 0.8);
    setVelocity(preset.velocity ?? 15);
    setSpread(preset.spread ?? 12);
    setTextureSoftness(preset.textureSoftness ?? 0.5);
    setPresetName(name);
    setSelectedPreset(name);
    setIsNewPreset(false);
  };

  const savePreset = () => {
    const name = isNewPreset ? presetName : selectedPreset;
    if (!name) {
      alert('Please enter a preset name');
      return;
    }

    const config: Partial<PlumeConfig> = {
      length,
      radius,
      color,
      particleCount,
      emissionRate,
      particleLife,
      startScale,
      endScale,
      startAlpha,
      velocity,
      spread,
      textureSoftness,
    };

    // Save to localStorage
    const existingPresets = JSON.parse(localStorage.getItem('custom_plume_presets') || '{}');
    existingPresets[name] = config;
    localStorage.setItem('custom_plume_presets', JSON.stringify(existingPresets));

    // Reload presets to show the new one
    setAllPresets(getAllPresets());

    alert(`Preset "${name}" saved and ready to use!`);
    setIsNewPreset(false);
    setSelectedPreset(name);
  };

  const deletePreset = () => {
    if (!selectedPreset) return;
    if (!confirm(`Delete preset "${selectedPreset}"?`)) return;

    const existingPresets = JSON.parse(localStorage.getItem('custom_plume_presets') || '{}');
    delete existingPresets[selectedPreset];
    localStorage.setItem('custom_plume_presets', JSON.stringify(existingPresets));

    // Reload presets
    setAllPresets(getAllPresets());

    alert(`Preset "${selectedPreset}" deleted!`);
    setSelectedPreset('standard');
    loadPreset('standard');
  };

  const exportConfig = () => {
    const config = {
      length,
      radius,
      color,
      particleCount,
      emissionRate,
      particleLife,
      startScale,
      endScale,
      startAlpha,
      velocity,
      spread,
      textureSoftness,
    };
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json);
    alert('Configuration copied to clipboard!');
  };

  const createNewPreset = () => {
    setIsNewPreset(true);
    setPresetName('');
    setLength(2.5);
    setRadius(0.5);
    setColor('#76baff');
    setThrottle(1.0);
    setParticleCount(10);
    setEmissionRate(0.075);
    setParticleLife(0.75);
    setStartScale(2.0);
    setEndScale(0.3);
    setStartAlpha(0.8);
    setVelocity(15);
    setSpread(12);
    setTextureSoftness(0.5);
  };

  const isCustomPreset = () => {
    const customPresets = JSON.parse(localStorage.getItem('custom_plume_presets') || '{}');
    return selectedPreset in customPresets;
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0b1016', color: '#c3e7ff', fontFamily: 'monospace', display: 'flex' }}>
      {/* Controls Panel */}
      <div style={{ width: 400, padding: 20, background: '#0a0e14', borderRight: '1px solid #1a2530', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>Plume Editor</h2>
        
        <button 
          onClick={() => window.location.assign('/admin')} 
          style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', marginBottom: 20, width: '100%' }}
        >
          ← Back to Admin
        </button>

        {/* Preset Selection */}
        <div style={{ marginBottom: 20, padding: 12, background: '#0f2230', border: '1px solid #1a2530', borderRadius: 4 }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Preset Management</h3>
          
          {!isNewPreset ? (
            <>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <div style={{ marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>Load Preset</div>
                <select 
                  value={selectedPreset} 
                  onChange={(e) => loadPreset(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: '#0a0e14', border: '1px solid #3fb6ff', color: '#c3e7ff' }}
                >
                  {presetNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button 
                  onClick={createNewPreset}
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0a0e14', color: '#c3e7ff', fontSize: 12 }}
                >
                  New Preset
                </button>
                {isCustomPreset() && (
                  <button 
                    onClick={deletePreset}
                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #ff5555', background: '#0a0e14', color: '#ff5555', fontSize: 12 }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{ marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>New Preset Name</div>
                <input 
                  value={presetName} 
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., my_custom_plume"
                  style={{ width: '100%', padding: '6px 10px', background: '#0a0e14', border: '1px solid #3fb6ff', color: '#c3e7ff' }}
                />
              </label>
              <button 
                onClick={() => setIsNewPreset(false)}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #666', background: '#0a0e14', color: '#c3e7ff', fontSize: 12 }}
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Plume Parameters */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Plume Parameters</h3>
          
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Length</span>
              <span>{length.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="10" 
              step="0.1" 
              value={length} 
              onChange={(e) => setLength(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Radius</span>
              <span>{radius.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="3" 
              step="0.05" 
              value={radius} 
              onChange={(e) => setRadius(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>Color</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 60, height: 32, border: '1px solid #3fb6ff', background: '#0a0e14', cursor: 'pointer' }}
              />
              <input 
                type="text" 
                value={color} 
                onChange={(e) => setColor(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', background: '#0a0e14', border: '1px solid #3fb6ff', color: '#c3e7ff' }}
              />
            </div>
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Throttle (Preview)</span>
              <span>{throttle.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={throttle} 
              onChange={(e) => setThrottle(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>
        </div>

        {/* Advanced Particle Controls */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Advanced Particle Settings</h3>
          
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Particle Count</span>
              <span>{particleCount}</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="100" 
              step="1" 
              value={particleCount} 
              onChange={(e) => setParticleCount(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Emission Rate</span>
              <span>{emissionRate.toFixed(3)}s</span>
            </div>
            <input 
              type="range" 
              min="0.01" 
              max="0.2" 
              step="0.005" 
              value={emissionRate} 
              onChange={(e) => setEmissionRate(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Particle Life</span>
              <span>{particleLife.toFixed(2)}s</span>
            </div>
            <input 
              type="range" 
              min="0.2" 
              max="2" 
              step="0.05" 
              value={particleLife} 
              onChange={(e) => setParticleLife(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Start Scale</span>
              <span>{startScale.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="5" 
              step="0.1" 
              value={startScale} 
              onChange={(e) => setStartScale(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>End Scale</span>
              <span>{endScale.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0.05" 
              max="2" 
              step="0.05" 
              value={endScale} 
              onChange={(e) => setEndScale(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Start Alpha</span>
              <span>{startAlpha.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.05" 
              value={startAlpha} 
              onChange={(e) => setStartAlpha(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Velocity</span>
              <span>{velocity.toFixed(1)}</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="40" 
              step="0.5" 
              value={velocity} 
              onChange={(e) => setVelocity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Spread Angle</span>
              <span>{spread.toFixed(1)}°</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="45" 
              step="1" 
              value={spread} 
              onChange={(e) => setSpread(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#8ab6d6' }}>
              <span>Texture Softness</span>
              <span>{textureSoftness.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={textureSoftness} 
              onChange={(e) => setTextureSoftness(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button 
            onClick={savePreset}
            style={{ padding: '10px 16px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', fontWeight: 'bold' }}
          >
            {isNewPreset ? 'Create Preset' : 'Save Changes'}
          </button>
          
          <button 
            onClick={exportConfig}
            style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0a0e14', color: '#c3e7ff' }}
          >
            Copy Config to Clipboard
          </button>
        </div>

        {/* Info */}
        <div style={{ marginTop: 20, padding: 12, background: '#0f2230', border: '1px solid #1a2530', borderRadius: 4, fontSize: 12, color: '#8ab6d6' }}>
          <strong>Note:</strong> Custom presets are saved to localStorage. To use them in the game, you need to manually add them to <code>src/config/plumes.ts</code>.
        </div>
      </div>

      {/* 3D Preview */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          shadows
          gl={{ antialias: true }}
          style={{ background: '#000' }}
        >
          <Suspense fallback={null}>
            <OrthographicCamera makeDefault position={[0, 5, 10]} zoom={100} />
            <MapControls enableRotate={true} enablePan={true} />
            
            {/* Lighting */}
            <ambientLight intensity={0.2} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            
            {/* Reference Grid */}
            <gridHelper args={[20, 20, '#3fb6ff', '#1a2530']} rotation={[Math.PI / 2, 0, 0]} />
            
            {/* Reference Sphere (simulating ship/object) */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* The Plume */}
            <NebulaPlume 
              position={[0, 0, 0.6]}
              length={length}
              radius={radius}
              color={color}
              throttle={throttle}
              particleCount={particleCount}
              emissionRate={emissionRate}
              particleLife={particleLife}
              startScale={startScale}
              endScale={endScale}
              startAlpha={startAlpha}
              velocity={velocity}
              spread={spread}
              textureSoftness={textureSoftness}
            />

            <Environment preset="night" />
          </Suspense>
        </Canvas>

        {/* Overlay Info */}
        <div style={{ 
          position: 'absolute', 
          top: 20, 
          right: 20, 
          background: 'rgba(10, 14, 20, 0.9)', 
          padding: 12, 
          border: '1px solid #3fb6ff',
          borderRadius: 4,
          fontSize: 12
        }}>
          <div><strong>Preview Controls:</strong></div>
          <div>• Left Mouse: Rotate</div>
          <div>• Right Mouse: Pan</div>
          <div>• Scroll: Zoom</div>
        </div>
      </div>
    </div>
  );
};
