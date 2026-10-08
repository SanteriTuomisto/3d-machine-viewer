<script setup lang="ts">
import { useViewerStore } from '@/stores/viewer'
const viewer = useViewerStore()
</script>

<template>
  <div class="hud">
    <h1>3D Machine Viewer</h1>
    <div class="row">
      <button type="button" @click="viewer.requestReset()">Reset view</button>
      <label>
        <input type="checkbox" :checked="viewer.showGrid" @change="viewer.toggleGrid()" /> Grid
      </label>
      <label>
        <input
          type="checkbox"
          :checked="viewer.autoRotate"
          @change="viewer.toggleAutoRotate()"
        />
        Auto-rotate
      </label>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.hud {
  position: fixed;
  top: 12px;
  left: 12px;
  padding: 10px 14px;
  background: rgba(15, 20, 30, 0.75);
  border-radius: 8px;
  backdrop-filter: blur(6px);
  user-select: none;
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
}
h1 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}
.row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
button {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #4a5568;
  background: #2d3748;
  color: inherit;
  cursor: pointer;
}
</style>
