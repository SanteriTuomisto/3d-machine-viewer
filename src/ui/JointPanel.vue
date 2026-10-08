<script setup lang="ts">
import JointSlider from './JointSlider.vue'
import { useMachineStore } from '@/stores/machine'
const machine = useMachineStore()
</script>

<template>
  <div class="panel">
    <JointSlider v-for="spec in machine.definition.joints" :key="spec.name" :spec="spec" />
    <div class="row">
      <button type="button" @click="machine.resetJoints()">Reset arm</button>
    </div>
  </div>
</template>

<style scoped>
.panel {
  margin-top: 10px;
  display: grid;
  gap: 6px;
  min-width: 260px;
}
.row {
  display: flex;
  gap: 8px;
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
