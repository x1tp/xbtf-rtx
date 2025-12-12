import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
  type Object3D,
} from 'three'

export type ShieldWrapEffectHandle = {
  trigger: (hitDirLocal?: Vector3, strength?: number) => void
}

type ShieldWrapEffectProps = {
  target: Object3D | null
  color?: string
  thickness?: number
}

const vertexShader = `
precision highp float;
precision highp int;

uniform float uThickness;
varying vec3 vPos;
varying vec3 vNormalObj;
varying vec3 vWorldPos;
void main() {
  vNormalObj = normalize(normal);
  vPos = position;
  vec3 displaced = position + vNormalObj * uThickness;
  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

const fragmentShader = `
precision highp float;
precision highp int;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uHitDir; // Local space direction
uniform float uHitTime;
uniform float uHitStrength;
uniform float uHitActive;
varying vec3 vNormalObj;
varying vec3 vPos;
varying vec3 vWorldPos;

float saturate(float x) { return clamp(x, 0.0, 1.0); }

void main() {
  // No base glow - fully invisible when not hit
  float hitGlow = 0.0;
  if (uHitActive > 0.5) {
     // Spatial ripple based on object-space normal (works for arbitrary hulls).
     vec3 localDir = normalize(vNormalObj);
     float align = dot(localDir, normalize(uHitDir));
     float d = (1.0 - align) * 0.5; 

     float t = uHitTime * 1.5; // speed

     float ringPos = t;
     float ringWidth = 0.15;
     float distToRing = abs(d - ringPos);
     float ring = smoothstep(ringWidth, 0.0, distToRing);
     float center = smoothstep(0.3, 0.0, d);
     float envelope = smoothstep(1.0, 0.5, t); // fade after half way

     hitGlow = (ring * 0.8 + center * 1.0) * envelope * uHitStrength;

     float grid = sin(vPos.x * 2.0) * sin(vPos.y * 2.0) * sin(vPos.z * 2.0);
     hitGlow *= (0.8 + 0.2 * step(0.0, grid));
  }

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float edge = 1.0 - abs(dot(normalize(vNormalObj), viewDir));
  hitGlow += hitGlow * edge * 1.0; 

  if (hitGlow < 0.01) discard;

  gl_FragColor = vec4(uColor, saturate(hitGlow));
}
`

export const ShieldWrapEffect = forwardRef<ShieldWrapEffectHandle, ShieldWrapEffectProps>(
  ({ target, color = '#66b6ff', thickness = 0.18 }, ref) => {
    const groupRef = useRef<Group | null>(null)
    const materialRef = useRef<ShaderMaterial | null>(null)
    const [ready, setReady] = useState(false)
    const hitRef = useRef({
      active: false,
      startTime: 0,
      dir: new Vector3(0, 0, 1),
      strength: 1,
    })

    const material = useMemo(() => {
      const mat = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        // Draw as an overlay on top of scene depth so it isn't occluded by the hull.
        depthTest: false,
        side: BackSide,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new Color(color) },
          uHitDir: { value: new Vector3(0, 0, 1) },
          uHitTime: { value: 0 },
          uHitStrength: { value: 1 },
          uHitActive: { value: 0 },
          uThickness: { value: thickness },
        },
      })
      return mat
    }, [color, thickness])

    useEffect(() => {
      materialRef.current = material
      return () => {
        materialRef.current = null
      }
    }, [material])

    // Build shield shell by cloning meshes from target.
    useEffect(() => {
      const g = groupRef.current
      if (!g) return
      g.clear()
      setReady(false)
      if (!target) return

      const clones: Mesh[] = []
      target.traverse((child) => {
        if ((child as Mesh).isMesh) {
          const m = child as Mesh
          const geom = m.geometry
          if (!geom) return
          const clone = new Mesh(geom, material)
          clone.position.copy(m.position)
          clone.quaternion.copy(m.quaternion)
          clone.scale.copy(m.scale)
          clone.renderOrder = 10
          clone.frustumCulled = false
          clones.push(clone)
          g.add(clone)
        }
      })

      if (clones.length > 0) setReady(true)
    }, [target, material])

    // If model loads after first pass, retry briefly.
    useEffect(() => {
      if (ready || !target) return
      let raf = 0
      let tries = 0
      const tick = () => {
        tries += 1
        const g = groupRef.current
        if (!g) return
        if (g.children.length === 0) {
          target.traverse((child) => {
            if ((child as Mesh).isMesh) {
              const m = child as Mesh
              if (!m.geometry) return
              const clone = new Mesh(m.geometry, material)
              clone.position.copy(m.position)
              clone.quaternion.copy(m.quaternion)
              clone.scale.copy(m.scale)
              clone.renderOrder = 10
              clone.frustumCulled = false
              g.add(clone)
            }
          })
        }
        if (g.children.length > 0 || tries > 120) {
          if (g.children.length > 0) setReady(true)
          return
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }, [ready, target, material])

    useImperativeHandle(ref, () => ({
      trigger: (hitDirLocal, strength = 1) => {
        const h = hitRef.current
        h.active = true
        h.startTime = performance.now()
        if (hitDirLocal && hitDirLocal.lengthSq() > 1e-6) {
          h.dir.copy(hitDirLocal).normalize()
        }
        h.strength = Math.max(0.2, Math.min(2.5, strength))
        const m = materialRef.current
        if (m) {
          m.uniforms.uHitDir.value.copy(h.dir)
          m.uniforms.uHitStrength.value = h.strength
          m.uniforms.uHitTime.value = 0
          m.uniforms.uHitActive.value = 1
        }
      },
    }))

    useFrame((_, delta) => {
      const m = materialRef.current
      if (!m) return
      m.uniforms.uTime.value += delta
      m.uniforms.uColor.value.set(color)
      m.uniforms.uThickness.value = thickness

      const h = hitRef.current
      if (h.active) {
        const t = (performance.now() - h.startTime) / 1000
        m.uniforms.uHitTime.value = t
        if (t > 1.25) {
          h.active = false
          m.uniforms.uHitActive.value = 0
        }
      }
    })

    return <group ref={groupRef} frustumCulled={false} />
  },
)

ShieldWrapEffect.displayName = 'ShieldWrapEffect'
