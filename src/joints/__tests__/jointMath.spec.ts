import { describe, it, expect } from 'vitest'
import { clamp, wrapDeg, applyLimit, restPose, smoothstep, degToRad } from '@/joints/jointMath'
import type { JointSpec } from '@/machines/types'

const boom: JointSpec = {
  name: 'boom',
  label: 'Boom',
  axis: 'z',
  min: -35,
  max: 55,
  rest: 30,
  speed: 25,
  keys: { positive: 'KeyS', negative: 'KeyW' },
}
const swing: JointSpec = {
  name: 'swing',
  label: 'Swing',
  axis: 'y',
  min: 0,
  max: 0,
  wrap: true,
  rest: 0,
  speed: 40,
  keys: { positive: 'KeyA', negative: 'KeyD' },
}

describe('clamp', () => {
  it('limits to the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
})

describe('wrapDeg', () => {
  it('leaves values inside (-180, 180] alone', () => {
    expect(wrapDeg(0)).toBe(0)
    expect(wrapDeg(179)).toBe(179)
    expect(wrapDeg(180)).toBe(180)
    expect(wrapDeg(-179)).toBe(-179)
  })
  it('wraps past the seam in both directions', () => {
    expect(wrapDeg(181)).toBe(-179)
    expect(wrapDeg(-181)).toBe(179)
    expect(wrapDeg(-180)).toBe(180)
    expect(wrapDeg(750)).toBeCloseTo(30)
    expect(wrapDeg(-750)).toBeCloseTo(-30)
  })
})

describe('applyLimit', () => {
  it('clamps limited joints', () => {
    expect(applyLimit(boom, 999)).toBe(55)
    expect(applyLimit(boom, -999)).toBe(-35)
    expect(applyLimit(boom, 0)).toBe(0)
  })
  it('wraps wrapping joints instead of clamping', () => {
    expect(applyLimit(swing, 190)).toBe(-170)
  })
})

describe('restPose', () => {
  it('maps every joint name to its rest angle', () => {
    expect(restPose([boom, swing])).toEqual({ boom: 30, swing: 0 })
  })
})

describe('smoothstep', () => {
  it('eases from 0 to 1 with flat ends', () => {
    expect(smoothstep(0)).toBe(0)
    expect(smoothstep(1)).toBe(1)
    expect(smoothstep(0.5)).toBeCloseTo(0.5)
    expect(smoothstep(0.1)).toBeLessThan(0.1)
    expect(smoothstep(0.9)).toBeGreaterThan(0.9)
    expect(smoothstep(-5)).toBe(0)
    expect(smoothstep(5)).toBe(1)
  })
})

describe('degToRad', () => {
  it('converts', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI)
  })
})
