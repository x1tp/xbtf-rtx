import type { FC } from 'react'
import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Nebula, {
  Emitter,
  Rate,
  Span,
  Position,
  Mass,
  Body,
  Radius,
  Life,
  RadialVelocity,
  PointZone,
  Vector3D,
  Alpha,
  Scale,
  Color as NebulaColor,
  SpriteRenderer,
  ease
} from 'three-nebula'

// Create a soft circular particle texture
function createParticleTexture(softness: number = 0.5): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Create a soft radial gradient for a round particle
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    
    // Softer falloff for more natural looking particles
    const innerRadius = 0.1 + softness * 0.15
    const midRadius = 0.3 + softness * 0.2
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(innerRadius, 'rgba(255, 255, 255, 0.95)')
    gradient.addColorStop(midRadius, 'rgba(255, 255, 255, 0.6)')
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.25)')
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.08)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(32, 32, 32, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

interface NebulaPlumeProps {
  position: [number, number, number]
  length?: number
  radius?: number
  color?: string
  throttle?: number
  // Advanced particle controls
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
  particleCount = 10,
  emissionRate = 0.075,
  particleLife = 0.75,
  startScale = 2.0,
  endScale = 0.3,
  startAlpha = 0.8,
  velocity = 15,
  spread = 12,
  textureSoftness = 0.5,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const { scene } = useThree()
  const nebulaRef = useRef<Nebula | null>(null)
  const emitterRef = useRef<Emitter | null>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    if (!scene || !groupRef.current) return

    // Clean up any existing nebula first
    if (nebulaRef.current) {
      nebulaRef.current.destroy()
      nebulaRef.current = null
      emitterRef.current = null
    }

    try {
      // Get world position of the group
      const worldPos = new THREE.Vector3()
      groupRef.current.getWorldPosition(worldPos)

      // Create texture for particles
      const texture = createParticleTexture(textureSoftness)
      textureRef.current = texture

      // Create material for our custom sprite
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: new THREE.Color(color),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      })
      
      // Create the template sprite that nebula will clone
      const sprite = new THREE.Sprite(material)

      // Parse color for behaviors
      const threeColor = new THREE.Color(color)

      // Create emitter with Body initializer for custom sprite
      const emitter = new Emitter()
        .setRate(new Rate(new Span(particleCount * 0.8, particleCount * 1.2), new Span(emissionRate * 0.8, emissionRate * 1.2)))
        .setInitializers([
          new Position(new PointZone(0, 0, 0)),
          new Mass(1),
          new Body(sprite),
          new Radius(radius * 1.2, radius * 1.8),
          new Life(particleLife * 0.8, particleLife * 1.2),
          new RadialVelocity(
            new Span(length * velocity * 0.8, length * velocity * 1.2),
            new Vector3D(0, 0, 1),
            spread
          ),
        ])
        .setBehaviours([
          new Alpha(startAlpha, 0, Infinity, ease.easeOutQuad),
          new Scale(startScale, endScale, Infinity, ease.easeOutCubic),
          new NebulaColor(threeColor, threeColor.clone().multiplyScalar(0.4), Infinity, ease.easeOutQuad),
        ])
        .setPosition({ x: worldPos.x, y: worldPos.y, z: worldPos.z })
        .emit()

      emitterRef.current = emitter

      // Create renderer
      const renderer = new SpriteRenderer(scene, THREE)

      // Create nebula system
      const nebula = new Nebula()
      nebula.addEmitter(emitter)
      nebula.addRenderer(renderer)

      nebulaRef.current = nebula
    } catch (error) {
      console.error('NebulaPlume initialization error:', error)
    }

    return () => {
      // Clean up
      if (nebulaRef.current) {
        nebulaRef.current.destroy()
        nebulaRef.current = null
      }
      if (textureRef.current) {
        textureRef.current.dispose()
        textureRef.current = null
      }
    }
  }, [scene, color, length, radius, particleCount, emissionRate, particleLife, startScale, endScale, startAlpha, velocity, spread, textureSoftness])

  useFrame((_, delta) => {
    if (!nebulaRef.current || !emitterRef.current || !groupRef.current) return

    // Update emitter position to follow the group
    const worldPos = new THREE.Vector3()
    groupRef.current.getWorldPosition(worldPos)
    emitterRef.current.setPosition({ x: worldPos.x, y: worldPos.y, z: worldPos.z })

    // Update velocity direction based on ship's rotation
    const worldQuat = new THREE.Quaternion()
    groupRef.current.getWorldQuaternion(worldQuat)
    
    // Base direction is +Z (backwards from ship)
    const baseDir = new THREE.Vector3(0, 0, 1)
    baseDir.applyQuaternion(worldQuat)

    // Update the RadialVelocity direction
    const velocityBehavior = emitterRef.current.initializers.find(
      (init: unknown) => init instanceof RadialVelocity
    ) as RadialVelocity | undefined
    
    if (velocityBehavior) {
      // Update direction vector
      velocityBehavior.dir.x = baseDir.x
      velocityBehavior.dir.y = baseDir.y
      velocityBehavior.dir.z = baseDir.z

      // Update throttle by modifying velocity
      const currentThrottle = Math.max(0, throttle ?? 1.0)
      velocityBehavior.radiusPan.a = length * velocity * 0.8 * currentThrottle
      velocityBehavior.radiusPan.b = length * velocity * 1.2 * currentThrottle
    }

    // Handle throttle emission
    const currentThrottle = Math.max(0, throttle ?? 1.0)
    if (currentThrottle > 0.1) {
      if (!emitterRef.current.isEmitting) {
        emitterRef.current.emit()
      }
    } else {
      if (emitterRef.current.isEmitting) {
        emitterRef.current.stopEmit()
      }
    }

    nebulaRef.current.update(delta)
  })

  return <group ref={groupRef} position={position} renderOrder={100} />
}
