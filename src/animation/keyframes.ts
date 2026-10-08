import type { Keyframe } from '@/machines/types'
import { smoothstep } from '@/joints/jointMath'

export function duration(frames: readonly Keyframe[]) {
  return frames[frames.length - 1]?.t ?? 0
}

/** Pose at time t: clamped to the frame range, smoothstep between neighbours. */
export function sampleKeyframes(frames: readonly Keyframe[], t: number): Record<string, number> {
  const first = frames[0]
  const last = frames[frames.length - 1]
  if (!first || !last) return {}
  if (t <= first.t) return { ...first.joints }
  if (t >= last.t) return { ...last.joints }

  let i = 1
  while (frames[i]!.t < t) i++
  const a = frames[i - 1]!
  const b = frames[i]!
  const u = smoothstep((t - a.t) / (b.t - a.t))

  const out: Record<string, number> = {}
  for (const [name, from] of Object.entries(a.joints)) {
    const to = b.joints[name] ?? from
    out[name] = from + (to - from) * u
  }
  return out
}
