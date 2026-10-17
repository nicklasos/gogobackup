import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { anyRunActive, isRunActive } from './runStatus'
import type { LastRun, Plan, RunStatus } from './types'

const run = (status: RunStatus): LastRun => ({ id: 1, status, trigger: 'manual', started_at: null, finished_at: null, size_bytes: null })
const plan = (last_run: LastRun | null) => ({ id: 1, last_run }) as Plan

describe('run status', () => {
  it('is active while queued or running', () => {
    assert.equal(isRunActive(run('queued')), true)
    assert.equal(isRunActive(run('running')), true)
    assert.equal(isRunActive(run('succeeded')), false)
    assert.equal(isRunActive(run('failed')), false)
    assert.equal(isRunActive(null), false)
    assert.equal(isRunActive(undefined), false)
  })

  it('polls a page only while one of its plans has a run in progress', () => {
    assert.equal(anyRunActive(undefined), false)
    assert.equal(anyRunActive([]), false)
    assert.equal(anyRunActive([plan(null), plan(run('failed')), plan(run('succeeded'))]), false)
    assert.equal(anyRunActive([plan(run('succeeded')), plan(run('running'))]), true)
  })
})
