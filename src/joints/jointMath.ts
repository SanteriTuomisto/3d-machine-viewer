import type { JointSpec } from '@/machines/types'

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Normalise to (-180, 180]. */
export function wrapDeg(deg: number) {
  let d = ((deg + 180) % 360) - 180
  if (d <= -180) d += 360
  return d
}

export function applyLimit(spec: JointSpec, deg: number) {
  return spec.wrap ? wrapDeg(deg) : clamp(deg, spec.min, spec.max)
}

export function restPose(joints: readonly JointSpec[]): Record<string, number> {
  const pose: Record<string, number> = {}
  for (const j of joints) pose[j.name] = j.rest
  return pose
}

export function smoothstep(t: number) {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export function degToRad(deg: number) {
  return (deg * Math.PI) / 180
}
