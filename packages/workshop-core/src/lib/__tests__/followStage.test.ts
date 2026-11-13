import { describe, expect, it } from 'vitest'
import { stageToFollow } from '../followStage'

describe('stageToFollow', () => {
  it('goes where the items went', () => {
    expect(stageToFollow(['a', 'b'], [{ id: 'a', stage: 'dried' }, { id: 'b', stage: 'dried' }, { id: 'c', stage: 'painted' }])).toBe('dried')
  })
  it('stays when they became a defect or were deleted', () => {
    expect(stageToFollow(['a'], [{ id: 'a', stage: 'defect' }])).toBeUndefined()
    expect(stageToFollow(['a'], [])).toBeUndefined()
  })
})
