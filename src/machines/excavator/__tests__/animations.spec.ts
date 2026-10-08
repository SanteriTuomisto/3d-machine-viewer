import { describe, it, expect } from 'vitest'
import { DIG_CYCLE } from '../animations'
import { EXCAVATOR_JOINTS } from '../joints'
import { applyLimit } from '@/joints/jointMath'

describe('DIG_CYCLE', () => {
  it('starts at t=0, is strictly ascending, and ends where it began', () => {
    const first = DIG_CYCLE[0]
    const last = DIG_CYCLE[DIG_CYCLE.length - 1]
    expect(first?.t).toBe(0)
    for (let i = 1; i < DIG_CYCLE.length; i++) {
      expect(DIG_CYCLE[i]!.t).toBeGreaterThan(DIG_CYCLE[i - 1]!.t)
    }
    expect(last?.joints).toEqual(first?.joints)
  })
  it('lists every joint in every frame and never leaves the limits', () => {
    for (const f of DIG_CYCLE) {
      for (const spec of EXCAVATOR_JOINTS) {
        const deg = f.joints[spec.name]
        expect(deg).toBeTypeOf('number')
        expect(applyLimit(spec, deg!)).toBe(deg)
      }
    }
  })
})
