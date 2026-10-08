# 3D Machine Viewer — Design Spec

**Date:** 2026-10-08
**Status:** Approved direction (plain three.js, generic machine layer); details open for review
**Type:** Hobby project, new codebase at `~/Documents/3d-machine-viewer`

## 1. Purpose

A browser app that shows a working machine floating in a 3D space. The machine stays at
the origin; the user orbits the camera around it in every direction and zooms in and out.
The first machine is an excavator. The code is organised so that more machines (wheel
loader, crane, …) can be added later as self-contained definitions.

Phase 2 adds articulation: the undercarriage stays put while the house swings and the
boom, stick and bucket move, driven by keyboard, sliders and a canned "dig cycle".

Success looks like:

- Phase 1: open the page, see a recognisable excavator, drag to orbit all the way around
  (including underneath), scroll to zoom, press a button to reset the view. Smooth on a
  laptop, works on a phone with touch.
- Phase 2: hold keys or drag sliders to swing the house and move boom/stick/bucket within
  plausible limits; a "Dig cycle" button plays a canned animation.

## 2. Decisions and assumptions

| # | Decision | Reason |
|---|----------|--------|
| D1 | **Plain three.js**, Vue only for the HTML overlay and app shell. No TresJS. | The model is built procedurally and driven per frame, both naturally imperative. Plain `Object3D` trees are unit-testable in Node without a GPU. three.js docs translate 1:1. One dependency. |
| D2 | Machine built from **primitives** (boxes, cylinders) in code. | No asset pipeline for Phase 1; known pivots for Phase 2. A GLB can replace the primitives later (§9). |
| D3 | A **machine definition** interface separates machine-specific code (geometry, joints, animations) from generic code (scene host, store, HUD, input). | "Other machines later" without touching the viewer. |
| D4 | **TypeScript**, strict. **pnpm**, **Node 22**, **Vitest**. | Matches the user's other projects. |
| D5 | No physics, no terrain, no backend, no persistence. Digging is kinematic. | Hobby scope. |

## 3. Architecture

```
src/
  main.ts, App.vue              Vue bootstrap; App = <ViewerCanvas/> + <ViewerHud/>
  engine/
    SceneHost.ts                renderer, scene, camera, OrbitControls, grid, resize,
                                render loop with onFrame(delta) callbacks, resetView, dispose
    lights.ts                   addDefaultLights(scene)
  machines/
    types.ts                    JointSpec, BuiltMachine, MachineDefinition, Keyframe
    registry.ts                 MACHINES: Record<id, MachineDefinition>; getMachine(id)
    excavator/
      dimensions.ts             all lengths in metres, boomTip() etc.
      colors.ts
      joints.ts                 EXCAVATOR_JOINTS: JointSpec[]
      build.ts                  buildExcavator(): BuiltMachine  (pure three.js, tested)
      animations.ts             DIG_CYCLE keyframes
      index.ts                  excavator: MachineDefinition
  joints/
    jointMath.ts                clamp, wrapDeg, applyLimit(spec, deg), smoothstep, degToRad
  animation/
    keyframes.ts                sampleKeyframes(frames, t), duration(frames)
  stores/
    viewer.ts                   showGrid, autoRotate, resetRequested
    machine.ts                  which machine, joint angles (deg), playback state
  input/
    keymap.ts                   velocitiesFor(heldKeys, joints), isEditableTarget
    useKeyboardJoints.ts        window listeners + step(delta)
  scene/
    ViewerCanvas.vue            owns a SceneHost, builds the machine, copies store angles
                                into pivots every frame, watches the viewer store
  ui/
    ViewerHud.vue, JointPanel.vue, JointSlider.vue
```

Data flow: input (OrbitControls, HUD, keyboard) → Pinia stores → `ViewerCanvas` frame
callback writes `pivots[joint].rotation[axis]` → `SceneHost` renders. Scene objects never
write to stores.

### 3.1 Machine definition (`machines/types.ts`)

```ts
export interface JointSpec {
  name: string            // 'swing', 'boom', …  — key into pivots and store
  label: string           // for the HUD
  axis: 'x' | 'y' | 'z'   // local rotation axis of the pivot group
  min: number             // degrees; ignored when wrap is true
  max: number
  wrap?: boolean          // true: unbounded, normalised to (-180, 180]
  rest: number            // degrees
  speed: number           // deg/s while a key is held
  keys: { positive: string; negative: string }  // KeyboardEvent.code
}

export interface Keyframe { t: number; joints: Record<string, number> }  // seconds, degrees

export interface BuiltMachine {
  root: Object3D
  pivots: Record<string, Object3D>   // one per JointSpec.name
  dispose(): void                    // geometries + materials
}

export interface MachineDefinition {
  id: string
  label: string
  joints: JointSpec[]
  center: [number, number, number]       // orbit target
  cameraStart: [number, number, number]
  build(): BuiltMachine
  animations: Record<string, Keyframe[]> // e.g. { dig: [...] }
}
```

