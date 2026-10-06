import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATABASE_PLANS, DATABASE_PLAN_KEYS, ENGINES } from '@hangar/types'
import { validateEnv } from './env-rules'

function schemaEnum(name: string): string[] {
  const schema = readFileSync(join(__dirname, '../../../../packages/db/prisma/schema.prisma'), 'utf8')
  const body = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`))?.[1] ?? ''
  return body.split('\n').map((line) => line.trim()).filter(Boolean)
}

test('every database engine in the schema has a spec and every spec is in the schema', () => {
  assert.deepEqual(Object.keys(ENGINES).sort(), schemaEnum('DatabaseEngine').sort())
})

test('each engine has a usable default version, port and plan', () => {
  for (const [name, spec] of Object.entries(ENGINES)) {
    assert.ok(spec.versions.includes(spec.defaultVersion), `${name}: default version is not offered`)
    assert.ok(Number.isInteger(spec.port) && spec.port > 0 && spec.port < 65536, `${name}: bad port`)
    assert.ok(DATABASE_PLAN_KEYS.includes(spec.minPlan), `${name}: unknown minimum plan`)
  }
})

test('default and extra env names are valid for apps', () => {
  for (const [name, spec] of Object.entries(ENGINES)) {
    const vars = Object.fromEntries([spec.defaultEnvName, ...spec.extraEnvNames].map((key) => [key, 'x']))
    assert.equal(validateEnv(vars), null, `${name}: ${validateEnv(vars)}`)
  }
})

test('plans grow in every dimension and storage is a whole number of gigabytes', () => {
  const plans = DATABASE_PLAN_KEYS.map((key) => DATABASE_PLANS[key])
  for (let i = 1; i < plans.length; i++) {
    assert.ok(plans[i].cpu > plans[i - 1].cpu)
    assert.ok(plans[i].memoryMb > plans[i - 1].memoryMb)
    assert.ok(plans[i].storageGb > plans[i - 1].storageGb)
  }
  for (const plan of plans) assert.ok(Number.isInteger(plan.storageGb) && plan.storageGb > 0)
})

test('only engines that can restore to a point in time say so', () => {
  assert.deepEqual(
    Object.entries(ENGINES).filter(([, spec]) => spec.pitr).map(([name]) => name).sort(),
    ['ferretdb', 'postgres'],
  )
})
