<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SceneHost } from '@/engine/SceneHost'
import { addDefaultLights } from '@/engine/lights'
import { getMachine, DEFAULT_MACHINE_ID } from '@/machines/registry'
import type { BuiltMachine } from '@/machines/types'
import { degToRad } from '@/joints/jointMath'

const container = ref<HTMLDivElement | null>(null)
let host: SceneHost | null = null
let built: BuiltMachine | null = null

onMounted(() => {
  if (!container.value) return
  const def = getMachine(DEFAULT_MACHINE_ID)
  host = new SceneHost(container.value, { cameraStart: def.cameraStart, target: def.center })
  addDefaultLights(host.scene)

  built = def.build()
  for (const spec of def.joints) {
    const p = built.pivots[spec.name]
    if (p) p.rotation[spec.axis] = degToRad(spec.rest)
  }
  host.scene.add(built.root)

  host.start()
})

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
