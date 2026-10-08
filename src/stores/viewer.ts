import { defineStore } from 'pinia'

export const useViewerStore = defineStore('viewer', {
  state: () => ({
    showGrid: true,
    autoRotate: false,
    resetRequested: 0,
  }),
  actions: {
    toggleGrid() {
      this.showGrid = !this.showGrid
    },
    toggleAutoRotate() {
      this.autoRotate = !this.autoRotate
    },
    requestReset() {
      this.resetRequested++
    },
  },
})
