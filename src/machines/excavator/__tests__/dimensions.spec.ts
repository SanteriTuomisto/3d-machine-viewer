import { describe, it, expect } from 'vitest'
import { boomTip, boomSegmentMidpoints, BOOM_SEGMENTS, DIM } from '../dimensions'

const rad = (d: number) => (d * Math.PI) / 180

describe('boom geometry', () => {
  it('boom tip is the vector sum of the two segments', () => {
    const [a, b] = BOOM_SEGMENTS
    const tip = boomTip()
    expect(tip.x).toBeCloseTo(
      a.length * Math.cos(rad(a.angleDeg)) + b.length * Math.cos(rad(b.angleDeg)),
      6,
    )
    expect(tip.y).toBeCloseTo(
      a.length * Math.sin(rad(a.angleDeg)) + b.length * Math.sin(rad(b.angleDeg)),
      6,
    )
  })

  it('first segment midpoint is half-way along segment A from the pivot', () => {
    const [a] = BOOM_SEGMENTS
    const [mid] = boomSegmentMidpoints()
    expect(mid!.x).toBeCloseTo((a.length / 2) * Math.cos(rad(a.angleDeg)), 6)
    expect(mid!.length).toBe(a.length)
  })

  it('boom reaches well past the front of the tracks', () => {
    expect(DIM.boomPivot.x + boomTip().x).toBeGreaterThan(DIM.track.length / 2 + 2)
  })
})
