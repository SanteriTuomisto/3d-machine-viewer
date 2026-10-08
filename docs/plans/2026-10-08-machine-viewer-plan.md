# 3D Machine Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vue app showing a primitive-built excavator at the origin that the user can orbit and zoom around (Phase 1), then swing the house and move boom/stick/bucket with keyboard, sliders and a canned dig cycle (Phase 2), with the excavator being the first of possibly several machines.

**Architecture:** Plain three.js. A `SceneHost` class owns renderer, camera, OrbitControls and the render loop; one Vue component mounts it. Each machine is a `MachineDefinition` (joint specs, a `build()` that returns an `Object3D` tree plus named pivot groups, keyframe animations). Generic Pinia stores, HUD and keyboard code only ever see that interface. Everything outside `SceneHost` and the Vue components is pure TypeScript with Vitest tests; three.js `Object3D` trees are tested in Node without a GPU.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, three.js (0.18x, `three/addons` for OrbitControls), Vitest with jsdom, pnpm, Node 22.

**Spec:** `docs/specs/2026-10-08-machine-viewer-design.md`

## Global Constraints

- Project root: `~/Documents/3d-machine-viewer` (already contains `docs/`; do not let the scaffolder wipe it, see Task 1).
- Node 22 via nvm. In Claude Code's non-interactive shell prepend it first: `export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH"`. Use `/bin/ls`, not `ls`.
- pnpm. TypeScript `strict` (create-vue default). ESLint + Prettier from the scaffold; run `pnpm lint` before each commit.
- No TresJS. OrbitControls imported from `three/addons/controls/OrbitControls.js`.
- Coordinate convention (spec §4.3): machine faces +X, up is +Y, arm hinges rotate about local Z, swing about Y. Store angles are **degrees**; the scene gets **radians** via `jointsRad`.
- Excavator joints (spec §5.1): swing wraps to (−180, 180]; boom −35…+55; stick −140…−20; bucket −60…+120. Rest: 0 / +30 / −60 / +30. Speeds 40 / 25 / 35 / 60 deg/s. Keys: A/D, S/W, ↑/↓, ←/→; R resets.
- Camera (spec §4.1): fov 45, start (8, 5, 10), target (0, 1.5, 0), pan off, damping 0.08, distance 4…40, polar 0…π. `MAX_FRAME_DELTA = 0.1` s.
- No physics, no backend. No WebGL in tests.
- Commit after every task. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` when Claude makes the commit.

## Review Focus

1. **Window resize** — canvas must fill the container without a stretched image. Owned by `SceneHost.resize()` through a `ResizeObserver`; verified manually in Task 2 (no WebGL in tests).
2. **Keyboard while a slider has focus** — arrows must not both move the slider and nudge a joint. Pinned by `isEditableTarget` tests in Task 9.
3. **Swing past ±180°** — must wrap, never clamp. Pinned by `wrapDeg`/`applyLimit` tests in Task 4 and a store test in Task 7.
4. **Non-numeric slider input** — `setJoint(NaN)` leaves the joint unchanged. Pinned by a store test in Task 7.
5. **Huge frame delta** after a backgrounded tab — `SceneHost` clamps delta; the animation ends exactly on its last frame. Pinned by a store test in Task 10. Keys held when the window loses focus are released on `blur` (Task 9, manual).

---

## Phase 1 — Static viewer

### Task 1: Scaffold into the existing folder

**Files:**
- Create: Vue scaffold in `~/Documents/3d-machine-viewer/` (merged next to the existing `docs/`)
- Modify: `src/main.ts`, `src/App.vue`, `src/assets/main.css`
- Delete: `src/components/`, `src/stores/counter.ts`, `src/assets/base.css`, `src/assets/logo.svg`

**Interfaces:**
- Produces: `pnpm dev`, `pnpm vitest run`, `pnpm type-check`, `pnpm lint`, `pnpm build` all working.

- [ ] **Step 1: Scaffold into a sibling folder, then merge (never run create-vue in the non-empty project folder; it offers to delete everything)**

```bash
export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH"
cd ~/Documents
pnpm create vue@latest 3d-machine-viewer-scaffold --typescript --pinia --vitest --eslint --prettier
rsync -a 3d-machine-viewer-scaffold/ 3d-machine-viewer/
rm -rf 3d-machine-viewer-scaffold
cd 3d-machine-viewer
/bin/ls -la            # expect docs/ still present next to package.json, src/, .gitignore
pnpm install
```

If create-vue rejects a flag, run it without flags and answer: TypeScript yes, JSX no, Router no, Pinia yes, Vitest yes, end-to-end no, ESLint yes, Prettier yes.

- [ ] **Step 2: Add three.js**

```bash
pnpm add three
pnpm add -D @types/three
```

- [ ] **Step 3: Remove scaffold samples and set the shell**

```bash
rm -rf src/components src/stores/counter.ts src/assets/base.css src/assets/logo.svg
```

`src/assets/main.css`:

```css
html,
body,
#app {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: #1b2430;
  font-family: system-ui, sans-serif;
  color: #e2e8f0;
}
```

`src/main.ts`:

```ts
import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
```

`src/App.vue`:

```vue
<script setup lang="ts"></script>

<template>
  <p style="padding: 16px">3D Machine Viewer — scaffold ok</p>
</template>
```

- [ ] **Step 4: Verify every script runs**

```bash
pnpm lint && pnpm type-check && pnpm vitest run && pnpm build
```

Expected: lint and type-check clean, Vitest "No test files found" with exit 0 (if it exits 1, add `passWithNoTests: true` under `test` in `vitest.config.ts`), `dist/` produced. `pnpm dev` shows the text.

- [ ] **Step 5: Commit the scaffold (git and the `origin` remote already exist; the docs are already committed)**

```bash
git add -A
git commit -m "chore: scaffold Vue + three.js machine viewer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```

---

### Task 2: SceneHost and ViewerCanvas with a test cube

