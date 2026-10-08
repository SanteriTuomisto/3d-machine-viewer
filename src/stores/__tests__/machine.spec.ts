import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMachineStore } from '@/stores/machine'
import { restPose } from '@/joints/jointMath'
import { getMachine } from '@/machines/registry'
import { DIG_CYCLE } from '@/machines/excavator/animations'

const excavatorRest = restPose(getMachine('excavator').joints)

describe('machine store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts with the excavator at rest, not playing', () => {
    const s = useMachineStore()
    expect(s.machineId).toBe('excavator')
    expect(s.definition.id).toBe('excavator')
    expect(s.joints).toEqual(excavatorRest)
    expect(s.playing).toBeNull()
  })

  it('load throws on an unknown machine and leaves state untouched', () => {
    const s = useMachineStore()
    expect(() => s.load('hovercraft')).toThrow('Unknown machine "hovercraft"')
    expect(s.machineId).toBe('excavator')
  })

  it('setJoint clamps limited joints', () => {
    const s = useMachineStore()
    s.setJoint('boom', 500)
    expect(s.joints.boom).toBe(55)
  })

  it('setJoint ignores non-finite input and unknown joints', () => {
    const s = useMachineStore()
    s.setJoint('boom', Number.NaN)
    s.setJoint('stick', Number.POSITIVE_INFINITY)
    s.setJoint('wheel', 10)
    expect(s.joints).toEqual(excavatorRest)
  })

  it('nudgeJoint accumulates and swing wraps past 180', () => {
    const s = useMachineStore()
    s.setJoint('swing', 170)
    s.nudgeJoint('swing', 20)
    expect(s.joints.swing).toBe(-170)
  })

  it('nudgeJoint stops at a limit', () => {
    const s = useMachineStore()
    s.setJoint('bucket', 119)
    s.nudgeJoint('bucket', 10)
    expect(s.joints.bucket).toBe(120)
  })

  it('jointsRad converts degrees to radians', () => {
    const s = useMachineStore()
    s.setJoint('boom', 45)
    expect(s.jointsRad.boom).toBeCloseTo(Math.PI / 4)
  })

  it('resetJoints returns to rest and stops playback', () => {
    const s = useMachineStore()
    s.setJoint('boom', 0)
    s.playing = 'dig'
    s.playTime = 3
    s.resetJoints()
    expect(s.joints).toEqual(excavatorRest)
    expect(s.playing).toBeNull()
    expect(s.playTime).toBe(0)
  })

  it('play starts from the first keyframe', () => {
    const s = useMachineStore()
    s.setJoint('boom', 0)
    s.play('dig')
    expect(s.playing).toBe('dig')
    expect(s.playTime).toBe(0)
    expect(s.joints).toEqual(DIG_CYCLE[0]?.joints)
  })

  it('play ignores unknown animations', () => {
    const s = useMachineStore()
    s.play('moonwalk')
    expect(s.playing).toBeNull()
  })

  it('advance moves time forward and stops exactly on the last frame', () => {
    const s = useMachineStore()
    s.play('dig')
    s.advance(0.5)
    expect(s.playTime).toBeCloseTo(0.5)
    expect(s.playing).toBe('dig')
    s.advance(1000) // backgrounded tab
    expect(s.playing).toBeNull()
    expect(s.joints).toEqual(DIG_CYCLE[DIG_CYCLE.length - 1]?.joints)
  })

  it('advance does nothing when not playing', () => {
    const s = useMachineStore()
    s.advance(1)
    expect(s.joints).toEqual(excavatorRest)
  })
})
