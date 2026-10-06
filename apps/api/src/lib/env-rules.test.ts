import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPatch, validateEnv, validatePatch, ENV_LIMITS } from './env-rules'

test('accepts ordinary variables', () => {
  assert.equal(validateEnv({ DATABASE_URL: 'postgres://x', _private: 'a', Mixed_Case9: '' }), null)
})

test('rejects bad names', () => {
  assert.match(validateEnv({ '1BAD': 'x' })!, /cannot start with a digit/)
  assert.match(validateEnv({ 'HAS-DASH': 'x' })!, /letters, digits and underscores/)
  assert.match(validateEnv({ '': 'x' })!, /letters, digits and underscores/)
})

test('rejects names Hangar owns', () => {
  for (const key of ['PORT', 'HANGAR_PUBLIC_URL', 'NOMAD_ALLOC_ID']) {
    assert.match(validateEnv({ [key]: 'x' })!, /reserved/)
  }
  assert.equal(validateEnv({ PORTAL: 'x', MY_PORT: 'x' }), null)
})

test('enforces size limits and string values', () => {
  assert.match(validateEnv({ BIG: 'x'.repeat(ENV_LIMITS.maxValueLength + 1) })!, /longer than/)
  assert.match(validateEnv({ N: 5 as unknown as string })!, /must be a string/)
  const many = Object.fromEntries(Array.from({ length: ENV_LIMITS.maxKeys + 1 }, (_, i) => [`K${i}`, 'v']))
  assert.match(validateEnv(many)!, /At most/)
})

test('a patch needs a change and cannot set and remove the same key', () => {
  assert.equal(validatePatch({}), 'Nothing to change')
  assert.equal(validatePatch({ set: {}, unset: [] }), 'Nothing to change')
  assert.match(validatePatch({ set: { A: '1' }, unset: ['A'] })!, /same request/)
  assert.equal(validatePatch({ unset: ['A'] }), null)
})

test('applyPatch merges, overwrites and removes without touching the input', () => {
  const current = { A: '1', B: '2' }
  const next = applyPatch(current, { set: { B: '3', C: '4' }, unset: ['A', 'MISSING'] })
  assert.deepEqual(next, { B: '3', C: '4' })
  assert.deepEqual(current, { A: '1', B: '2' })
})
