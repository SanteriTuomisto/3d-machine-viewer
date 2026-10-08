import type { JointSpec } from '@/machines/types'

export const RESET_KEY = 'KeyR'

/** Degrees per second per joint for the keys currently held. */
export function velocitiesFor(
  held: ReadonlySet<string>,
  joints: readonly JointSpec[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const j of joints) {
    const pos = held.has(j.keys.positive)
    const neg = held.has(j.keys.negative)
    if (!pos && !neg) continue
    out[j.name] = (pos ? j.speed : 0) - (neg ? j.speed : 0)
  }
  return out
}

export function isBoundKey(code: string, joints: readonly JointSpec[]) {
  return joints.some((j) => j.keys.positive === code || j.keys.negative === code)
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  // jsdom does not implement isContentEditable, so check the attribute too.
  return target.isContentEditable === true || target.getAttribute('contenteditable') === 'true'
}
