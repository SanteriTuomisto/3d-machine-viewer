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
  it('is false for checkboxes and radios, so clicking Grid does not swallow joint keys', () => {
    for (const type of ['checkbox', 'radio']) {
      const input = document.createElement('input')
      input.type = type
      expect(isEditableTarget(input)).toBe(false)
    }
  })
  it('stays true for range inputs so a focused slider owns the arrow keys', () => {
    const input = document.createElement('input')
    input.type = 'range'
    expect(isEditableTarget(input)).toBe(true)
  })
  it('is false for the body, buttons and null', () => {
    expect(isEditableTarget(document.body)).toBe(false)
    expect(isEditableTarget(document.createElement('button'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})
