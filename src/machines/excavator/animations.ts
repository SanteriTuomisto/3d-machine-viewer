import type { Keyframe } from '@/machines/types'

/** Reach out and open, lower, drag in and curl, lift, swing, dump, return. Seconds / degrees. */
export const DIG_CYCLE: Keyframe[] = [
  { t: 0.0, joints: { swing: 0, boom: 30, stick: -60, bucket: 30 } },
  { t: 1.5, joints: { swing: 0, boom: 10, stick: -30, bucket: -40 } },
  { t: 2.5, joints: { swing: 0, boom: -20, stick: -40, bucket: -30 } },
  { t: 4.5, joints: { swing: 0, boom: -10, stick: -110, bucket: 100 } },
  { t: 6.0, joints: { swing: 0, boom: 40, stick: -100, bucket: 110 } },
  { t: 8.0, joints: { swing: 90, boom: 45, stick: -80, bucket: 110 } },
  { t: 9.0, joints: { swing: 90, boom: 45, stick: -60, bucket: -50 } },
  { t: 11.0, joints: { swing: 0, boom: 30, stick: -60, bucket: 30 } },
]
