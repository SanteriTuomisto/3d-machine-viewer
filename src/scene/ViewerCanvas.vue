<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three'
import { SceneHost } from '@/engine/SceneHost'
import { addDefaultLights } from '@/engine/lights'

const container = ref<HTMLDivElement | null>(null)
let host: SceneHost | null = null

onMounted(() => {
  if (!container.value) return
  host = new SceneHost(container.value, { cameraStart: [8, 5, 10], target: [0, 1.5, 0] })
  addDefaultLights(host.scene)

  // Temporary: replaced by the machine in Task 5.
  const cube = new Mesh(new BoxGeometry(2, 1, 1), new MeshStandardMaterial({ color: 0xf2b705 }))
  cube.position.set(0, 1.5, 0)
  host.scene.add(cube)

  host.start()
})

onBeforeUnmount(() => {
  host?.dispose()
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
