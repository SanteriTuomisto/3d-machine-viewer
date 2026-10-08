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
    // Shortcuts like Cmd+A: macOS sends no keyup for the letter, so it would stay held.
    if (e.metaKey || e.ctrlKey || e.altKey) return
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
    const velocities = Object.entries(velocitiesFor(held, machine.definition.joints))
    if (velocities.length === 0) return
    machine.stop()
    for (const [name, degPerSec] of velocities) machine.nudgeJoint(name, degPerSec * delta)
  }

  return { step }
}
