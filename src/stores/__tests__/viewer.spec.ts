import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useViewerStore } from '@/stores/viewer'

describe('viewer store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('has sensible defaults', () => {
    const s = useViewerStore()
    expect(s.showGrid).toBe(true)
    expect(s.autoRotate).toBe(false)
    expect(s.resetRequested).toBe(0)
  })

  it('toggles grid and auto-rotate', () => {
    const s = useViewerStore()
    s.toggleGrid()
    s.toggleAutoRotate()
    expect(s.showGrid).toBe(false)
    expect(s.autoRotate).toBe(true)
  })

  it('requestReset increments a counter so watchers fire every time', () => {
    const s = useViewerStore()
    s.requestReset()
    s.requestReset()
    expect(s.resetRequested).toBe(2)
  })
})
