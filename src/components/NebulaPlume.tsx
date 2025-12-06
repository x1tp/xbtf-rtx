import { useRef, useEffect, useMemo } from 'react'
import type { FC } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Simple particle data structure
interface Particle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  age: number
  life: number
  active: boolean
  spriteIndex: number
}

// Create a soft circular particle texture (cached)
let cachedTexture: THREE.CanvasTexture | null = null
function getParticleTexture(): THREE.CanvasTexture {
  if (cachedTexture) return cachedTexture
  
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)')
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.05)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(32, 32, 32, 0, Math.PI * 2)
    ctx.fill()
  }
  cachedTexture = new THREE.CanvasTexture(canvas)
  cachedTexture.needsUpdate = true
  return cachedTexture
}

interface NebulaPlumeProps {
  position: [number, number, number]
  length?: number
  radius?: number
  color?: string
  throttle?: number
  particleCount?: number
  emissionRate?: number
  particleLife?: number
  startScale?: number
  endScale?: number
  startAlpha?: number
  velocity?: number
  spread?: number
  textureSoftness?: number
}

export const NebulaPlume: FC<NebulaPlumeProps> = ({
  position,
  length = 2.5,
  radius = 0.5,
  color = '#76baff',
  throttle = 1.0,
  particleCount = 40,
  emissionRate = 0.02,
  particleLife = 0.6,
  startScale = 1.5,
  endScale = 0.1,
  startAlpha = 0.9,
  velocity = 20,
  spread = 8,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<Particle[]>([])
  const spritesRef = useRef<THREE.Sprite[]>([])
  const emitTimerRef = useRef(0)
  const { scene } = useThree()
  
  // Clamp values
  const maxParticles = Math.min(Math.max(1, particleCount), 200)
  const safeEmissionRate = Math.min(Math.max(0.01, emissionRate), 1.5)
  const safeLife = Math.min(Math.max(0.1, particleLife), 5)
  
  // Reusable vectors
  const worldPos = useMemo(() => new THREE.Vector3(), [])
  const worldQuat = useMemo(() => new THREE.Quaternion(), [])
  const baseDir = useMemo(() => new THREE.Vector3(), [])
  const tempVel = useMemo(() => new THREE.Vector3(), [])
  
  // Create material once
  const material = useMemo(() => {
    return new THREE.SpriteMaterial({
      map: getParticleTexture(),
      color: new THREE.Color(color),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    })
  }, [color])
  
  // Update material color when it changes
  useEffect(() => {
    material.color.set(color)
  }, [color, material])
  
  // Initialize sprites when maxParticles changes
  useEffect(() => {
    const sprites = spritesRef.current
    const particles = particlesRef.current
    
    // Add more sprites if needed
    while (sprites.length < maxParticles) {
      const sprite = new THREE.Sprite(material.clone())
      sprite.visible = false
      scene.add(sprite)
      sprites.push(sprite)
      
      // Add corresponding particle slot
      particles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: 0,
        life: 1,
        active: false,
        spriteIndex: sprites.length - 1
      })
    }
    
    // Hide excess sprites if maxParticles decreased
    for (let i = maxParticles; i < sprites.length; i++) {
      sprites[i].visible = false
      particles[i].active = false
    }
  }, [maxParticles, material, scene])
  
  // Cleanup
  useEffect(() => {
    return () => {
      spritesRef.current.forEach(sprite => {
        sprite.removeFromParent()
        sprite.material.dispose()
      })
      spritesRef.current = []
      particlesRef.current = []
      material.dispose()
    }
  }, [material])
  
  useFrame((_, delta) => {
    if (!groupRef.current) return
    
    const currentThrottle = Math.max(0, throttle ?? 1.0)
    
    // Get world transform
    groupRef.current.getWorldPosition(worldPos)
    groupRef.current.getWorldQuaternion(worldQuat)
    
    // Calculate emission direction
    baseDir.set(0, 0, 1).applyQuaternion(worldQuat)
    
    const particles = particlesRef.current
    const sprites = spritesRef.current
    
    // Emit new particles
    if (currentThrottle > 0.1) {
      emitTimerRef.current += delta
      while (emitTimerRef.current >= safeEmissionRate) {
        emitTimerRef.current -= safeEmissionRate
        
        // Find inactive particle slot from pre-allocated pool
        let particle: Particle | undefined
        for (let i = 0; i < Math.min(particles.length, maxParticles); i++) {
          if (!particles[i].active) {
            particle = particles[i]
            break
          }
        }
        
        if (!particle) {
          // All particles active, wait
          emitTimerRef.current = 0
          break
        }
        
        const spriteIndex = particle.spriteIndex
        
        // Initialize/reset particle
        const spreadRad = (spread * Math.PI / 180)
        const randomSpread = (Math.random() - 0.5) * spreadRad
        const randomAngle = Math.random() * Math.PI * 2
        
        tempVel.copy(baseDir)
        tempVel.x += Math.sin(randomAngle) * Math.sin(randomSpread)
        tempVel.y += Math.cos(randomAngle) * Math.sin(randomSpread)
        tempVel.normalize().multiplyScalar(length * velocity * (0.8 + Math.random() * 0.4) * currentThrottle)
        
        particle.position.copy(worldPos)
        particle.velocity.copy(tempVel)
        particle.age = 0
        particle.life = safeLife * (0.8 + Math.random() * 0.4)
        particle.active = true
        
        if (sprites[spriteIndex]) {
          sprites[spriteIndex].visible = true
        }
      }
    }
    
    // Update all particles
    for (let i = 0; i < Math.min(particles.length, maxParticles); i++) {
      const p = particles[i]
      if (!p.active) continue
      
      const sprite = sprites[p.spriteIndex]
      if (!sprite) continue
      
      p.age += delta
      
      if (p.age >= p.life) {
        // Deactivate particle
        p.active = false
        sprite.visible = false
        continue
      }
      
      // Update position
      p.position.addScaledVector(p.velocity, delta)
      
      // Update sprite
      const t = p.age / p.life
      const scale = startScale + (endScale - startScale) * t
      const alpha = startAlpha * (1 - t * t) // Quadratic falloff
      
      sprite.position.copy(p.position)
      sprite.scale.set(scale * radius, scale * radius, 1)
      sprite.material.opacity = alpha
    }
  })
  
  return <group ref={groupRef} position={position} />
}
