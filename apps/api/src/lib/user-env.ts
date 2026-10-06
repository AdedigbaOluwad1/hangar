import { getVault } from './config'

export async function getUserEnv(deploymentId: string): Promise<Record<string, string>> {
  try {
    const vault = getVault()
    const result = await vault.read(`hangar/data/deployments/${deploymentId}/env`)
    return result?.data?.data ?? {}
  } catch {
    return {}
  }
}
