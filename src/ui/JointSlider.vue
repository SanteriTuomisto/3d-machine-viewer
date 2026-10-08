<script setup lang="ts">
import { computed } from 'vue'
import { useMachineStore } from '@/stores/machine'
import type { JointSpec } from '@/machines/types'

const props = defineProps<{ spec: JointSpec }>()
const machine = useMachineStore()

const range = computed(() =>
  props.spec.wrap ? { min: -180, max: 180 } : { min: props.spec.min, max: props.spec.max },
)
const value = computed(() => machine.joints[props.spec.name] ?? props.spec.rest)

function onInput(e: Event) {
  machine.stop()
  machine.setJoint(props.spec.name, Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <label class="slider">
    <span class="label">{{ spec.label }}</span>
    <input
      type="range"
      :min="range.min"
      :max="range.max"
      step="1"
      :value="value"
      @input="onInput"
    />
    <span class="value">{{ Math.round(value) }}°</span>
  </label>
</template>

<style scoped>
.slider {
  display: grid;
  grid-template-columns: 56px 1fr 44px;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}
.value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
