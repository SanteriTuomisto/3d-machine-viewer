# 3D Machine Viewer

A hobby Vue 3 + three.js app: working machines built from primitives that you can orbit,
zoom and articulate. First machine: an excavator.

## Run

Needs Node 22+ and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm vitest run
pnpm build
```

## Controls

- Drag to orbit, scroll or pinch to zoom. "Reset view" returns to the start.
- Excavator: A/D swing · S/W boom · ↑/↓ stick · ←/→ bucket curl/dump · Z/C tilt · Q/E rotate ·
  R reset arm. Sliders do the same.
- The bucket hangs on a tiltrotator (kauhanpyörittäjä): tilt leans it sideways, rotate spins it
  endlessly around its own axis.
- "Dig" plays a canned dig cycle; any input stops it.

## Layout

- `src/engine/SceneHost.ts` — renderer, camera, OrbitControls, grid, render loop. No machine knowledge.
- `src/machines/types.ts` — `MachineDefinition`: joint specs, `build()`, keyframe animations.
- `src/machines/excavator/` — dimensions (metres), joints, build function, dig cycle.
- `src/joints/jointMath.ts`, `src/animation/keyframes.ts` — pure, tested.
- `src/stores/` — `viewer` (grid, auto-rotate, reset) and `machine` (joint angles, playback).
- `src/scene/ViewerCanvas.vue` — mounts SceneHost, builds the machine, copies store angles into
  pivots every frame.
- `src/input/` — keyboard to joint velocities. `src/ui/` — `ViewerHud` and the joint panel,
  generated from the definition.

Conventions: machine faces +X, up is +Y, arm hinges rotate about Z, swing about Y.
Store angles are degrees; the scene gets radians from `jointsRad`.

## Adding a machine

1. `src/machines/<id>/` with `dimensions.ts`, `joints.ts`, `build.ts`, `animations.ts`,
   `index.ts` exporting a `MachineDefinition`. `build()` must return one named pivot group
   per joint.
2. Register it in `src/machines/registry.ts`.
3. `useMachineStore().load('<id>')` (a picker UI is not built yet).

Docs: `docs/specs/` and `docs/plans/`.
