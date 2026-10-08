import { describe, it, expect } from 'vitest'
import { sampleKeyframes, duration } from '@/animation/keyframes'
import type { Keyframe } from '@/machines/types'

const a = { swing: 0, boom: 0 }
const b = { swing: 90, boom: 40 }
const frames: Keyframe[] = [
  { t: 0, joints: a },
  { t: 2, joints: b },
]

describe('sampleKeyframes', () => {
  it('returns the first frame before/at t=0 and the last after the end', () => {
    expect(sampleKeyframes(frames, -1)).toEqual(a)
    expect(sampleKeyframes(frames, 0)).toEqual(a)
    expect(sampleKeyframes(frames, 2)).toEqual(b)
    expect(sampleKeyframes(frames, 999)).toEqual(b)
  })
  it('is half-way at the midpoint and eased near the ends', () => {
    const mid = sampleKeyframes(frames, 1)
    expect(mid.swing).toBeCloseTo(45)
    expect(mid.boom).toBeCloseTo(20)
    expect(sampleKeyframes(frames, 0.2).swing).toBeLessThan(9) // linear would be 9
  })
  it('returns copies, not the frame objects', () => {
    const s = sampleKeyframes(frames, 0)
    s.swing = 123
    expect(a.swing).toBe(0)
  })
  it('handles empty input', () => {
    expect(sampleKeyframes([], 1)).toEqual({})
    expect(duration([])).toBe(0)
  })
})

describe('duration', () => {
  it('is the last frame time', () => {
    expect(duration(frames)).toBe(2)
  })
})