Generic code only ever sees this interface. Adding a machine = new folder + registry entry.

## 4. Phase 1 — Static viewer

### 4.1 Scene host (`engine/SceneHost.ts`)

- `new SceneHost(container, { cameraStart, target, background })` creates a
  `WebGLRenderer` (`antialias: true`, device pixel ratio capped at 2), a `Scene` with a solid
  background `#1b2430`, a `PerspectiveCamera` (fov 45, near 0.1, far 200), and
  `OrbitControls` from `three/addons/controls/OrbitControls.js`.
- Controls: `target` = machine centre `(2.5, 2.5, 0)`, the middle of the machine including
  the arm at rest, so the whole machine is in frame; camera starts at `(11, 7, 15)`.
  `enablePan = false` (machine stays put),
  `enableDamping = true`, `dampingFactor = 0.08`, `minDistance = 4`, `maxDistance = 40`,
  `minPolarAngle = 0`, `maxPolarAngle = π` (full sphere, can look from underneath). Touch
  one-finger orbit and pinch zoom come with OrbitControls.
- `GridHelper(20, 20)` at y = 0, toggled by `setGridVisible(bool)`.
- `setAutoRotate(bool)` maps to `controls.autoRotate`, speed 1.5.
- `resetView()` calls `controls.reset()`; `saveState()` is called once in the constructor
  after the camera is positioned.
- Resize: a `ResizeObserver` on the container updates renderer size and camera aspect.
- Loop: `start()` runs `requestAnimationFrame`; each frame computes `delta` from a `Timer`
  (`Clock` is deprecated since three r183),
  clamps it to `MAX_FRAME_DELTA = 0.1` s, calls every `onFrame` callback, updates controls
  (needed for damping), renders. `stop()` cancels. `dispose()` stops, disconnects the
  observer, disposes controls and renderer.
- Lights (`engine/lights.ts`): `AmbientLight` 0.35, key `DirectionalLight` at (6, 10, 8)
  intensity 1.6, fill `DirectionalLight` at (−6, −4, −8) intensity 0.5 so the underside
  isn't black. No shadows.

### 4.2 Viewer canvas (`scene/ViewerCanvas.vue`)

A full-screen `<div ref>`; on mount creates the `SceneHost`, adds lights, calls
`definition.build()`, adds `root` to the scene, registers a frame callback that copies
store angles (radians) into `pivots`. Watches the viewer store for grid, auto-rotate and
reset. On unmount disposes the machine and the host. No scene logic lives in the template.

### 4.3 Excavator geometry (`machines/excavator/`)

Dimensions in metres, roughly a 20-tonne machine. Coordinate convention: machine faces
**+X**, up **+Y**; arm hinges rotate about local **Z** (positive turns +X toward +Y, so
positive boom = up); swing rotates about **Y** (positive = counter-clockwise from above).

```
root (Group)                      undercarriage: two track boxes + frame box, y=0 at track bottom
  swing  (Group) at (0, 0.95, 0)   house body, cabin (glass), counterweight, exhaust
    boom (Group) at (1.3, 0.7, 0.45)   gooseneck: segment A 3.2 m at +20°, segment B 2.6 m at −20°
      stick (Group) at boomTip()      box 2.9 m along +X
        bucket (Group) at (2.9, 0, 0) curl pin + tiltrotator top bracket; hangs along −Y
          tilt (Group) at (0, −0.15, 0)   tilt pin along X; leans the attachment sideways
            rotate (Group) at (0, −0.15, 0)   rotator ring + quick coupler; spins about Y
              backhoe bucket under the coupler, centred on the rotator axis: back, bottom,
              part top and side plates, mouth and 3 teeth facing −X (toward the machine)
```

The bucket is a backhoe bucket: at rest its mouth and teeth face the machine, and curling
sweeps the teeth toward the machine and up. Between the stick tip and the bucket sits a
tiltrotator (kauhanpyörittäjä): tilt about the attachment's X axis, then endless rotation
about its own axis. Tiltrotator sizes are in `DIM.tiltrotator`.

Each pivot group is named after its joint and returned in `pivots`. Pins (short cylinders
along Z) at each hinge for readability. Materials: `MeshStandardMaterial`, CAT-yellow
paint, dark steel, semi-transparent glass.

`dimensions.ts` exposes `boomTip()` so the stick pivot sits exactly at the boom's tip; the
build function is tested in Node for hierarchy and world positions (§7).

Phase 1 shows the rest pose: swing 0, boom +30, stick −60, bucket +30.

### 4.4 HUD (Phase 1)

HTML overlay, top-left: title, "Reset view" button, "Grid" and "Auto-rotate" checkboxes.
Pointer events on the HUD must not reach the canvas.

### 4.5 Viewer store (`stores/viewer.ts`)

`showGrid` (true), `autoRotate` (false), `resetRequested` counter; actions `toggleGrid`,
`toggleAutoRotate`, `requestReset`.

## 5. Phase 2 — Articulation

### 5.1 Excavator joints (`machines/excavator/joints.ts`)

