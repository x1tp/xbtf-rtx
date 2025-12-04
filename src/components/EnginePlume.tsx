import type { FC } from 'react'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, BufferAttribute, ShaderMaterial, AdditiveBlending, Color } from 'three'
import type { Points } from 'three'
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
  shockFrequency?: number
  animationSpeed?: number
  smoothness?: number
  throttle?: number
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
  shockFrequency = 20.0,
  animationSpeed = 10.0,
  throttle,
}) => {
  const count = Math.floor(800 * density) // Particle count based on density
  
  const geom = useMemo(() => {
    const g = new BufferGeometry()
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const ages = new Float32Array(count)
    const randoms = new Float32Array(count * 2) // For noise/variation
    let seed = 123456789
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return (seed & 0xffffffff) / 4294967296
    }
    
    // Initialize particles
    for (let i = 0; i < count; i++) {
      // Start at nozzle
      positions[i * 3] = (rng() - 0.5) * radius * 0.3
      positions[i * 3 + 1] = (rng() - 0.5) * radius * 0.3
      positions[i * 3 + 2] = 0
      
      // Velocity pointing backwards (+Z)
      velocities[i * 3] = (rng() - 0.5) * 0.2
      velocities[i * 3 + 1] = (rng() - 0.5) * 0.2
      velocities[i * 3 + 2] = 1.0 + rng() * 0.5
      
      // Stagger initial ages
      ages[i] = rng()
      
      randoms[i * 2] = rng()
      randoms[i * 2 + 1] = rng()
    }
    
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('velocity', new BufferAttribute(velocities, 3))
    g.setAttribute('age', new BufferAttribute(ages, 1))
    g.setAttribute('random', new BufferAttribute(randoms, 2))
    
    return g
  }, [count, radius])

  const col = useMemo(() => new Color(color), [color])

  const mat = useMemo(
    () => {
      const material = new ShaderMaterial({
        blending: AdditiveBlending,
        // Keep in the transparent queue so we render after opaque meshes but still read their depth
        transparent: true,
        depthWrite: false,
        depthTest: true,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: col },
          uGlow: { value: glow },
          uThrottle: { value: 0 },
          uLength: { value: length },
          uRadius: { value: radius },
          uShock: { value: shock },
          uShockFreq: { value: shockFrequency },
          uAnimSpeed: { value: animationSpeed },
          uNoiseScale: { value: noiseScale },
        },
        vertexShader: `
          attribute vec3 velocity;
          attribute float age;
          attribute vec2 random;
          
          uniform float uTime;
          uniform float uThrottle;
          uniform float uLength;
          uniform float uRadius;
          uniform float uAnimSpeed;
          uniform float uNoiseScale;
          
          varying float vAge;
          varying float vSpeed;
          varying vec2 vRandom;
          
          // Simple hash for noise
          float hash(float n) { return fract(sin(n) * 43758.5453123); }
          
          void main() {
            vAge = age;
            vRandom = random;
            
            // Calculate particle lifetime position
            float life = fract(age + uTime * uAnimSpeed * 0.3);
            float throttle = max(0.0, uThrottle);
            
            // Start position with slight spread
            vec3 startPos = position;
            
            // Velocity with turbulence
            vec3 vel = velocity * uLength * 3.0;
            float turbulence = hash(random.x * 100.0 + uTime) * 0.5;
            vel.x += (random.x - 0.5) * turbulence * uRadius;
            vel.y += (random.y - 0.5) * turbulence * uRadius;
            
            // Calculate world position
            vec3 pos = startPos + vel * life * throttle;
            
            // Expand outward slightly as particles age
            pos.x += (random.x - 0.5) * uRadius * life * 0.5;
            pos.y += (random.y - 0.5) * uRadius * life * 0.5;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            // Particle size: larger at start, smaller with age
            float baseSize = uRadius * 12.0;
            vSpeed = length(velocity);
            gl_PointSize = mix(baseSize * (1.0 + throttle), baseSize * 0.2, life) * throttle;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uGlow;
          uniform float uTime;
          uniform float uShock;
          uniform float uShockFreq;
          uniform float uAnimSpeed;
          
          varying float vAge;
          varying float vSpeed;
          varying vec2 vRandom;
          
          void main() {
            // Distance from center of point sprite
            vec2 center = gl_PointCoord - 0.5;
            float dist = length(center);
            
            // Soft circle falloff
            float alpha = smoothstep(0.5, 0.0, dist);
            
            // Fade over particle lifetime
            float life = vAge;
            float lifeFade = 1.0 - life;
            
            // Color evolution: hot white/yellow -> cool blue over lifetime
            vec3 hotColor = vec3(1.0, 0.95, 0.8);
            vec3 coolColor = uColor;
            vec3 col = mix(hotColor, coolColor, life * 0.7);
            
            // Shock diamond effect (periodic brightness)
            float shockPhase = life * uShockFreq - uTime * uAnimSpeed;
            float shock = pow(abs(sin(shockPhase)), 3.0) * uShock;
            col += col * shock * 0.5;
            
            // Flicker based on particle random seed
            float flicker = 0.9 + 0.1 * sin(uTime * 20.0 + vRandom.x * 100.0);
            
            // Apply glow and combine
            col *= uGlow * flicker;
            
            // Final alpha
            float finalAlpha = alpha * lifeFade * (0.3 + 0.7 * vSpeed);
            
            gl_FragColor = vec4(col, finalAlpha);
          }
        `,
      });
      material.needsUpdate = true;
      // Clone the material so each plume instance has its own
      return material.clone();
    },
    [col, glow, shock, shockFrequency, animationSpeed, noiseScale, length, radius]
  )

  const pointsRef = useRef<Points>(null)
  const ageArrayRef = useRef<Float32Array | null>(null)

  useFrame((state, delta) => {
    if (!pointsRef.current) return
    
    const uniforms = (pointsRef.current.material as ShaderMaterial).uniforms
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uThrottle.value = throttle !== undefined ? throttle : Math.max(0, useGameStore.getState().throttle)
    
    // Update particle ages
    const geometry = pointsRef.current.geometry
    const ageAttr = geometry.getAttribute('age') as BufferAttribute
    
    if (!ageArrayRef.current) {
      ageArrayRef.current = new Float32Array(ageAttr.array)
    }
    
    const ages = ageArrayRef.current
    const speed = animationSpeed * 0.01 * delta
    
    for (let i = 0; i < ages.length; i++) {
      ages[i] += speed
      if (ages[i] > 1.0) {
        ages[i] = 0.0 // Recycle particle
      }
    }
    
    ageAttr.array = ages
    ageAttr.needsUpdate = true
  })

  return (
    <points
      ref={pointsRef}
      frustumCulled={false}
      name="EnginePlume"
      // Slightly after default transparent effects; glow sprite renders with a higher order
      renderOrder={1}
      geometry={geom}
      material={mat}
      position={position}
    />
  )
}
