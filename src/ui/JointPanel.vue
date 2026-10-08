<script setup lang="ts">
import JointSlider from './JointSlider.vue'
import { useMachineStore } from '@/stores/machine'
const machine = useMachineStore()

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}
function keyLabel(code: string) {
  return KEY_LABELS[code] ?? code.replace(/^Key/, '')
}
</script>

<template>
  <div class="panel">
    <JointSlider v-for="spec in machine.definition.joints" :key="spec.name" :spec="spec" />
    <div class="row">
      <button type="button" @click="machine.resetJoints()">Reset arm</button>
      <button
        v-for="name in Object.keys(machine.definition.animations)"
        :key="name"
        type="button"
        @click="machine.playing === name ? machine.stop() : machine.play(name)"
      >
        {{ machine.playing === name ? 'Stop' : name.charAt(0).toUpperCase() + name.slice(1) }}
      </button>
    </div>
    <p class="keys">
      <span v-for="spec in machine.definition.joints" :key="spec.name">
        {{ keyLabel(spec.keys.positive) }}/{{ keyLabel(spec.keys.negative) }}
        {{ spec.label.toLowerCase() }} ·
      </span>
      R reset
    </p>
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
.keys {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.7;
}
</style>
