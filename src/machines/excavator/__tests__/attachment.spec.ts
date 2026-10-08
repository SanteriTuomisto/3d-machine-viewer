import { describe, it, expect } from 'vitest'
import { Vector3, type Object3D } from 'three'
import { buildExcavator } from '../build'
import { EXCAVATOR_JOINTS } from '../joints'
import { degToRad, restPose } from '@/joints/jointMath'
import type { BuiltMachine } from '@/machines/types'

const REST = restPose(EXCAVATOR_JOINTS)

/** Builds the excavator with every joint at rest, overridden by `angles` (degrees). */
function posed(angles: Record<string, number> = {}): BuiltMachine {
  const built = buildExcavator()
  for (const spec of EXCAVATOR_JOINTS) {
    const p = built.pivots[spec.name]
    if (p) p.rotation[spec.axis] = degToRad(angles[spec.name] ?? spec.rest)
  }
  built.root.updateMatrixWorld(true)
  return built
}

function find(built: BuiltMachine, name: string): Object3D {
  const o = built.root.getObjectByName(name)
  if (!o) throw new Error(`missing object ${name}`)
  return o
}

function world(built: BuiltMachine, name: string) {
  return find(built, name).getWorldPosition(new Vector3())
}

describe('backhoe bucket', () => {
  it('at rest the teeth face the machine, not away from it (not a front shovel)', () => {
    const built = posed()
    expect(world(built, 'teeth').x).toBeLessThan(world(built, 'bucket').x - 0.3)
  })

  it('curling (a lower bucket angle) lifts the teeth', () => {
    const rest = world(posed(), 'teeth')
    const curled = world(posed({ bucket: (REST.bucket ?? 0) - 30 }), 'teeth')
    expect(curled.y).toBeGreaterThan(rest.y + 0.2)
  })
})

describe('tiltrotator', () => {
  it('sits between the bucket curl pivot and the bucket: bucket → tilt → rotate', () => {
    const built = posed()
    expect(find(built, 'tilt').parent).toBe(find(built, 'bucket'))
    expect(find(built, 'rotate').parent).toBe(find(built, 'tilt'))
    expect(find(built, 'teeth').parent).not.toBeNull()
  })

  it('rotating 180° turns the bucket around the tiltrotator axis', () => {
    const a = posed()
    const axis = world(a, 'rotate')
    const t0 = world(a, 'teeth').sub(axis)
    const t180 = world(posed({ rotate: 180 }), 'teeth').sub(axis)
    expect(t180.x).toBeCloseTo(-t0.x, 6)
    expect(t180.z).toBeCloseTo(-t0.z, 6)
    expect(t180.y).toBeCloseTo(t0.y, 6)
  })

  it('tilting leans the bucket sideways without moving it fore and aft', () => {
    const t0 = world(posed(), 'teeth')
    const tilted = world(posed({ tilt: 30 }), 'teeth')
    expect(Math.abs(tilted.z - t0.z)).toBeGreaterThan(0.3)
    expect(tilted.x).toBeCloseTo(t0.x, 6)
  })
})
