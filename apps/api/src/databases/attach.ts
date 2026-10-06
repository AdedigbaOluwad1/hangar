import { randomBytes } from 'node:crypto'
import {
  deleteAttachment,
  getAttachment,
  getDatabase,
  getDeployment,
  updateAttachment,
} from '@hangar/db'
import { applyEnvChange, destroySecret, maskLine, patchEnv, readSecret, writeSecretOnce } from '../lib'
import { getDriver } from './driver'
import { attachmentEnv, attachmentEnvKeys } from './env'
import { databaseFqdn } from './names'
import { connectionFor, readAdminCredentials, toSpec } from './provision'

async function restartApp(deploymentId: string): Promise<void> {
  const deployment = await getDeployment(deploymentId)
  if (deployment) await applyEnvChange(deployment)
}

export async function attachDatabase(attachmentId: string): Promise<void> {
  const attachment = await getAttachment(attachmentId)
  if (!attachment) throw new Error(`Attachment ${attachmentId} not found`)
  const row = await getDatabase(attachment.databaseId)
  if (!row) throw new Error(`Database ${attachment.databaseId} not found`)
  const db = toSpec(row)
  const driver = getDriver(db.engine)
  let secrets: string[] = []

  try {
    await writeSecretOnce(attachment.vaultPath, {
      username: attachment.username,
      password: randomBytes(24).toString('hex'),
    })
    const stored = await readSecret(attachment.vaultPath)
    if (!stored?.password) throw new Error('Attachment credentials are missing')
    const role = { username: attachment.username, password: stored.password }
    secrets = [role.password]

    const admin = await readAdminCredentials(db.id)
    await driver.createRole(connectionFor(db, admin), role)

    const conn = { host: databaseFqdn(db.host), port: db.port }
    await patchEnv(attachment.deploymentId, {
      set: attachmentEnv(db.engine, attachment.envName, conn, role, driver.appDatabase),
    })
    await updateAttachment(attachmentId, { status: 'attached' })
  } catch (err) {
    await updateAttachment(attachmentId, { status: 'failed' })
    throw new Error(maskLine(err instanceof Error ? err.message : String(err), secrets).slice(0, 500))
  }

  await restartApp(attachment.deploymentId)
}

export async function detachDatabase(attachmentId: string): Promise<void> {
  const attachment = await getAttachment(attachmentId)
  if (!attachment) return
  const row = await getDatabase(attachment.databaseId)

  if (row) {
    const db = toSpec(row)
    const driver = getDriver(db.engine)
    await patchEnv(attachment.deploymentId, {
      unset: attachmentEnvKeys(db.engine, attachment.envName, driver.appDatabase),
    })
    const admin = await readAdminCredentials(db.id)
    await driver.dropRole(connectionFor(db, admin), attachment.username)
  }

  await destroySecret(attachment.vaultPath)
  await deleteAttachment(attachmentId)
  await restartApp(attachment.deploymentId)
}