| name | axis | range (deg) | rest | speed | keys (+ / −) | meaning of + |
|------|------|-------------|------|-------|--------------|--------------|
| swing  | y | wrap | 0 | 40 | KeyA / KeyD | counter-clockwise from above |
| boom   | z | −35 … +55 | +30 | 25 | KeyS / KeyW | boom up (W lowers, S raises) |
| stick  | z | −140 … −20 | −60 | 35 | ArrowUp / ArrowDown | stick out (toward inline with boom) |
| bucket | z | −60 … +110 | +30 | 60 | ArrowRight / ArrowLeft | dump (mouth turns down and out); − = curl |
| tilt   | x | −40 … +40 | 0 | 30 | KeyC / KeyZ | tilt right (right edge down, seen from the cab) |
| rotate | y | wrap | 0 | 60 | KeyQ / KeyE | rotate left (counter-clockwise from above) |

`KeyR` resets all joints (global, not per machine). Ranges are plausible, not datasheet.

### 5.2 Machine store (`stores/machine.ts`)

```ts
state: { machineId: string; joints: Record<string, number>; playing: string | null; playTime: number }
getters: definition (from registry), jointsRad
actions:
  load(id)                    // sets machineId, joints = rest pose, stops playback
  setJoint(name, deg)         // ignores non-finite; applyLimit(spec, deg)
  nudgeJoint(name, deltaDeg)
  resetJoints()
  play(animationName) / advance(delta) / stop()
```

The definition is looked up from the registry by id, so the store state stays plain data.

### 5.3 Input

- **Sliders:** `JointPanel` renders one `JointSlider` per `JointSpec` from the definition,
  plus "Reset arm" and animation buttons. Slider input calls `stop()` then `setJoint`.
- **Keyboard:** `useKeyboardJoints()` tracks held `KeyboardEvent.code`s in a `Set`
  (`keydown`/`keyup` on window, cleared on `blur`), ignores events whose target is an
  input/textarea/select/contenteditable, prevents default on arrow keys, and exposes
  `step(delta)` which `ViewerCanvas` calls from the frame callback. `step` computes
  velocities from the definition's joint specs (opposite keys cancel), stops any animation
  if a key is held, and nudges each joint by `velocity * delta`.
- Camera orbit and joint input are independent and work simultaneously.

### 5.4 Animations

`Keyframe[]` per machine; `sampleKeyframes(frames, t)` clamps `t` to the frame range and
interpolates every joint with `smoothstep` between neighbouring frames. The store's
`advance(delta)` moves `playTime`, writes the sampled pose through `setJoint` (so limits
still apply), and stops exactly on the last frame; a huge delta after a backgrounded tab
therefore ends cleanly. The excavator's `dig` cycle: reach out and open → lower → drag in
and curl → lift → swing 90° → dump → return, ~11 s, ending where it began. Any manual
input cancels playback.

## 6. Adding another machine (how D3 pays off)

1. `src/machines/<id>/` with `dimensions.ts`, `joints.ts`, `build.ts`, `animations.ts`,
   `index.ts` exporting a `MachineDefinition`.
2. Register it in `machines/registry.ts`.
3. (Later) a machine picker in the HUD calling `machineStore.load(id)`; `ViewerCanvas`
   watches `machineId`, disposes the old build and adds the new one.

Nothing in `engine/`, `stores/`, `input/`, `animation/` or `ui/` changes.

## 7. Testing

- **Vitest, Node/jsdom, no WebGL:**
  - `jointMath`: clamp, wrap, applyLimit with wrap and with limits, smoothstep.
  - `keyframes`: clamping, midpoint, easing, excavator dig frames inside limits and ascending.
  - `keymap`: velocities, cancelling, unbound keys, editable-target detection.
  - `machine` store: rest pose on load, clamping, NaN ignored, swing wrap, nudge, reset,
    play/advance/stop, huge delta.
  - `buildExcavator`: a pivot for every joint spec; bucket pivot world position equals the
    sum of offsets at zero angles and mirrors under a 180° swing; `dispose` doesn't throw.
  - Attachment: at rest the teeth face the machine; curling lifts them; the chain is
    bucket → tilt → rotate; rotate 180° mirrors the teeth about the rotator axis; tilt moves
    them sideways only.
- **Not tested automatically:** `SceneHost` (needs WebGL), `ViewerCanvas`, HUD. Verified
  by the manual checklist in the plan (orbit full sphere, zoom limits, reset, resize,
  touch, every joint reaches both limits, dig cycle, backgrounded tab).

## 8. Open points

1. Keyboard map in §5.1 — change if you want to match a real control pattern (ISO/SAE).
2. Whether the swing slider should exist at all (wrapping joints are awkward on a −180…180
   slider; it's kept because it's cheap).

## 9. Later / out of scope

- GLB model instead of primitives: load with `GLTFLoader`, re-parent its meshes under the
  same named pivot groups in `build.ts`; nothing else changes.
- Machine picker UI, track driving, physics, terrain, sound, shareable URLs, saved views.
