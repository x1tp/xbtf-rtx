import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BackSide, Color, ShaderMaterial, Vector3 } from 'three'

export type ShieldEffectHandle = {
  trigger: (hitDirLocal?: Vector3, strength?: number) => void
}

type ShieldEffectProps = {
  radius: number
  color?: string
  segments?: number
}

const vertexShader = `
varying vec3 vNormalObj;
varying vec3 vWorldPos;
void main() {
  vNormalObj = normalize(normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

const fragmentShader = `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uHitDir;
uniform float uHitTime;
uniform float uHitStrength;
uniform float uHitActive;
uniform float uRadius;
varying vec3 vNormalObj;
varying vec3 vWorldPos;

float saturate(float x) { return clamp(x, 0.0, 1.0); }

void main() {
  vec3 n = normalize(vNormalObj);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - saturate(dot(n, viewDir)), 3.0);

  float baseGlow = fresnel * 0.35;

  float hitGlow = 0.0;
  if (uHitActive > 0.5) {
    float d = acos(clamp(dot(n, normalize(uHitDir)), -1.0, 1.0)) / 3.14159265; // 0..1 over sphere
    float t = uHitTime;
    float ringPos = t * 0.85;
    float ringWidth = 0.035 + (1.0 - saturate(uHitStrength)) * 0.02;
    float ring = smoothstep(ringPos + ringWidth, ringPos, d) * smoothstep(ringPos - ringWidth, ringPos, d);
    float center = exp(-d * d * 60.0);
    float envelope = exp(-t * 3.2);
    hitGlow = (ring * 1.6 + center * 1.2) * envelope * uHitStrength;
  }

  float flicker = 0.92 + 0.08 * sin(uTime * 14.0 + dot(n, vec3(3.1, 2.7, 4.3)));

  float intensity = (baseGlow + hitGlow) * flicker;
  vec3 col = uColor * intensity;
  float alpha = saturate(intensity * 1.4);

  gl_FragColor = vec4(col, alpha);
}
`

export const ShieldEffect = forwardRef<ShieldEffectHandle, ShieldEffectProps>(
  ({ radius, color = '#66b6ff', segments = 32 }, ref) => {
    const materialRef = useRef<ShaderMaterial | null>(null)
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
        side: BackSide,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new Color(color) },
          uHitDir: { value: new Vector3(0, 0, 1) },
          uHitTime: { value: 0 },
          uHitStrength: { value: 1 },
          uHitActive: { value: 0 },
          uRadius: { value: radius },
        },
      })
      return mat
    }, [color, radius])

    useImperativeHandle(ref, () => ({
      trigger: (hitDirLocal, strength = 1) => {
        const h = hitRef.current
        h.active = true
        h.startTime = performance.now()
        if (hitDirLocal && hitDirLocal.lengthSq() > 1e-6) {
          h.dir.copy(hitDirLocal).normalize()
        }
        h.strength = Math.max(0.2, Math.min(2.5, strength))
        if (materialRef.current) {
          materialRef.current.uniforms.uHitDir.value.copy(h.dir)
          materialRef.current.uniforms.uHitStrength.value = h.strength
          materialRef.current.uniforms.uHitTime.value = 0
          materialRef.current.uniforms.uHitActive.value = 1
        }
      },
    }))

    useFrame((_, delta) => {
      const m = materialRef.current
      if (!m) return

      m.uniforms.uTime.value += delta
      m.uniforms.uRadius.value = radius
      m.uniforms.uColor.value.set(color)

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

    return (
      <mesh frustumCulled={false} renderOrder={5}>
        <sphereGeometry args={[radius, segments, Math.floor(segments / 2)]} />
        <primitive object={material} attach="material" ref={materialRef as any} />
      </mesh>
    )
  },
)

ShieldEffect.displayName = 'ShieldEffect'
