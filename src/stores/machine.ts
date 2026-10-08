import { defineStore } from 'pinia'
import { DEFAULT_MACHINE_ID, getMachine } from '@/machines/registry'
import type { JointSpec } from '@/machines/types'
import { applyLimit, degToRad, restPose } from '@/joints/jointMath'
import { duration, sampleKeyframes } from '@/animation/keyframes'

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
  },
})
