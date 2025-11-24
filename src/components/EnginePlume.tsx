import type { FC } from 'react'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, ShaderMaterial, Mesh, AdditiveBlending, Color, DoubleSide } from 'three'
import { useGameStore } from '../store/gameStore'

interface EnginePlumeProps {
  position: [number, number, number]
  length?: number
  radius?: number
  color?: string
  density?: number
  steps?: number // Deprecated, kept for compatibility
  glow?: number
  noiseScale?: number
  shock?: number
}

export const EnginePlume: FC<EnginePlumeProps> = ({
  position,
  length = 2.5,
  radius = 0.5,
  color = '#76baff',
  density = 0.6,
  glow = 5.0,
  noiseScale = 2.0,
  shock = 1.0,
}) => {
  // Use a cylinder geometry: radiusTop=radius, radiusBottom=0 (cone-like), height=1
  // We'll scale it in the mesh.
  // Open ended cylinder might be better for the look, but closed is fine too.
  const geom = useMemo(() => {
    // radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded
    const g = new CylinderGeometry(1, 0.4, 1, 16, 8, true)
    g.translate(0, -0.5, 0) // Pivot at top
    g.rotateX(-Math.PI / 2) // Point along -Z (or +Z depending on usage, original was box)
    // Original box was scaled [radius*2, radius*2, length] and rotated [0, PI, 0]
    // So it pointed along -Z relative to the ship if ship points -Z.
    // Let's align this cylinder to point along +Z in its local space, then we rotate it to match.
    return g
  }, [])

  const col = useMemo(() => new Color(color), [color])

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: col },
          uOpacity: { value: density },
          uNoiseScale: { value: noiseScale },
          uThrottle: { value: 0 },
          uGlow: { value: glow },
          uShock: { value: shock },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vPos;
          uniform float uTime;
          uniform float uThrottle;
          uniform float uNoiseScale;

          // Simple noise function
          float hash(float n) { return fract(sin(n) * 43758.5453123); }
          float noise(vec3 x) {
            vec3 p = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            float n = p.x + p.y * 57.0 + 113.0 * p.z;
            return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                           mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
                       mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                           mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
          }

          void main() {
            vUv = uv;
            vPos = position;
            
            vec3 pos = position;
            
            // Add some wobble/noise to vertices based on throttle and time
            float n = noise(pos * uNoiseScale + vec3(0.0, 0.0, uTime * 5.0));
            float displacement = n * 0.1 * uThrottle;
            
            // Expand slightly based on noise
            pos += normal * displacement;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          varying vec3 vPos;
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uTime;
          uniform float uThrottle;
          uniform float uGlow;
          uniform float uShock;

          void main() {
            // Gradient along the length (vUv.y is 0 at bottom, 1 at top usually, but check geometry mapping)
            // Cylinder UVs: y goes 0 to 1 along height.
            // We shifted geometry so top is at 0, bottom at -1.
            // Let's assume standard UVs: y=1 at top, y=0 at bottom.
            
            float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.4, vUv.y);
            
            // Core intensity
            float core = pow(fade, 2.0) * 2.0;
            
            // Shock diamonds pattern
            float shock = sin(vUv.y * 20.0 - uTime * 10.0) * 0.5 + 0.5;
            shock = pow(shock, 4.0) * uShock * uThrottle;
            
            // Combine
            vec3 finalColor = uColor * (core + shock) * uGlow;
            
            // Opacity fade out at ends
            float alpha = uOpacity * fade * (0.5 + 0.5 * uThrottle);
            
            gl_FragColor = vec4(finalColor, alpha);
          }
        `,
      }),
    [col, density, glow, noiseScale, shock]
  )

  const meshRef = useRef<Mesh>(null)

  useFrame((state) => {
    const dt = state.clock.getDelta()
    if (meshRef.current) {
      const uniforms = (meshRef.current.material as ShaderMaterial).uniforms
      uniforms.uTime.value += dt
      uniforms.uThrottle.value = Math.max(0, useGameStore.getState().throttle)
    }
  })

  return (
    <mesh
      ref={meshRef}
      frustumCulled={false}
      name="EnginePlume"
      renderOrder={5}
      geometry={geom}
      material={mat}
      position={position}
      // Original was rotated [0, PI, 0] to point backwards.
      // Our geometry points along +Y (default cylinder) but we rotated it to -Z in geom construction?
      // Wait, Cylinder default is along Y axis.
      // In geom: translate(0, -0.5, 0) moves center to top.
      // rotateX(-PI/2) rotates it so +Y becomes -Z? No.
      // +Y rotated -90deg around X -> +Z.
      // So it points along +Z.
      // Ship points -Z. So we want plume to point +Z (backwards).
      // So rotation should be identity or adjusted if parent is rotated.
      // The prop passed is rotation={[0, Math.PI, 0]} in usage usually?
      // Let's look at usage in Cockpit.tsx:
      // <EnginePlume ... rotation={[0, Math.PI, 0]} /> is NOT passed in Cockpit.tsx.
      // Cockpit.tsx passes position, length, radius etc.
      // The OLD EnginePlume had `rotation={[0, Math.PI, 0]}` hardcoded in the return JSX.
      // And it used BoxGeometry(1,1,1).

      // Let's stick to a standard orientation:
      // If we want it to point "backwards" from the ship (which faces -Z), the plume should extend towards +Z.
      // My geometry construction:
      // Cylinder is Y-up.
      // rotateX(-Math.PI / 2) makes it Z-forward (points to +Z).
      // So it should be correct without extra rotation if placed at the engine nozzle.

      scale={[radius, radius, length]}
    />
  )
}
