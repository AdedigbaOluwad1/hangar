import { getDatabase, listAttachmentsForDeployment } from '@hangar/db'
import { getDriver } from './driver'
import { attachmentEnvKeys } from './env'

export async function managedEnvKeys(deploymentId: string): Promise<Set<string>> {
  const keys = new Set<string>()
  for (const attachment of await listAttachmentsForDeployment(deploymentId)) {
    const database = await getDatabase(attachment.databaseId)
    if (!database) continue
    for (const key of attachmentEnvKeys(database.engine, attachment.envName, getDriver(database.engine).appDatabase)) {
      keys.add(key)
    }
  }
  return keys
}
