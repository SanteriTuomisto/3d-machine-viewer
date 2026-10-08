import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Material,
} from 'three'
import type { BuiltMachine } from '@/machines/types'
import { DIM, boomSegmentMidpoints, boomTip } from './dimensions'
import { COLORS } from './colors'

function makeMaterials() {
  return {
    paint: new MeshStandardMaterial({ color: COLORS.paint }),
    steel: new MeshStandardMaterial({ color: COLORS.steel }),
    track: new MeshStandardMaterial({ color: COLORS.track }),
    glass: new MeshStandardMaterial({ color: COLORS.glass, transparent: true, opacity: 0.75 }),
    tooth: new MeshStandardMaterial({ color: COLORS.tooth }),
  }
}

function box(w: number, h: number, d: number, mat: Material, x: number, y: number, z: number) {
  const m = new Mesh(new BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  return m
}

/** Short cylinder centred on the pivot it decorates, along Z (arm hinges) or X (tilt). */
function pin(length: number, mat: Material, along: 'x' | 'z' = 'z', radius: number = DIM.pinRadius) {
  const m = new Mesh(new CylinderGeometry(radius, radius, length, 16), mat)
  if (along === 'z') m.rotation.x = Math.PI / 2
  else m.rotation.z = Math.PI / 2
  return m
}

function pivot(name: string, x: number, y: number, z: number) {
  const g = new Group()
  g.name = name
  g.position.set(x, y, z)
  return g
}

export function buildExcavator(): BuiltMachine {
  const mat = makeMaterials()
  const root = new Group()
  root.name = 'excavator'

  // Undercarriage: two tracks and the centre frame. Track bottoms sit on y = 0.
  const t = DIM.track
  for (const z of [-t.centerZ, t.centerZ]) {
    root.add(box(t.length, t.height, t.width, mat.track, 0, t.height / 2, z))
  }
  const f = DIM.frame
  root.add(box(f.length, f.height, f.width, mat.steel, 0, f.y, 0))

  // House (swing pivot).
  const swing = pivot('swing', 0, DIM.swingY, 0)
  root.add(swing)
  const h = DIM.house
  const c = DIM.cabin
  const w = DIM.counterweight
  const e = DIM.exhaust
  swing.add(box(h.length, h.height, h.width, mat.paint, h.centerX, h.height / 2, 0))
  swing.add(box(c.length, c.height, c.width, mat.glass, c.x, h.height + c.height / 2 - 0.2, c.z))
  swing.add(box(w.length, w.height, w.width, mat.steel, w.x, w.height / 2, 0))
  const exhaust = new Mesh(new CylinderGeometry(e.radius, e.radius, e.height, 12), mat.steel)
  exhaust.position.set(e.x, h.height + e.height / 2, e.z)
  swing.add(exhaust)

  // Boom (two angled segments).
  const bp = DIM.boomPivot
  const boom = pivot('boom', bp.x, bp.y, bp.z)
  swing.add(boom)
  const bt = DIM.boom.thickness
  boom.add(pin(bt + 0.3, mat.steel))
  for (const s of boomSegmentMidpoints()) {
    const seg = box(s.length, bt, bt, mat.paint, s.x, s.y, 0)
    seg.rotation.z = s.angleRad
    boom.add(seg)
  }

  // Stick.
  const tip = boomTip()
  const stick = pivot('stick', tip.x, tip.y, 0)
  boom.add(stick)
  const st = DIM.stick
  stick.add(pin(st.thickness + 0.3, mat.steel))
  stick.add(box(st.length, st.thickness, st.thickness, mat.paint, st.length / 2, 0, 0))

  // Bucket curl pivot at the stick tip. Everything below hangs along this pivot's -Y.
  const bucket = pivot('bucket', st.length, 0, 0)
  stick.add(bucket)
  const tr = DIM.tiltrotator
  bucket.add(pin(tr.width + 0.2, mat.steel))
  bucket.add(box(tr.depth, tr.bracketHeight, tr.width, mat.steel, 0, -tr.bracketHeight / 2, 0))

  // Tiltrotator: tilt leans the attachment sideways (about X), rotate spins it about its own axis.
  const tilt = pivot('tilt', 0, -tr.tiltDrop, 0)
  bucket.add(tilt)
  tilt.add(pin(tr.depth + 0.15, mat.steel, 'x', 0.09))
  const rotate = pivot('rotate', 0, -tr.rotateDrop, 0)
  tilt.add(rotate)
  const ring = new Mesh(
    new CylinderGeometry(tr.ringRadius, tr.ringRadius, tr.ringHeight, 24),
    mat.track,
  )
  ring.position.y = -tr.ringHeight / 2
  rotate.add(ring)
  const couplerY = -tr.ringHeight - tr.couplerHeight / 2
  rotate.add(box(tr.couplerSize, tr.couplerHeight, tr.couplerSize, mat.steel, 0, couplerY, 0))

  // Backhoe bucket under the coupler, centred on the rotator axis, mouth facing -X.
  const b = DIM.bucket
  const p = b.plate
  const top = -tr.ringHeight - tr.couplerHeight
  const midY = top - b.height / 2
  const bottomY = top - b.height + p / 2
  rotate.add(box(p, b.height, b.width, mat.steel, b.depth / 2 - p / 2, midY, 0)) // back
  rotate.add(box(b.depth, p, b.width, mat.steel, 0, bottomY, 0)) // bottom
  rotate.add(box(b.depth * 0.6, p, b.width, mat.steel, b.depth * 0.2, top - p / 2, 0)) // top
  for (const z of [-b.width / 2, b.width / 2]) {
    rotate.add(box(b.depth, b.height, p, mat.steel, 0, midY, z)) // sides
  }
  const teeth = new Group()
  teeth.name = 'teeth'
  teeth.position.set(-b.depth / 2 - 0.1, bottomY, 0)
  for (const z of [-b.width / 3, 0, b.width / 3]) {
    teeth.add(box(0.2, 0.06, 0.08, mat.tooth, 0, 0, z))
  }
  rotate.add(teeth)

  return {
    root,
    pivots: { swing, boom, stick, bucket, tilt, rotate },
    dispose() {
      root.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose()
      })
      for (const m of Object.values(mat)) m.dispose()
    },
  }
}
