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

/** Short cylinder along Z, centred on the pivot it decorates. */
function pin(length: number, mat: Material) {
  const m = new Mesh(new CylinderGeometry(DIM.pinRadius, DIM.pinRadius, length, 16), mat)
  m.rotation.x = Math.PI / 2
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

  // Bucket: pivot at top-back, opens toward +X, hangs toward -Y.
  const bucket = pivot('bucket', st.length, 0, 0)
  stick.add(bucket)
  const b = DIM.bucket
  const p = b.plate
  bucket.add(pin(b.width + 0.2, mat.steel))
  bucket.add(box(p, b.height, b.width, mat.steel, p / 2, -b.height / 2, 0)) // back
  bucket.add(box(b.depth, p, b.width, mat.steel, b.depth / 2, -b.height + p / 2, 0)) // bottom
  for (const z of [-b.width / 2, b.width / 2]) {
    bucket.add(box(b.depth, b.height, p, mat.steel, b.depth / 2, -b.height / 2, z)) // sides
  }
  for (const z of [-b.width / 3, 0, b.width / 3]) {
    bucket.add(box(0.2, 0.06, 0.08, mat.tooth, b.depth + 0.1, -b.height + p / 2, z)) // teeth
  }

  return {
    root,
    pivots: { swing, boom, stick, bucket },
    dispose() {
      root.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose()
      })
      for (const m of Object.values(mat)) m.dispose()
    },
  }
}
