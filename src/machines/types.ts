import type { Object3D } from 'three'

export interface JointSpec {
  /** Key into BuiltMachine.pivots and the machine store's joints map. */
  name: string
  label: string
  /** Local rotation axis of the pivot group. */
  axis: 'x' | 'y' | 'z'
  /** Degrees. Ignored when wrap is true. */
  min: number
  max: number
  /** Unbounded joint, normalised to (-180, 180]. */
  wrap?: boolean
  /** Degrees. */
  rest: number
  /** Degrees per second while a key is held. */
  speed: number
  /** KeyboardEvent.code values. */
  keys: { positive: string; negative: string }
}

export interface Keyframe {
  /** Seconds from animation start. */
  t: number
  /** Degrees per joint name. Every frame lists every joint. */
  joints: Record<string, number>
}

export interface BuiltMachine {
  root: Object3D
  /** One pivot group per JointSpec.name. */
  pivots: Record<string, Object3D>
  dispose(): void
}

export interface MachineDefinition {
  id: string
  label: string
  joints: readonly JointSpec[]
  /** Orbit target. */
  center: readonly [number, number, number]
  cameraStart: readonly [number, number, number]
  build(): BuiltMachine
  animations: Record<string, Keyframe[]>
}
