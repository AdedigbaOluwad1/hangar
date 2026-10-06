import { DATABASE_PLANS, DATABASE_PLAN_KEYS, ENGINES } from '@hangar/types'
import type { DatabaseEngine, DatabasePlan } from '@hangar/types'

export interface DatabaseRequest {
  engine: DatabaseEngine
  version?: string
  plan: string
}

export function resolveRequest(request: DatabaseRequest): { version: string; plan: DatabasePlan } | { error: string } {
  const spec = ENGINES[request.engine]
  if (!spec) return { error: `Unknown engine: ${request.engine}` }
  const version = request.version ?? spec.defaultVersion
  if (!spec.versions.includes(version)) {
    return { error: `${spec.label} ${version} is not available. Choose ${spec.versions.join(', ')}.` }
  }
  if (!DATABASE_PLAN_KEYS.includes(request.plan as DatabasePlan)) {
    return { error: `Unknown plan: ${request.plan}` }
  }
  const plan = request.plan as DatabasePlan
  if (DATABASE_PLAN_KEYS.indexOf(plan) < DATABASE_PLAN_KEYS.indexOf(spec.minPlan)) {
    return { error: `${spec.label} needs at least the ${DATABASE_PLANS[spec.minPlan].label} plan.` }
  }
  return { version, plan }
}

const HEADROOM_SHARE = 1.1

export function checkCapacity(reservedGb: number, planStorageGb: number, capacityGb: number | null): string | null {
  if (capacityGb === null) return null
  const usableGb = Math.floor(capacityGb / HEADROOM_SHARE)
  if (reservedGb + planStorageGb > usableGb) {
    const free = Math.max(0, usableGb - reservedGb)
    return `Not enough database storage: ${planStorageGb} GB requested, ${free} GB free of ${usableGb} GB.`
  }
  return null
}
