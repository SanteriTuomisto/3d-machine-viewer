import { describe, it, expect } from 'vitest'
import { Mesh, Vector3, type Object3D } from 'three'
import { buildExcavator } from '../build'
import { EXCAVATOR_JOINTS } from '../joints'
import { DIM, boomTip } from '../dimensions'

function pivot(pivots: Record<string, Object3D>, name: string): Object3D {
  const p = pivots[name]
  if (!p) throw new Error(`missing pivot ${name}`)
  return p
}

function bucketWorld(swingRad: number) {
  const built = buildExcavator()
  pivot(built.pivots, 'swing').rotation.y = swingRad
  built.root.updateMatrixWorld(true)
  return pivot(built.pivots, 'bucket').getWorldPosition(new Vector3())
}

describe('buildExcavator', () => {
  it('has a named pivot for every joint spec', () => {
    const built = buildExcavator()
    for (const j of EXCAVATOR_JOINTS) {
      expect(built.pivots).toHaveProperty(j.name)
      expect(pivot(built.pivots, j.name).name).toBe(j.name)
    }
  })

  it('bucket pivot at zero angles sits at the summed offsets', () => {
    const tip = boomTip()
    const p = bucketWorld(0)
    expect(p.x).toBeCloseTo(DIM.boomPivot.x + tip.x + DIM.stick.length, 6)
    expect(p.y).toBeCloseTo(DIM.swingY + DIM.boomPivot.y + tip.y, 6)
    expect(p.z).toBeCloseTo(DIM.boomPivot.z, 6)
  })

  it('a 180° swing mirrors the bucket pivot in x and z but not y', () => {
    const a = bucketWorld(0)
    const b = bucketWorld(Math.PI)
    expect(b.x).toBeCloseTo(-a.x, 6)
    expect(b.z).toBeCloseTo(-a.z, 6)
    expect(b.y).toBeCloseTo(a.y, 6)
  })

  it('stick and bucket are descendants of the boom, which is a descendant of swing', () => {
    const built = buildExcavator()
    const p = (n: string) => pivot(built.pivots, n)
    expect(p('boom').parent).toBe(p('swing'))
    expect(p('stick').parent).toBe(p('boom'))
    expect(p('bucket').parent).toBe(p('stick'))
    expect(p('swing').parent).toBe(built.root)
  })

  it('contains meshes and disposes without throwing', () => {
    const built = buildExcavator()
    let meshes = 0
    built.root.traverse((o) => {
      if (o instanceof Mesh) meshes++
    })
    expect(meshes).toBeGreaterThan(10)
    expect(() => built.dispose()).not.toThrow()
  })
})
