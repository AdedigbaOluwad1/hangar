import { getVault } from './config'

function statusOf(err: any): number | undefined {
  return err?.response?.statusCode
}

export async function readSecret(path: string): Promise<Record<string, string> | null> {
  try {
    const result = await getVault().read(path)
    return result?.data?.data ?? null
  } catch (err) {
    if (statusOf(err) === 404) return null
    throw err
  }
}

export async function writeSecretOnce(path: string, data: Record<string, string>): Promise<boolean> {
  try {
    await getVault().write(path, { options: { cas: 0 }, data })
    return true
  } catch (err) {
    if (statusOf(err) === 400 && /check-and-set/i.test(String((err as Error).message))) return false
    throw err
  }
}

export async function writeSecret(path: string, data: Record<string, string>): Promise<void> {
  await getVault().write(path, { data })
}

export async function destroySecret(path: string): Promise<void> {
  const metadata = path.replace('/data/', '/metadata/')
  try {
    await getVault().delete(metadata)
  } catch (err) {
    if (statusOf(err) !== 404) throw err
  }
}