**Files:**
- Create: `src/engine/SceneHost.ts`, `src/engine/lights.ts`, `src/scene/ViewerCanvas.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Produces:
  - `MAX_FRAME_DELTA = 0.1`
  - `class SceneHost` with `constructor(container: HTMLElement, opts: SceneHostOptions)`, `readonly scene`, `readonly camera`, `readonly controls`, `onFrame(cb: (delta: number) => void): () => void`, `setGridVisible(v: boolean)`, `setAutoRotate(v: boolean)`, `resetView()`, `start()`, `stop()`, `dispose()`.
  - `SceneHostOptions = { cameraStart: readonly [number, number, number]; target: readonly [number, number, number]; background?: string }`
  - `addDefaultLights(scene: Scene): void`

- [ ] **Step 1: Write SceneHost.ts**

```ts
import { Clock, Color, GridHelper, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
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

  private readonly clock = new Clock(false)
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
    this.clock.start()
    const tick = () => {
      this.rafId = requestAnimationFrame(tick)
      const delta = Math.min(this.clock.getDelta(), MAX_FRAME_DELTA)
      for (const cb of this.callbacks) cb(delta)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    tick()
  }

  stop() {
    if (!this.rafId) return
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.clock.stop()
  }

  dispose() {
    this.stop()
    this.observer.disconnect()
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
```

- [ ] **Step 2: Write lights.ts**

```ts
import { AmbientLight, DirectionalLight, type Scene } from 'three'

export function addDefaultLights(scene: Scene) {
  scene.add(new AmbientLight(0xffffff, 0.35))
  const key = new DirectionalLight(0xffffff, 1.6)
  key.position.set(6, 10, 8)
  scene.add(key)
  const fill = new DirectionalLight(0xffffff, 0.5)
  fill.position.set(-6, -4, -8)
  scene.add(fill)
}
```

- [ ] **Step 3: Write ViewerCanvas.vue with a temporary cube**

```vue
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
```

- [ ] **Step 4: Mount it**

`src/App.vue`:

```vue
<script setup lang="ts">
import ViewerCanvas from '@/scene/ViewerCanvas.vue'
</script>

<template>
  <ViewerCanvas />
</template>
```

- [ ] **Step 5: Verify in the browser**

Run: `pnpm dev`
Check:
- Yellow box above a grid. Drag orbits the full sphere, including from below. Scroll zoom stops at a near and a far limit. Right-drag does not pan.
- Resize the window: no stretching, no letterboxing, canvas always full-screen.
- Release the mouse mid-drag: the orbit eases out (damping works, so `controls.update()` runs each frame).
- Console has no errors. If `three/addons/...` fails to resolve for TypeScript, use `three/examples/jsm/controls/OrbitControls.js` instead and note it in the spec.

- [ ] **Step 6: Commit**

```bash
pnpm lint && pnpm type-check
git add src/engine src/scene src/App.vue
git commit -m "feat: SceneHost with orbit camera, lights, grid and render loop

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Viewer store

**Files:**
- Create: `src/stores/viewer.ts`
- Test: `src/stores/__tests__/viewer.spec.ts`

**Interfaces:**
- Produces: `useViewerStore()` with state `showGrid` (true), `autoRotate` (false), `resetRequested` (0); actions `toggleGrid()`, `toggleAutoRotate()`, `requestReset()`.

- [ ] **Step 1: Write the failing test**

`src/stores/__tests__/viewer.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/stores/__tests__/viewer.spec.ts`
Expected: FAIL, cannot resolve `@/stores/viewer`.

- [ ] **Step 3: Write the store**

`src/stores/viewer.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/stores/__tests__/viewer.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores
git commit -m "feat: viewer store for grid, auto-rotate and camera reset

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Machine types and joint maths

**Files:**
- Create: `src/machines/types.ts`, `src/joints/jointMath.ts`
- Test: `src/joints/__tests__/jointMath.spec.ts`

**Interfaces:**
- Produces (types): `JointSpec`, `Keyframe`, `BuiltMachine`, `MachineDefinition` exactly as in spec §3.1.
- Produces (functions): `clamp(v, min, max)`, `wrapDeg(deg)` → (−180, 180], `applyLimit(spec: JointSpec, deg: number)`, `restPose(joints: readonly JointSpec[]): Record<string, number>`, `smoothstep(t)`, `degToRad(deg)`.

- [ ] **Step 1: Write types.ts**

```ts
import type { Object3D } from 'three'

export interface JointSpec {
  /** Key into BuiltMachine.pivots and the machine store's joints map. */
  name: string
  label: string
  /** Local rotation axis of the pivot group. */
  axis: 'x' | 'y' | 'z'
  /** Degrees. Ignored when wrap is true. */
  min: number
  max: number
  /** Unbounded joint, normalised to (-180, 180]. */
  wrap?: boolean
  /** Degrees. */
  rest: number
  /** Degrees per second while a key is held. */
  speed: number
  /** KeyboardEvent.code values. */
  keys: { positive: string; negative: string }
}

export interface Keyframe {
  /** Seconds from animation start. */
  t: number
  /** Degrees per joint name. Every frame lists every joint. */
  joints: Record<string, number>
}

export interface BuiltMachine {
  root: Object3D
  /** One pivot group per JointSpec.name. */
  pivots: Record<string, Object3D>
  dispose(): void
}

export interface MachineDefinition {
  id: string
  label: string
  joints: readonly JointSpec[]
  /** Orbit target. */
  center: readonly [number, number, number]
  cameraStart: readonly [number, number, number]
  build(): BuiltMachine
  animations: Record<string, Keyframe[]>
}
```

- [ ] **Step 2: Write the failing tests**

`src/joints/__tests__/jointMath.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { clamp, wrapDeg, applyLimit, restPose, smoothstep, degToRad } from '@/joints/jointMath'
import type { JointSpec } from '@/machines/types'

const boom: JointSpec = {
  name: 'boom', label: 'Boom', axis: 'z', min: -35, max: 55, rest: 30, speed: 25,
  keys: { positive: 'KeyS', negative: 'KeyW' },
}
const swing: JointSpec = {
  name: 'swing', label: 'Swing', axis: 'y', min: 0, max: 0, wrap: true, rest: 0, speed: 40,
  keys: { positive: 'KeyA', negative: 'KeyD' },
}

describe('clamp', () => {
  it('limits to the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
})

describe('wrapDeg', () => {
  it('leaves values inside (-180, 180] alone', () => {
    expect(wrapDeg(0)).toBe(0)
    expect(wrapDeg(179)).toBe(179)
    expect(wrapDeg(180)).toBe(180)
    expect(wrapDeg(-179)).toBe(-179)
  })
  it('wraps past the seam in both directions', () => {
    expect(wrapDeg(181)).toBe(-179)
    expect(wrapDeg(-181)).toBe(179)
    expect(wrapDeg(-180)).toBe(180)
    expect(wrapDeg(750)).toBeCloseTo(30)
    expect(wrapDeg(-750)).toBeCloseTo(-30)
  })
})

describe('applyLimit', () => {
  it('clamps limited joints', () => {
    expect(applyLimit(boom, 999)).toBe(55)
    expect(applyLimit(boom, -999)).toBe(-35)
    expect(applyLimit(boom, 0)).toBe(0)
  })
  it('wraps wrapping joints instead of clamping', () => {
    expect(applyLimit(swing, 190)).toBe(-170)
  })
})

describe('restPose', () => {
  it('maps every joint name to its rest angle', () => {
    expect(restPose([boom, swing])).toEqual({ boom: 30, swing: 0 })
  })
})

describe('smoothstep', () => {
  it('eases from 0 to 1 with flat ends', () => {
    expect(smoothstep(0)).toBe(0)
    expect(smoothstep(1)).toBe(1)
    expect(smoothstep(0.5)).toBeCloseTo(0.5)
    expect(smoothstep(0.1)).toBeLessThan(0.1)
    expect(smoothstep(0.9)).toBeGreaterThan(0.9)
    expect(smoothstep(-5)).toBe(0)
    expect(smoothstep(5)).toBe(1)
  })
})

describe('degToRad', () => {
  it('converts', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/joints`
Expected: FAIL, cannot resolve `@/joints/jointMath`.

- [ ] **Step 4: Write jointMath.ts**

```ts
import type { JointSpec } from '@/machines/types'

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Normalise to (-180, 180]. */
export function wrapDeg(deg: number) {
  let d = ((deg + 180) % 360) - 180
  if (d <= -180) d += 360
  return d
}

export function applyLimit(spec: JointSpec, deg: number) {
  return spec.wrap ? wrapDeg(deg) : clamp(deg, spec.min, spec.max)
}

export function restPose(joints: readonly JointSpec[]): Record<string, number> {
  const pose: Record<string, number> = {}
  for (const j of joints) pose[j.name] = j.rest
  return pose
}

export function smoothstep(t: number) {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export function degToRad(deg: number) {
  return (deg * Math.PI) / 180
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/joints`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
pnpm lint && pnpm type-check
git add src/machines/types.ts src/joints
git commit -m "feat: machine definition types and pure joint maths

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Excavator definition, build function and registry

**Files:**
- Create: `src/machines/excavator/dimensions.ts`, `src/machines/excavator/colors.ts`, `src/machines/excavator/joints.ts`, `src/machines/excavator/build.ts`, `src/machines/excavator/index.ts`, `src/machines/registry.ts`
- Test: `src/machines/excavator/__tests__/dimensions.spec.ts`, `src/machines/excavator/__tests__/build.spec.ts`
- Modify: `src/scene/ViewerCanvas.vue`

**Interfaces:**
- Consumes: `JointSpec`, `BuiltMachine`, `MachineDefinition`, `degToRad`.
- Produces:
  - `DIM`, `BOOM_SEGMENTS`, `boomSegmentMidpoints()`, `boomTip()`, `MACHINE_CENTER`, `CAMERA_START`
  - `COLORS`
  - `EXCAVATOR_JOINTS: readonly JointSpec[]` (names `swing`, `boom`, `stick`, `bucket`)
  - `buildExcavator(): BuiltMachine`
  - `excavator: MachineDefinition` (`animations` empty until Task 10)
  - `MACHINES`, `getMachine(id: string): MachineDefinition` (throws on unknown id), `DEFAULT_MACHINE_ID = 'excavator'`

- [ ] **Step 1: Write the failing dimension tests**

`src/machines/excavator/__tests__/dimensions.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { boomTip, boomSegmentMidpoints, BOOM_SEGMENTS, DIM } from '../dimensions'

const rad = (d: number) => (d * Math.PI) / 180

describe('boom geometry', () => {
  it('boom tip is the vector sum of the two segments', () => {
    const [a, b] = BOOM_SEGMENTS
    const tip = boomTip()
    expect(tip.x).toBeCloseTo(a.length * Math.cos(rad(a.angleDeg)) + b.length * Math.cos(rad(b.angleDeg)), 6)
    expect(tip.y).toBeCloseTo(a.length * Math.sin(rad(a.angleDeg)) + b.length * Math.sin(rad(b.angleDeg)), 6)
  })

  it('first segment midpoint is half-way along segment A from the pivot', () => {
    const [a] = BOOM_SEGMENTS
    const [mid] = boomSegmentMidpoints()
    expect(mid.x).toBeCloseTo((a.length / 2) * Math.cos(rad(a.angleDeg)), 6)
    expect(mid.length).toBe(a.length)
  })

  it('boom reaches well past the front of the tracks', () => {
    expect(DIM.boomPivot.x + boomTip().x).toBeGreaterThan(DIM.track.length / 2 + 2)
  })
})
```

- [ ] **Step 2: Write dimensions.ts and colors.ts**

`src/machines/excavator/dimensions.ts`:

```ts
/** All lengths in metres. Machine faces +X, up is +Y. */
export const DIM = {
  track: { length: 4.4, width: 0.6, height: 0.9, centerZ: 1.1 },
  frame: { length: 2.4, width: 1.6, height: 0.5, y: 0.7 },
  /** Height of the swing bearing (house pivot) above the ground. */
  swingY: 0.95,
  house: { length: 3.2, width: 2.6, height: 0.9, centerX: -0.3 },
  cabin: { length: 1.4, width: 1.0, height: 1.3, x: 0.7, z: -0.75 },
  counterweight: { length: 0.6, width: 2.6, height: 1.0, x: -2.2 },
  exhaust: { radius: 0.08, height: 0.5, x: -1.2, z: 0.6 },
  /** Boom pivot relative to the house pivot. */
  boomPivot: { x: 1.3, y: 0.7, z: 0.45 },
  boom: { thickness: 0.45 },
  stick: { length: 2.9, thickness: 0.35 },
  bucket: { width: 1.2, depth: 0.9, height: 0.8, plate: 0.08 },
  pinRadius: 0.2,
} as const

/** Gooseneck boom: segment A rises, segment B drops back toward horizontal. */
export const BOOM_SEGMENTS = [
  { length: 3.2, angleDeg: 20 },
  { length: 2.6, angleDeg: -20 },
] as const

export const MACHINE_CENTER = [0, 1.5, 0] as const
export const CAMERA_START = [8, 5, 10] as const

const toRad = (deg: number) => (deg * Math.PI) / 180

export function boomSegmentMidpoints() {
  let x = 0
  let y = 0
  return BOOM_SEGMENTS.map((seg) => {
    const angleRad = toRad(seg.angleDeg)
    const mid = {
      x: x + (seg.length / 2) * Math.cos(angleRad),
      y: y + (seg.length / 2) * Math.sin(angleRad),
      angleRad,
      length: seg.length,
    }
    x += seg.length * Math.cos(angleRad)
    y += seg.length * Math.sin(angleRad)
    return mid
  })
}

export function boomTip() {
  return BOOM_SEGMENTS.reduce(
    (acc, seg) => ({
      x: acc.x + seg.length * Math.cos(toRad(seg.angleDeg)),
      y: acc.y + seg.length * Math.sin(toRad(seg.angleDeg)),
    }),
    { x: 0, y: 0 },
  )
}
```

`src/machines/excavator/colors.ts`:

```ts
export const COLORS = {
  paint: 0xf2b705,
  steel: 0x3a3f47,
  track: 0x2a2d33,
  glass: 0x8fb3d9,
  tooth: 0x9aa0a6,
} as const
```

- [ ] **Step 3: Run dimension tests**

Run: `pnpm vitest run src/machines/excavator/__tests__/dimensions.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Write joints.ts**

```ts
import type { JointSpec } from '@/machines/types'

export const EXCAVATOR_JOINTS: readonly JointSpec[] = [
  {
    name: 'swing', label: 'Swing', axis: 'y', min: 0, max: 0, wrap: true, rest: 0, speed: 40,
    keys: { positive: 'KeyA', negative: 'KeyD' },
  },
  {
    name: 'boom', label: 'Boom', axis: 'z', min: -35, max: 55, rest: 30, speed: 25,
    keys: { positive: 'KeyS', negative: 'KeyW' },
  },
  {
    name: 'stick', label: 'Stick', axis: 'z', min: -140, max: -20, rest: -60, speed: 35,
    keys: { positive: 'ArrowUp', negative: 'ArrowDown' },
  },
  {
    name: 'bucket', label: 'Bucket', axis: 'z', min: -60, max: 120, rest: 30, speed: 60,
    keys: { positive: 'ArrowLeft', negative: 'ArrowRight' },
  },
]
```

- [ ] **Step 5: Write the failing build tests**

`src/machines/excavator/__tests__/build.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Mesh, Vector3 } from 'three'
import { buildExcavator } from '../build'
import { EXCAVATOR_JOINTS } from '../joints'
import { DIM, boomTip } from '../dimensions'

function bucketWorld(swingRad: number) {
  const built = buildExcavator()
  built.pivots.swing.rotation.y = swingRad
  built.root.updateMatrixWorld(true)
  return built.pivots.bucket.getWorldPosition(new Vector3())
}

describe('buildExcavator', () => {
  it('has a named pivot for every joint spec', () => {
    const built = buildExcavator()
    for (const j of EXCAVATOR_JOINTS) {
      expect(built.pivots[j.name], j.name).toBeDefined()
      expect(built.pivots[j.name].name).toBe(j.name)
    }
  })

  it('bucket pivot at zero angles sits at the summed offsets', () => {
    const tip = boomTip()
    const p = bucketWorld(0)
    expect(p.x).toBeCloseTo(DIM.boomPivot.x + tip.x + DIM.stick.length, 6)
    expect(p.y).toBeCloseTo(DIM.swingY + DIM.boomPivot.y + tip.y, 6)
    expect(p.z).toBeCloseTo(DIM.boomPivot.z, 6)
  })

  it('a 180° swing mirrors the bucket pivot in x and z but not y', () => {
    const a = bucketWorld(0)
    const b = bucketWorld(Math.PI)
    expect(b.x).toBeCloseTo(-a.x, 6)
    expect(b.z).toBeCloseTo(-a.z, 6)
    expect(b.y).toBeCloseTo(a.y, 6)
  })

  it('stick and bucket are descendants of the boom, which is a descendant of swing', () => {
    const built = buildExcavator()
    expect(built.pivots.boom.parent).toBe(built.pivots.swing)
    expect(built.pivots.stick.parent).toBe(built.pivots.boom)
    expect(built.pivots.bucket.parent).toBe(built.pivots.stick)
    expect(built.pivots.swing.parent).toBe(built.root)
  })

  it('contains meshes and disposes without throwing', () => {
    const built = buildExcavator()
    let meshes = 0
    built.root.traverse((o) => {
      if (o instanceof Mesh) meshes++
    })
    expect(meshes).toBeGreaterThan(10)
    expect(() => built.dispose()).not.toThrow()
  })
})
```

- [ ] **Step 6: Run build tests to verify they fail**

Run: `pnpm vitest run src/machines/excavator/__tests__/build.spec.ts`
Expected: FAIL, cannot resolve `../build`.

- [ ] **Step 7: Write build.ts**

```ts
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, type Material } from 'three'
import type { BuiltMachine } from '@/machines/types'
import { DIM, boomSegmentMidpoints, boomTip } from './dimensions'
import { COLORS } from './colors'

function makeMaterials() {
  return {
    paint: new MeshStandardMaterial({ color: COLORS.paint }),
    steel: new MeshStandardMaterial({ color: COLORS.steel }),
    track: new MeshStandardMaterial({ color: COLORS.track }),
    glass: new MeshStandardMaterial({ color: COLORS.glass, transparent: true, opacity: 0.75 }),
    tooth: new MeshStandardMaterial({ color: COLORS.tooth }),
  }
}

function box(w: number, h: number, d: number, mat: Material, x: number, y: number, z: number) {
  const m = new Mesh(new BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  return m
}

/** Short cylinder along Z, centred on the pivot it decorates. */
function pin(length: number, mat: Material) {
  const m = new Mesh(new CylinderGeometry(DIM.pinRadius, DIM.pinRadius, length, 16), mat)
  m.rotation.x = Math.PI / 2
  return m
}

function pivot(name: string, x: number, y: number, z: number) {
  const g = new Group()
  g.name = name
  g.position.set(x, y, z)
  return g
}

export function buildExcavator(): BuiltMachine {
  const mat = makeMaterials()
  const root = new Group()
  root.name = 'excavator'

  // Undercarriage: two tracks and the centre frame. Track bottoms sit on y = 0.
  const t = DIM.track
  for (const z of [-t.centerZ, t.centerZ]) {
    root.add(box(t.length, t.height, t.width, mat.track, 0, t.height / 2, z))
  }
  const f = DIM.frame
  root.add(box(f.length, f.height, f.width, mat.steel, 0, f.y, 0))

  // House (swing pivot).
  const swing = pivot('swing', 0, DIM.swingY, 0)
  root.add(swing)
  const h = DIM.house
  const c = DIM.cabin
  const w = DIM.counterweight
  const e = DIM.exhaust
  swing.add(box(h.length, h.height, h.width, mat.paint, h.centerX, h.height / 2, 0))
  swing.add(box(c.length, c.height, c.width, mat.glass, c.x, h.height + c.height / 2 - 0.2, c.z))
  swing.add(box(w.length, w.height, w.width, mat.steel, w.x, w.height / 2, 0))
  const exhaust = new Mesh(new CylinderGeometry(e.radius, e.radius, e.height, 12), mat.steel)
  exhaust.position.set(e.x, h.height + e.height / 2, e.z)
  swing.add(exhaust)

  // Boom (two angled segments).
  const bp = DIM.boomPivot
  const boom = pivot('boom', bp.x, bp.y, bp.z)
  swing.add(boom)
  const bt = DIM.boom.thickness
  boom.add(pin(bt + 0.3, mat.steel))
  for (const s of boomSegmentMidpoints()) {
    const seg = box(s.length, bt, bt, mat.paint, s.x, s.y, 0)
    seg.rotation.z = s.angleRad
    boom.add(seg)
  }

  // Stick.
  const tip = boomTip()
  const stick = pivot('stick', tip.x, tip.y, 0)
  boom.add(stick)
  const st = DIM.stick
  stick.add(pin(st.thickness + 0.3, mat.steel))
  stick.add(box(st.length, st.thickness, st.thickness, mat.paint, st.length / 2, 0, 0))

  // Bucket: pivot at top-back, opens toward +X, hangs toward -Y.
  const bucket = pivot('bucket', st.length, 0, 0)
  stick.add(bucket)
  const b = DIM.bucket
  const p = b.plate
  bucket.add(pin(b.width + 0.2, mat.steel))
  bucket.add(box(p, b.height, b.width, mat.steel, p / 2, -b.height / 2, 0)) // back
  bucket.add(box(b.depth, p, b.width, mat.steel, b.depth / 2, -b.height + p / 2, 0)) // bottom
  for (const z of [-b.width / 2, b.width / 2]) {
    bucket.add(box(b.depth, b.height, p, mat.steel, b.depth / 2, -b.height / 2, z)) // sides
  }
  for (const z of [-b.width / 3, 0, b.width / 3]) {
    bucket.add(box(0.2, 0.06, 0.08, mat.tooth, b.depth + 0.1, -b.height + p / 2, z)) // teeth
  }

  return {
    root,
    pivots: { swing, boom, stick, bucket },
    dispose() {
      root.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose()
      })
      for (const m of Object.values(mat)) m.dispose()
    },
  }
}
```

- [ ] **Step 8: Run build tests to verify they pass**

Run: `pnpm vitest run src/machines/excavator`
Expected: PASS (8 tests). If `instanceof Mesh` fails under jsdom because of duplicate three copies, replace with `(o as Mesh).isMesh`.

- [ ] **Step 9: Definition and registry**

`src/machines/excavator/index.ts`:

```ts
import type { MachineDefinition } from '@/machines/types'
import { EXCAVATOR_JOINTS } from './joints'
import { buildExcavator } from './build'
import { MACHINE_CENTER, CAMERA_START } from './dimensions'

export const excavator: MachineDefinition = {
  id: 'excavator',
  label: 'Excavator',
  joints: EXCAVATOR_JOINTS,
  center: MACHINE_CENTER,
  cameraStart: CAMERA_START,
  build: buildExcavator,
  animations: {},
}
```

`src/machines/registry.ts`:

```ts
import type { MachineDefinition } from './types'
import { excavator } from './excavator'

export const DEFAULT_MACHINE_ID = 'excavator'

export const MACHINES: Record<string, MachineDefinition> = {
  [excavator.id]: excavator,
}

export function getMachine(id: string): MachineDefinition {
  const m = MACHINES[id]
  if (!m) throw new Error(`Unknown machine "${id}"`)
  return m
}
```

- [ ] **Step 10: Show the excavator at rest in ViewerCanvas**

Replace `src/scene/ViewerCanvas.vue`:

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SceneHost } from '@/engine/SceneHost'
import { addDefaultLights } from '@/engine/lights'
import { getMachine, DEFAULT_MACHINE_ID } from '@/machines/registry'
import type { BuiltMachine } from '@/machines/types'
import { degToRad } from '@/joints/jointMath'

const container = ref<HTMLDivElement | null>(null)
let host: SceneHost | null = null
let built: BuiltMachine | null = null

onMounted(() => {
  if (!container.value) return
  const def = getMachine(DEFAULT_MACHINE_ID)
  host = new SceneHost(container.value, { cameraStart: def.cameraStart, target: def.center })
  addDefaultLights(host.scene)

  built = def.build()
  for (const spec of def.joints) {
    built.pivots[spec.name].rotation[spec.axis] = degToRad(spec.rest)
  }
  host.scene.add(built.root)

  host.start()
})

onBeforeUnmount(() => {
  built?.dispose()
  host?.dispose()
  built = null
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
```

- [ ] **Step 11: Verify in the browser and tune**

Run: `pnpm dev`
From front, side, top and underneath:
- Tracks on the grid, house above, cabin front-left (−Z), boom beside it on +Z rising then dropping, stick hanging down-forward, bucket at the stick tip with teeth forward-down.
- Nothing floating detached, no part grossly inside another.
- Tune numbers in `dimensions.ts` only; the tests keep the maths honest.

- [ ] **Step 12: Commit**

```bash
pnpm lint && pnpm type-check && pnpm vitest run
git add src/machines src/scene/ViewerCanvas.vue
git commit -m "feat: excavator machine definition built from primitives

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: HUD and wiring the viewer store into the scene

**Files:**
- Create: `src/ui/Hud.vue`
- Modify: `src/scene/ViewerCanvas.vue`, `src/App.vue`

**Interfaces:**
- Consumes: `useViewerStore`, `SceneHost.setGridVisible/setAutoRotate/resetView`.
- Produces: `Hud.vue` with a default `<slot />` for Phase 2 panels.

- [ ] **Step 1: Write Hud.vue**

```vue
<script setup lang="ts">
import { useViewerStore } from '@/stores/viewer'
const viewer = useViewerStore()
</script>

<template>
  <div class="hud">
    <h1>3D Machine Viewer</h1>
    <div class="row">
      <button type="button" @click="viewer.requestReset()">Reset view</button>
      <label><input type="checkbox" :checked="viewer.showGrid" @change="viewer.toggleGrid()" /> Grid</label>
      <label>
        <input type="checkbox" :checked="viewer.autoRotate" @change="viewer.toggleAutoRotate()" /> Auto-rotate
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
```

- [ ] **Step 2: Watch the viewer store in ViewerCanvas**

In `src/scene/ViewerCanvas.vue` add to the imports:

```ts
import { watch } from 'vue'
import { useViewerStore } from '@/stores/viewer'
```

(merge `watch` into the existing `vue` import). After `const container = …` add:

```ts
const viewer = useViewerStore()
```

Inside `onMounted`, right after `addDefaultLights(host.scene)`:

```ts
  host.setGridVisible(viewer.showGrid)
  host.setAutoRotate(viewer.autoRotate)
```

After `onMounted(...)`, add:

```ts
watch(() => viewer.showGrid, (v) => host?.setGridVisible(v))
watch(() => viewer.autoRotate, (v) => host?.setAutoRotate(v))
watch(() => viewer.resetRequested, () => host?.resetView())
```

- [ ] **Step 3: Mount the HUD**

`src/App.vue`:

```vue
<script setup lang="ts">
import ViewerCanvas from '@/scene/ViewerCanvas.vue'
import Hud from '@/ui/Hud.vue'
</script>

<template>
  <ViewerCanvas />
  <Hud />
</template>
```

- [ ] **Step 4: Verify in the browser**

Run: `pnpm dev`
- Orbit away and zoom, press "Reset view": camera snaps back to the start view.
- Grid checkbox hides/shows the grid. Auto-rotate spins the camera; dragging still works.
- Clicking in the HUD does not start an orbit drag.
- Phone or DevTools device mode: one finger orbits, two fingers pinch-zoom, HUD readable.

- [ ] **Step 5: Commit, tag Phase 1**

```bash
pnpm lint && pnpm type-check && pnpm vitest run && pnpm build
git add src/ui src/scene/ViewerCanvas.vue src/App.vue
git commit -m "feat: HUD with reset view, grid and auto-rotate

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git tag phase-1
```

---

## Phase 2 — Articulation

### Task 7: Machine store and per-frame pose application

**Files:**
- Create: `src/stores/machine.ts`
- Test: `src/stores/__tests__/machine.spec.ts`
- Modify: `src/scene/ViewerCanvas.vue`

**Interfaces:**
- Consumes: `getMachine`, `DEFAULT_MACHINE_ID`, `applyLimit`, `restPose`, `degToRad`.
- Produces: `useMachineStore()` with
  - state `machineId: string`, `joints: Record<string, number>` (degrees), `playing: string | null`, `playTime: number`
  - getters `definition: MachineDefinition`, `jointsRad: Record<string, number>`
  - actions `load(id: string)`, `spec(name: string): JointSpec | undefined`, `setJoint(name: string, deg: number)`, `nudgeJoint(name: string, deltaDeg: number)`, `resetJoints()`, `stop()`.
  - `play`, `advance`, `applyPose` come in Task 10.

- [ ] **Step 1: Write the failing tests**

`src/stores/__tests__/machine.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMachineStore } from '@/stores/machine'
import { restPose } from '@/joints/jointMath'
import { getMachine } from '@/machines/registry'

const excavatorRest = restPose(getMachine('excavator').joints)

describe('machine store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts with the excavator at rest, not playing', () => {
    const s = useMachineStore()
    expect(s.machineId).toBe('excavator')
    expect(s.definition.id).toBe('excavator')
    expect(s.joints).toEqual(excavatorRest)
    expect(s.playing).toBeNull()
  })

  it('load throws on an unknown machine and leaves state untouched', () => {
    const s = useMachineStore()
    expect(() => s.load('hovercraft')).toThrow()
    expect(s.machineId).toBe('excavator')
  })

  it('setJoint clamps limited joints', () => {
    const s = useMachineStore()
    s.setJoint('boom', 500)
    expect(s.joints.boom).toBe(55)
  })

  it('setJoint ignores non-finite input and unknown joints', () => {
    const s = useMachineStore()
    s.setJoint('boom', Number.NaN)
    s.setJoint('stick', Number.POSITIVE_INFINITY)
    s.setJoint('wheel', 10)
    expect(s.joints).toEqual(excavatorRest)
  })

  it('nudgeJoint accumulates and swing wraps past 180', () => {
    const s = useMachineStore()
    s.setJoint('swing', 170)
    s.nudgeJoint('swing', 20)
    expect(s.joints.swing).toBe(-170)
  })

  it('nudgeJoint stops at a limit', () => {
    const s = useMachineStore()
    s.setJoint('bucket', 119)
    s.nudgeJoint('bucket', 10)
    expect(s.joints.bucket).toBe(120)
  })

  it('jointsRad converts degrees to radians', () => {
    const s = useMachineStore()
    s.setJoint('boom', 45)
    expect(s.jointsRad.boom).toBeCloseTo(Math.PI / 4)
  })

  it('resetJoints returns to rest and stops playback', () => {
    const s = useMachineStore()
    s.setJoint('boom', 0)
    s.playing = 'dig'
    s.playTime = 3
    s.resetJoints()
    expect(s.joints).toEqual(excavatorRest)
    expect(s.playing).toBeNull()
    expect(s.playTime).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/stores/__tests__/machine.spec.ts`
Expected: FAIL, cannot resolve `@/stores/machine`.

- [ ] **Step 3: Write the store**

`src/stores/machine.ts`:

```ts
import { defineStore } from 'pinia'
import { DEFAULT_MACHINE_ID, getMachine } from '@/machines/registry'
import type { JointSpec } from '@/machines/types'
import { applyLimit, degToRad, restPose } from '@/joints/jointMath'

export const useMachineStore = defineStore('machine', {
  state: () => ({
    machineId: DEFAULT_MACHINE_ID,
    joints: restPose(getMachine(DEFAULT_MACHINE_ID).joints),
    playing: null as string | null,
    playTime: 0,
  }),
  getters: {
    definition: (state) => getMachine(state.machineId),
    jointsRad: (state): Record<string, number> => {
      const out: Record<string, number> = {}
      for (const [name, deg] of Object.entries(state.joints)) out[name] = degToRad(deg)
      return out
    },
  },
  actions: {
    load(id: string) {
      const def = getMachine(id) // throws before any state changes
      this.machineId = id
      this.joints = restPose(def.joints)
      this.stop()
    },
    spec(name: string): JointSpec | undefined {
      return this.definition.joints.find((j) => j.name === name)
    },
    setJoint(name: string, deg: number) {
      if (!Number.isFinite(deg)) return
      const spec = this.spec(name)
      if (!spec) return
      this.joints[name] = applyLimit(spec, deg)
    },
    nudgeJoint(name: string, deltaDeg: number) {
      this.setJoint(name, (this.joints[name] ?? 0) + deltaDeg)
    },
    resetJoints() {
      this.stop()
      this.joints = restPose(this.definition.joints)
    },
    stop() {
      this.playing = null
      this.playTime = 0
    },
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/stores/__tests__/machine.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Drive the pivots from the store every frame**

Replace `src/scene/ViewerCanvas.vue`:

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SceneHost } from '@/engine/SceneHost'
import { addDefaultLights } from '@/engine/lights'
import type { BuiltMachine } from '@/machines/types'
import { useViewerStore } from '@/stores/viewer'
import { useMachineStore } from '@/stores/machine'

const container = ref<HTMLDivElement | null>(null)
const viewer = useViewerStore()
const machine = useMachineStore()
let host: SceneHost | null = null
let built: BuiltMachine | null = null

function applyPose() {
  if (!built) return
  const rad = machine.jointsRad
  for (const spec of machine.definition.joints) {
    const pivotGroup = built.pivots[spec.name]
    if (pivotGroup) pivotGroup.rotation[spec.axis] = rad[spec.name] ?? 0
  }
}

onMounted(() => {
  if (!container.value) return
  const def = machine.definition
  host = new SceneHost(container.value, { cameraStart: def.cameraStart, target: def.center })
  addDefaultLights(host.scene)
  host.setGridVisible(viewer.showGrid)
  host.setAutoRotate(viewer.autoRotate)

  built = def.build()
  host.scene.add(built.root)
  applyPose()

  host.onFrame(() => {
    applyPose()
  })
  host.start()
})

watch(() => viewer.showGrid, (v) => host?.setGridVisible(v))
watch(() => viewer.autoRotate, (v) => host?.setAutoRotate(v))
watch(() => viewer.resetRequested, () => host?.resetView())

onBeforeUnmount(() => {
  built?.dispose()
  host?.dispose()
  built = null
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
```

- [ ] **Step 6: Verify in the browser**

Run: `pnpm dev`
The machine looks exactly as at the end of Phase 1. If you have Vue devtools, set `machine.joints.swing` to 90 in the Pinia tab: house, boom, stick and bucket turn together, tracks stay. Otherwise skip; Task 8's sliders exercise this.

- [ ] **Step 7: Commit**

```bash
pnpm lint && pnpm type-check && pnpm vitest run
git add src/stores src/scene/ViewerCanvas.vue
git commit -m "feat: generic machine store driving pivot rotations per frame

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Joint sliders in the HUD

**Files:**
- Create: `src/ui/JointSlider.vue`, `src/ui/JointPanel.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useMachineStore`, `JointSpec`.
- Produces: `JointPanel.vue` (no props) rendered in the `Hud` slot; `JointSlider.vue` with prop `spec: JointSpec`.

- [ ] **Step 1: JointSlider.vue**

```vue
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
    <input type="range" :min="range.min" :max="range.max" step="1" :value="value" @input="onInput" />
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
```

- [ ] **Step 2: JointPanel.vue**

```vue
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
```

- [ ] **Step 3: Mount the panel**

`src/App.vue` template:

```vue
<template>
  <ViewerCanvas />
  <Hud>
    <JointPanel />
  </Hud>
</template>
```

and add `import JointPanel from '@/ui/JointPanel.vue'`.

- [ ] **Step 4: Verify in the browser**

Run: `pnpm dev`
- Four sliders in definition order. Each moves its joint live; the degree label follows.
- Every joint reaches both ends and looks plausible: bucket +120 curled toward the stick, −60 opening pointing down; stick −140 tucked under the boom.
- "Reset arm" returns to rest. Dragging a slider never orbits the camera.

- [ ] **Step 5: Commit**

```bash
pnpm lint && pnpm type-check && pnpm vitest run
git add src/ui src/App.vue
git commit -m "feat: joint slider panel generated from the machine definition

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Keyboard control

**Files:**
- Create: `src/input/keymap.ts`, `src/input/useKeyboardJoints.ts`
- Test: `src/input/__tests__/keymap.spec.ts`
- Modify: `src/scene/ViewerCanvas.vue`, `src/ui/JointPanel.vue`

**Interfaces:**
- Consumes: `JointSpec`, `useMachineStore`.
- Produces:
  - `RESET_KEY = 'KeyR'`
  - `velocitiesFor(held: ReadonlySet<string>, joints: readonly JointSpec[]): Record<string, number>` (deg/s; only joints with a held key appear; opposite keys give 0)
  - `isBoundKey(code: string, joints: readonly JointSpec[]): boolean`
  - `isEditableTarget(target: EventTarget | null): boolean`
  - `useKeyboardJoints(): { step(delta: number): void }` — registers window listeners on mount, removes on unmount.

- [ ] **Step 1: Write the failing tests**

`src/input/__tests__/keymap.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { velocitiesFor, isBoundKey, isEditableTarget } from '@/input/keymap'
import { EXCAVATOR_JOINTS } from '@/machines/excavator/joints'

const J = EXCAVATOR_JOINTS

describe('velocitiesFor', () => {
  it('returns nothing when no keys are held', () => {
    expect(velocitiesFor(new Set(), J)).toEqual({})
  })
  it('maps A to positive swing and D to negative swing', () => {
    expect(velocitiesFor(new Set(['KeyA']), J)).toEqual({ swing: 40 })
    expect(velocitiesFor(new Set(['KeyD']), J)).toEqual({ swing: -40 })
  })
  it('opposite keys cancel to zero but still count as held', () => {
    expect(velocitiesFor(new Set(['KeyA', 'KeyD']), J)).toEqual({ swing: 0 })
  })
  it('ignores unbound keys and combines joints', () => {
    expect(velocitiesFor(new Set(['KeyZ', 'Space', 'ArrowLeft', 'KeyS']), J)).toEqual({
      bucket: 60,
      boom: 25,
    })
  })
})

describe('isBoundKey', () => {
  it('knows which codes a machine uses', () => {
    expect(isBoundKey('ArrowUp', J)).toBe(true)
    expect(isBoundKey('KeyZ', J)).toBe(false)
  })
})

describe('isEditableTarget', () => {
  it('is true for inputs, textareas, selects and contenteditable', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableTarget(document.createElement('select'))).toBe(true)
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    expect(isEditableTarget(div)).toBe(true)
  })
  it('is false for the body, buttons and null', () => {
    expect(isEditableTarget(document.body)).toBe(false)
    expect(isEditableTarget(document.createElement('button'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/input`
Expected: FAIL, cannot resolve `@/input/keymap`.

- [ ] **Step 3: Write keymap.ts**

```ts
import type { JointSpec } from '@/machines/types'

export const RESET_KEY = 'KeyR'

/** Degrees per second per joint for the keys currently held. */
export function velocitiesFor(
  held: ReadonlySet<string>,
  joints: readonly JointSpec[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const j of joints) {
    const pos = held.has(j.keys.positive)
    const neg = held.has(j.keys.negative)
    if (!pos && !neg) continue
    out[j.name] = (pos ? j.speed : 0) - (neg ? j.speed : 0)
  }
  return out
}

export function isBoundKey(code: string, joints: readonly JointSpec[]) {
  return joints.some((j) => j.keys.positive === code || j.keys.negative === code)
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  // jsdom does not implement isContentEditable, so check the attribute too.
  return target.isContentEditable === true || target.getAttribute('contenteditable') === 'true'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/input`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the composable**

`src/input/useKeyboardJoints.ts`:

```ts
import { onMounted, onUnmounted } from 'vue'
import { useMachineStore } from '@/stores/machine'
import { isBoundKey, isEditableTarget, velocitiesFor, RESET_KEY } from './keymap'

/**
 * Tracks held keys and nudges joints when step(delta) is called from the frame loop.
 * Any held joint key cancels a running animation.
 */
export function useKeyboardJoints() {
  const machine = useMachineStore()
  const held = new Set<string>()

  function onKeyDown(e: KeyboardEvent) {
    if (isEditableTarget(e.target)) return
    if (e.code === RESET_KEY) {
      machine.resetJoints()
      return
    }
    if (!isBoundKey(e.code, machine.definition.joints)) return
    held.add(e.code)
    if (e.code.startsWith('Arrow')) e.preventDefault() // no page scroll
  }
  function onKeyUp(e: KeyboardEvent) {
    held.delete(e.code)
  }
  function releaseAll() {
    held.clear()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseAll)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', releaseAll)
  })

  function step(delta: number) {
    const v = velocitiesFor(held, machine.definition.joints)
    const names = Object.keys(v)
    if (names.length === 0) return
    machine.stop()
    for (const n of names) machine.nudgeJoint(n, v[n] * delta)
  }

  return { step }
}
```

- [ ] **Step 6: Call step from the frame loop**

In `src/scene/ViewerCanvas.vue` add the import:

```ts
import { useKeyboardJoints } from '@/input/useKeyboardJoints'
```

after `const machine = useMachineStore()` add:

```ts
const keyboard = useKeyboardJoints()
```

and change the frame callback to:

```ts
  host.onFrame((delta) => {
    keyboard.step(delta)
    applyPose()
  })
```

- [ ] **Step 7: Show the key map in the panel**

In `src/ui/JointPanel.vue`, below the `.row` div:

```vue
    <p class="keys">
      <span v-for="spec in machine.definition.joints" :key="spec.name">
        {{ keyLabel(spec.keys.positive) }}/{{ keyLabel(spec.keys.negative) }} {{ spec.label.toLowerCase() }} ·
      </span>
      R reset
    </p>
```

add to the script:

```ts
const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
}
function keyLabel(code: string) {
  return KEY_LABELS[code] ?? code.replace(/^Key/, '')
}
```

and the style:

```css
.keys {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.7;
}
```

- [ ] **Step 8: Verify in the browser**

Run: `pnpm dev`
- Click the canvas once so no slider has focus. Hold `A`: house swings smoothly; the swing slider follows. Hold `A` and `D`: nothing moves.
- Hold `W` past the boom limit: stops cleanly at the limit.
- Click a slider, press arrows: only the slider moves.
- Hold a key, switch to another app, come back: nothing keeps moving.
- Arrow keys don't scroll the page.

- [ ] **Step 9: Commit**

```bash
pnpm lint && pnpm type-check && pnpm vitest run
git add src/input src/scene/ViewerCanvas.vue src/ui/JointPanel.vue
git commit -m "feat: keyboard joint control from the frame loop

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Keyframe animations and the dig cycle

**Files:**
- Create: `src/animation/keyframes.ts`, `src/machines/excavator/animations.ts`
- Test: `src/animation/__tests__/keyframes.spec.ts`, `src/machines/excavator/__tests__/animations.spec.ts`
- Modify: `src/machines/excavator/index.ts`, `src/stores/machine.ts`, `src/stores/__tests__/machine.spec.ts`, `src/scene/ViewerCanvas.vue`, `src/ui/JointPanel.vue`

**Interfaces:**
- Consumes: `Keyframe`, `smoothstep`, `applyLimit`.
- Produces:
  - `duration(frames: Keyframe[]): number`
  - `sampleKeyframes(frames: Keyframe[], t: number): Record<string, number>`
  - `DIG_CYCLE: Keyframe[]`; `excavator.animations = { dig: DIG_CYCLE }`
  - store actions `play(name: string)`, `advance(delta: number)`, `applyPose(pose: Record<string, number>)`.

- [ ] **Step 1: Write the failing keyframe tests**

`src/animation/__tests__/keyframes.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sampleKeyframes, duration } from '@/animation/keyframes'
import type { Keyframe } from '@/machines/types'

const a = { swing: 0, boom: 0 }
const b = { swing: 90, boom: 40 }
const frames: Keyframe[] = [
  { t: 0, joints: a },
  { t: 2, joints: b },
]

describe('sampleKeyframes', () => {
  it('returns the first frame before/at t=0 and the last after the end', () => {
    expect(sampleKeyframes(frames, -1)).toEqual(a)
    expect(sampleKeyframes(frames, 0)).toEqual(a)
    expect(sampleKeyframes(frames, 2)).toEqual(b)
    expect(sampleKeyframes(frames, 999)).toEqual(b)
  })
  it('is half-way at the midpoint and eased near the ends', () => {
    const mid = sampleKeyframes(frames, 1)
    expect(mid.swing).toBeCloseTo(45)
    expect(mid.boom).toBeCloseTo(20)
    expect(sampleKeyframes(frames, 0.2).swing).toBeLessThan(9) // linear would be 9
  })
  it('returns copies, not the frame objects', () => {
    const s = sampleKeyframes(frames, 0)
    s.swing = 123
    expect(frames[0].joints.swing).toBe(0)
  })
  it('handles empty input', () => {
    expect(sampleKeyframes([], 1)).toEqual({})
    expect(duration([])).toBe(0)
  })
})

describe('duration', () => {
  it('is the last frame time', () => {
    expect(duration(frames)).toBe(2)
  })
})
```

`src/machines/excavator/__tests__/animations.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DIG_CYCLE } from '../animations'
import { EXCAVATOR_JOINTS } from '../joints'
import { applyLimit } from '@/joints/jointMath'

describe('DIG_CYCLE', () => {
  it('starts at t=0, is strictly ascending, and ends where it began', () => {
    expect(DIG_CYCLE[0].t).toBe(0)
    for (let i = 1; i < DIG_CYCLE.length; i++) {
      expect(DIG_CYCLE[i].t).toBeGreaterThan(DIG_CYCLE[i - 1].t)
    }
    expect(DIG_CYCLE[DIG_CYCLE.length - 1].joints).toEqual(DIG_CYCLE[0].joints)
  })
  it('lists every joint in every frame and never leaves the limits', () => {
    for (const f of DIG_CYCLE) {
      for (const spec of EXCAVATOR_JOINTS) {
        expect(f.joints[spec.name], `${spec.name} at t=${f.t}`).toBeDefined()
        expect(applyLimit(spec, f.joints[spec.name])).toBe(f.joints[spec.name])
      }
    }
  })
})
```

- [ ] **Step 2: Write the failing store tests**

Append inside the `describe` in `src/stores/__tests__/machine.spec.ts`:

```ts
  it('play starts from the first keyframe', () => {
    const s = useMachineStore()
    s.setJoint('boom', 0)
    s.play('dig')
    expect(s.playing).toBe('dig')
    expect(s.playTime).toBe(0)
    expect(s.joints).toEqual(DIG_CYCLE[0].joints)
  })

  it('play ignores unknown animations', () => {
    const s = useMachineStore()
    s.play('moonwalk')
    expect(s.playing).toBeNull()
  })

  it('advance moves time forward and stops exactly on the last frame', () => {
    const s = useMachineStore()
    s.play('dig')
    s.advance(0.5)
    expect(s.playTime).toBeCloseTo(0.5)
    expect(s.playing).toBe('dig')
    s.advance(1000) // backgrounded tab
    expect(s.playing).toBeNull()
    expect(s.joints).toEqual(DIG_CYCLE[DIG_CYCLE.length - 1].joints)
  })

  it('advance does nothing when not playing', () => {
    const s = useMachineStore()
    s.advance(1)
    expect(s.joints).toEqual(excavatorRest)
  })
```

and add `import { DIG_CYCLE } from '@/machines/excavator/animations'` at the top.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/animation src/machines src/stores`
Expected: FAIL on missing modules and `play is not a function`.

- [ ] **Step 4: Write keyframes.ts**

```ts
import type { Keyframe } from '@/machines/types'
import { smoothstep } from '@/joints/jointMath'

export function duration(frames: Keyframe[]) {
  return frames.length ? frames[frames.length - 1].t : 0
}

/** Pose at time t: clamped to the frame range, smoothstep between neighbours. */
export function sampleKeyframes(frames: Keyframe[], t: number): Record<string, number> {
  if (frames.length === 0) return {}
  if (t <= frames[0].t) return { ...frames[0].joints }
  const last = frames[frames.length - 1]
  if (t >= last.t) return { ...last.joints }

  let i = 1
  while (frames[i].t < t) i++
  const a = frames[i - 1]
  const b = frames[i]
  const u = smoothstep((t - a.t) / (b.t - a.t))

  const out: Record<string, number> = {}
  for (const name of Object.keys(a.joints)) {
    const from = a.joints[name]
    const to = b.joints[name] ?? from
    out[name] = from + (to - from) * u
  }
  return out
}
```

- [ ] **Step 5: Write animations.ts and register it**

`src/machines/excavator/animations.ts`:

```ts
import type { Keyframe } from '@/machines/types'

/** Reach out and open, lower, drag in and curl, lift, swing, dump, return. Seconds / degrees. */
export const DIG_CYCLE: Keyframe[] = [
  { t: 0.0, joints: { swing: 0, boom: 30, stick: -60, bucket: 30 } },
  { t: 1.5, joints: { swing: 0, boom: 10, stick: -30, bucket: -40 } },
  { t: 2.5, joints: { swing: 0, boom: -20, stick: -40, bucket: -30 } },
  { t: 4.5, joints: { swing: 0, boom: -10, stick: -110, bucket: 100 } },
  { t: 6.0, joints: { swing: 0, boom: 40, stick: -100, bucket: 110 } },
  { t: 8.0, joints: { swing: 90, boom: 45, stick: -80, bucket: 110 } },
  { t: 9.0, joints: { swing: 90, boom: 45, stick: -60, bucket: -50 } },
  { t: 11.0, joints: { swing: 0, boom: 30, stick: -60, bucket: 30 } },
]
```

In `src/machines/excavator/index.ts` add `import { DIG_CYCLE } from './animations'` and change `animations: {}` to `animations: { dig: DIG_CYCLE }`.

- [ ] **Step 6: Extend the store**

In `src/stores/machine.ts` add the import:

```ts
import { duration, sampleKeyframes } from '@/animation/keyframes'
```

and these actions:

```ts
    play(name: string) {
      const frames = this.definition.animations[name]
      if (!frames || frames.length === 0) return
      this.playing = name
      this.playTime = 0
      this.applyPose(sampleKeyframes(frames, 0))
    },
    advance(delta: number) {
      if (!this.playing) return
      const frames = this.definition.animations[this.playing] ?? []
      const end = duration(frames)
      this.playTime = Math.min(this.playTime + delta, end)
      this.applyPose(sampleKeyframes(frames, this.playTime))
      if (this.playTime >= end) this.stop()
    },
    /** Writes through setJoint so limits always apply. */
    applyPose(pose: Record<string, number>) {
      for (const [name, deg] of Object.entries(pose)) this.setJoint(name, deg)
    },
```

- [ ] **Step 7: Run all tests**

Run: `pnpm vitest run`
Expected: all PASS.

- [ ] **Step 8: Advance from the frame loop**

In `src/scene/ViewerCanvas.vue` change the frame callback to:

```ts
  host.onFrame((delta) => {
    keyboard.step(delta)
    machine.advance(delta)
    applyPose()
  })
```

- [ ] **Step 9: Animation buttons in the panel**

In `src/ui/JointPanel.vue`, inside `.row` after "Reset arm":

```vue
      <button
        v-for="name in Object.keys(machine.definition.animations)"
        :key="name"
        type="button"
        @click="machine.playing === name ? machine.stop() : machine.play(name)"
      >
        {{ machine.playing === name ? 'Stop' : name[0].toUpperCase() + name.slice(1) }}
      </button>
```

- [ ] **Step 10: Verify in the browser**

Run: `pnpm dev`
- "Dig" plays: reach out, lower, curl while pulling in, lift, swing 90°, dump, return; ~11 s; the button reads "Stop" meanwhile and reverts at the end.
- Press a joint key or move a slider mid-cycle: animation stops, input takes over.
- Orbit during the cycle: both work.
- Switch tabs for 20 s mid-cycle, return: arm is at rest, button reads "Dig".
- Tune `DIG_CYCLE` numbers if a frame looks wrong; tests guard limits and ordering.

- [ ] **Step 11: Commit**

```bash
pnpm lint && pnpm type-check && pnpm vitest run
git add src/animation src/machines src/stores src/scene/ViewerCanvas.vue src/ui/JointPanel.vue
git commit -m "feat: keyframe animations with an excavator dig cycle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: README and final checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the scaffold README**

```markdown
# 3D Machine Viewer

A hobby Vue 3 + three.js app: working machines built from primitives that you can orbit,
zoom and articulate. First machine: an excavator.

## Run

    pnpm install
    pnpm dev          # http://localhost:5173
    pnpm vitest run
    pnpm build

## Controls

- Drag to orbit, scroll or pinch to zoom. "Reset view" returns to the start.
- Excavator: A/D swing · S/W boom · ↑/↓ stick · ←/→ bucket · R reset arm. Sliders do the same.
- "Dig" plays a canned dig cycle; any input stops it.

## Layout

- `src/engine/SceneHost.ts` — renderer, camera, OrbitControls, grid, render loop. No machine knowledge.
- `src/machines/types.ts` — `MachineDefinition`: joint specs, `build()`, keyframe animations.
- `src/machines/excavator/` — dimensions (metres), joints, build function, dig cycle.
- `src/joints/jointMath.ts`, `src/animation/keyframes.ts` — pure, tested.
- `src/stores/` — `viewer` (grid, auto-rotate, reset) and `machine` (joint angles, playback).
- `src/scene/ViewerCanvas.vue` — mounts SceneHost, builds the machine, copies store angles into pivots every frame.
- `src/input/` — keyboard → joint velocities. `src/ui/` — HUD, generated from the definition.

Conventions: machine faces +X, up is +Y, arm hinges rotate about Z, swing about Y.
Store angles are degrees; the scene gets radians from `jointsRad`.

## Adding a machine

1. `src/machines/<id>/` with `dimensions.ts`, `joints.ts`, `build.ts`, `animations.ts`,
   `index.ts` exporting a `MachineDefinition`. `build()` must return one named pivot group
   per joint.
2. Register it in `src/machines/registry.ts`.
3. `useMachineStore().load('<id>')` (a picker UI is not built yet).

Docs: `docs/specs/` and `docs/plans/`.
```

- [ ] **Step 2: Full check and commit**

```bash
pnpm lint && pnpm type-check && pnpm vitest run && pnpm build
git add README.md
git commit -m "docs: README with controls, layout and how to add a machine

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git tag phase-2
```

- [ ] **Step 3: Final manual checklist (both phases)**

- [ ] Orbit the full sphere including from underneath; zoom hits both limits; no pan.
- [ ] Reset view, grid and auto-rotate work. Window resize never stretches the image.
- [ ] Phone: one-finger orbit, pinch zoom, HUD readable, sliders usable.
- [ ] Every joint reaches both ends via slider and via key.
- [ ] Opposite keys cancel; keys release on window blur; arrows don't scroll the page; a focused slider owns the arrow keys.
- [ ] Dig plays, can be stopped, is cancelled by input, survives a backgrounded tab.
- [ ] `pnpm preview` of the build behaves the same as dev.
