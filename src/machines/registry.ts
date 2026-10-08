import type { MachineDefinition } from './types'
import { excavator } from './excavator'

export const DEFAULT_MACHINE_ID = 'excavator'

export const MACHINES: Record<string, MachineDefinition> = {
  [excavator.id]: excavator,
}

export function getMachine(id: string): MachineDefinition {
  const m = MACHINES[id]
  if (!m) throw new Error(`Unknown machine "${id}"`)
  return m
}
