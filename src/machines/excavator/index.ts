import type { MachineDefinition } from '@/machines/types'
import { EXCAVATOR_JOINTS } from './joints'
import { buildExcavator } from './build'
import { MACHINE_CENTER, CAMERA_START } from './dimensions'
import { DIG_CYCLE } from './animations'

export const excavator: MachineDefinition = {
  id: 'excavator',
  label: 'Excavator',
  joints: EXCAVATOR_JOINTS,
  center: MACHINE_CENTER,
  cameraStart: CAMERA_START,
  build: buildExcavator,
  animations: { dig: DIG_CYCLE },
}
