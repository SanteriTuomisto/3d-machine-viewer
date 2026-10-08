/** All lengths in metres. Machine faces +X, up is +Y. */
export const DIM = {
  track: { length: 4.4, width: 0.6, height: 0.9, centerZ: 1.1 },
  frame: { length: 2.4, width: 1.6, height: 0.5, y: 0.7 },
  /** Height of the swing bearing (house pivot) above the ground. */
  swingY: 0.95,
  house: { length: 3.2, width: 2.6, height: 0.9, centerX: -0.3 },
  cabin: { length: 1.4, width: 1.0, height: 1.3, x: 0.7, z: -0.75 },
  counterweight: { length: 0.6, width: 2.6, height: 1.0, x: -2.2 },
  exhaust: { radius: 0.08, height: 0.5, x: -1.2, z: 0.6 },
  /** Boom pivot relative to the house pivot. */
  boomPivot: { x: 1.3, y: 0.7, z: 0.45 },
  boom: { thickness: 0.45 },
  stick: { length: 2.9, thickness: 0.35 },
  bucket: { width: 1.2, depth: 0.9, height: 0.8, plate: 0.08 },
  pinRadius: 0.2,
} as const

/** Gooseneck boom: segment A rises, segment B drops back toward horizontal. */
export const BOOM_SEGMENTS = [
  { length: 3.2, angleDeg: 20 },
  { length: 2.6, angleDeg: -20 },
] as const

export const MACHINE_CENTER = [0, 1.5, 0] as const
export const CAMERA_START = [8, 5, 10] as const

const toRad = (deg: number) => (deg * Math.PI) / 180

export function boomSegmentMidpoints() {
  let x = 0
  let y = 0
  return BOOM_SEGMENTS.map((seg) => {
    const angleRad = toRad(seg.angleDeg)
    const mid = {
      x: x + (seg.length / 2) * Math.cos(angleRad),
      y: y + (seg.length / 2) * Math.sin(angleRad),
      angleRad,
      length: seg.length,
    }
    x += seg.length * Math.cos(angleRad)
    y += seg.length * Math.sin(angleRad)
    return mid
  })
}

export function boomTip() {
  return BOOM_SEGMENTS.reduce(
    (acc, seg) => ({
      x: acc.x + seg.length * Math.cos(toRad(seg.angleDeg)),
      y: acc.y + seg.length * Math.sin(toRad(seg.angleDeg)),
    }),
    { x: 0, y: 0 },
  )
}
