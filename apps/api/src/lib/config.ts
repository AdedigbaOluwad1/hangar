import Vault from 'node-vault'

const vault = Vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN,
})

let config: Record<string, string> | null = null

export async function getConfig(): Promise<Record<string, string>> {
  if (config) return config
  const result = await vault.read('hangar/data/config')
  config = result.data.data as Record<string, string>
  return config
}