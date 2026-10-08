import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { useKeyboardJoints } from '@/input/useKeyboardJoints'
import { useMachineStore } from '@/stores/machine'

let pinia: Pinia
let wrapper: VueWrapper
let step: (delta: number) => void

const Harness = defineComponent({
  setup() {
    step = useKeyboardJoints().step
    return () => h('div')
  },
})

function keydown(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
}

describe('useKeyboardJoints', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    wrapper = mount(Harness, { global: { plugins: [pinia] }, attachTo: document.body })
  })
  afterEach(() => wrapper.unmount())

  it('a held joint key nudges its joint', () => {
    keydown({ code: 'KeyA' })
    step(1)
    expect(useMachineStore().joints.swing).toBe(40)
  })

  it('ignores joint keys pressed with Cmd, Ctrl or Alt (no keyup arrives on macOS)', () => {
    keydown({ code: 'KeyA', metaKey: true })
    keydown({ code: 'KeyD', ctrlKey: true })
    keydown({ code: 'KeyS', altKey: true })
    step(1)
    const s = useMachineStore()
    expect(s.joints.swing).toBe(0)
    expect(s.joints.boom).toBe(30)
  })
})
