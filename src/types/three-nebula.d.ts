declare module 'three-nebula' {
  import * as THREE from 'three'

  export default class Nebula {
    constructor()
    addEmitter(emitter: Emitter): void
    addRenderer(renderer: SpriteRenderer): void
    update(delta: number): void
    destroy(): void
  }

  export class Emitter {
    isEmitting: boolean
    initializers: unknown[]
    setRate(rate: Rate): Emitter
    setInitializers(initializers: unknown[]): Emitter
    setBehaviours(behaviours: unknown[]): Emitter
    setPosition(position: { x: number; y: number; z: number }): Emitter
    emit(): Emitter
    stopEmit(): void
  }

  export class Rate {
    constructor(particleCount: Span, time: Span)
  }

  export class Span {
    constructor(a: number, b?: number)
  }

  export class Position {
    constructor(zone: Zone)
  }

  export class Mass {
    constructor(mass: number)
  }

  export class Body {
    constructor(body: THREE.Sprite | THREE.Mesh | unknown)
  }

  export class Radius {
    constructor(radiusA: number, radiusB?: number)
  }

  export class Life {
    constructor(lifeA: number, lifeB?: number)
  }

  export class RadialVelocity {
    radiusPan: { a: number; b: number }
    dir: { x: number; y: number; z: number }
    constructor(radius: Span, vector: Vector3D, angle: number)
  }

  export class PointZone {
    constructor(x: number, y: number, z: number)
  }

  export class Vector3D {
    constructor(x: number, y: number, z: number)
  }

  export class Alpha {
    constructor(a: number, b: number, life: number, easing: unknown)
  }

  export class Scale {
    constructor(a: number, b: number, life: number, easing: unknown)
  }

  export class Color {
    constructor(colorA: THREE.Color, colorB: THREE.Color, life: number, easing: unknown)
  }

  export class SpriteRenderer {
    constructor(scene: THREE.Scene, THREE: unknown)
    setBaseSize(size: number): void
  }

  export const ease: {
    easeLinear: unknown
    easeInQuad: unknown
    easeOutQuad: unknown
    easeInOutQuad: unknown
    easeInCubic: unknown
    easeOutCubic: unknown
    easeInOutCubic: unknown
  }

  type Zone = PointZone
}
