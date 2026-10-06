import test from 'node:test'
import assert from 'node:assert/strict'
import { buildJobSpec, envVaultPath, jobId, APP_VAULT_ROLE } from './job-spec'

const spec = buildJobSpec('dep-abc123', 'registry.local:5000/hangar-dep-abc123:v1', { cpu: 250, memoryMb: 128 })
const task = spec.Job.TaskGroups[0].Tasks[0]

test('names the job and its Vault path after the deployment', () => {
  assert.equal(jobId('dep-abc123'), 'hangar-dep-abc123')
  assert.equal(spec.Job.ID, 'hangar-dep-abc123')
  assert.equal(envVaultPath('dep-abc123'), 'hangar/data/jobs/hangar-dep-abc123/env')
})

test('never puts user variables in the job spec', () => {
  assert.deepEqual(task.Env, { PORT: '3000' })
})

test('reads env from the app role and only its own Vault path', () => {
  assert.equal(task.Vault.Role, APP_VAULT_ROLE)
  assert.equal(task.Vault.DisableFile, true)
  assert.equal(task.Vault.Env, false)
  const [template] = task.Templates
  assert.equal(template.Envvars, true)
  assert.equal(template.DestPath, 'secrets/env')
  assert.ok(template.EmbeddedTmpl.includes('"hangar/data/jobs/hangar-dep-abc123/env"'))
  assert.ok(template.EmbeddedTmpl.includes('{{ $v | toJSON }}'))
  assert.equal(template.EmbeddedTmpl.includes('hangar/data/config'), false)
})

test('keeps the image, resources and health check', () => {
  assert.equal(task.Config.image, 'registry.local:5000/hangar-dep-abc123:v1')
  assert.deepEqual(task.Resources, { CPU: 250, MemoryMB: 128 })
  assert.equal(task.Services[0].Name, 'hangar-dep-abc123')
  assert.deepEqual(buildJobSpec('dep-x', 'img').Job.TaskGroups[0].Tasks[0].Resources, { CPU: 500, MemoryMB: 512 })
})
