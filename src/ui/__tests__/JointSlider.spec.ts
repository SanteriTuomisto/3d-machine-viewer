import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import JointSlider from '@/ui/JointSlider.vue'
import { EXCAVATOR_JOINTS } from '@/machines/excavator/joints'

function sliderFor(name: string) {
  const spec = EXCAVATOR_JOINTS.find((j) => j.name === name)!
  const wrapper = mount(JointSlider, { props: { spec }, global: { plugins: [createPinia()] } })
  return wrapper.get('input[type="range"]')
}

describe('JointSlider', () => {
  it('a wrapping joint cannot reach -180, which the store stores as +180 (thumb would jump)', () => {
    const input = sliderFor('swing')
    expect(input.attributes('min')).toBe('-179')
    expect(input.attributes('max')).toBe('180')
  })

  it('a limited joint uses its own limits', () => {
    const input = sliderFor('boom')
    expect(input.attributes('min')).toBe('-35')
    expect(input.attributes('max')).toBe('55')
  })
})
