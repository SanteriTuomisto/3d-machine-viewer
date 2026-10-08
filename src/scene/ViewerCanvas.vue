<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SceneHost } from '@/engine/SceneHost'
import { addDefaultLights } from '@/engine/lights'
import type { BuiltMachine } from '@/machines/types'
import { useViewerStore } from '@/stores/viewer'
import { useMachineStore } from '@/stores/machine'

const container = ref<HTMLDivElement | null>(null)
const viewer = useViewerStore()
const machine = useMachineStore()
let host: SceneHost | null = null
let built: BuiltMachine | null = null

/** Copies the store's joint angles into the machine's pivot groups. */
function applyPose() {
  if (!built) return
  const rad = machine.jointsRad
  for (const spec of machine.definition.joints) {
    const pivotGroup = built.pivots[spec.name]
    if (pivotGroup) pivotGroup.rotation[spec.axis] = rad[spec.name] ?? 0
  }
}

onMounted(() => {
  if (!container.value) return
  const def = machine.definition
  host = new SceneHost(container.value, { cameraStart: def.cameraStart, target: def.center })
  addDefaultLights(host.scene)
  host.setGridVisible(viewer.showGrid)
  host.setAutoRotate(viewer.autoRotate)

  built = def.build()
  host.scene.add(built.root)
  applyPose()

  host.onFrame(() => {
    applyPose()
  })
  host.start()
})

watch(
  () => viewer.showGrid,
  (v) => host?.setGridVisible(v),
)
watch(
  () => viewer.autoRotate,
  (v) => host?.setAutoRotate(v),
)
watch(
  () => viewer.resetRequested,
  () => host?.resetView(),
)

onBeforeUnmount(() => {
  built?.dispose()
  host?.dispose()
  built = null
  host = null
})
</script>

<template>
  <div ref="container" class="canvas-host" />
</template>

<style scoped>
.canvas-host {
  position: fixed;
  inset: 0;
}
</style>
