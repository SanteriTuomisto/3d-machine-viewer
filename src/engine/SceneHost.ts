import { Color, GridHelper, PerspectiveCamera, Scene, Timer, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export const MAX_FRAME_DELTA = 0.1

export type FrameCallback = (delta: number) => void

export interface SceneHostOptions {
  cameraStart: readonly [number, number, number]
  target: readonly [number, number, number]
  background?: string
}

/** Owns renderer, camera, controls, grid and the render loop. No machine knowledge. */
export class SceneHost {
  readonly renderer: WebGLRenderer
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly controls: OrbitControls
  readonly grid: GridHelper

  private readonly timer = new Timer()
  private readonly callbacks: FrameCallback[] = []
  private readonly observer: ResizeObserver
  private rafId = 0

  constructor(
    private readonly container: HTMLElement,
    opts: SceneHostOptions,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.domElement.style.display = 'block'
    container.appendChild(this.renderer.domElement)

    this.scene = new Scene()
    this.scene.background = new Color(opts.background ?? '#1b2430')

    this.camera = new PerspectiveCamera(45, 1, 0.1, 200)
    this.camera.position.set(...opts.cameraStart)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(...opts.target)
    this.controls.enablePan = false
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 4
    this.controls.maxDistance = 40
    this.controls.minPolarAngle = 0
    this.controls.maxPolarAngle = Math.PI
    this.controls.autoRotateSpeed = 1.5
    this.controls.update()
    this.controls.saveState()

    this.grid = new GridHelper(20, 20, 0x5a6a85, 0x2f3a4d)
    this.scene.add(this.grid)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(container)
    this.resize()
  }

  onFrame(cb: FrameCallback): () => void {
    this.callbacks.push(cb)
    return () => {
      const i = this.callbacks.indexOf(cb)
      if (i >= 0) this.callbacks.splice(i, 1)
    }
  }

  setGridVisible(visible: boolean) {
    this.grid.visible = visible
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on
  }

  resetView() {
    this.controls.reset()
  }

  start() {
    if (this.rafId) return
    this.timer.reset()
    const tick = (timestamp?: number) => {
      this.rafId = requestAnimationFrame(tick)
      this.timer.update(timestamp)
      const delta = Math.min(this.timer.getDelta(), MAX_FRAME_DELTA)
      for (const cb of this.callbacks) cb(delta)
      this.controls.update(delta)
      this.renderer.render(this.scene, this.camera)
    }
    tick()
  }

  stop() {
    if (!this.rafId) return
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  dispose() {
    this.stop()
    this.observer.disconnect()
    this.timer.dispose()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }
}
