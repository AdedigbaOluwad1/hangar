export const APP_VAULT_ROLE = 'nomad-apps'

export function jobId(deploymentId: string): string {
  return `hangar-${deploymentId}`
}

export function envVaultPath(deploymentId: string): string {
  return `hangar/data/jobs/${jobId(deploymentId)}/env`
}

function envTemplate(deploymentId: string): string {
  return [
    `{{ with secret "${envVaultPath(deploymentId)}" }}`,
    '{{ range $k, $v := .Data.data }}',
    '{{ $k }}={{ $v | toJSON }}',
    '{{ end }}',
    '{{ end }}',
  ].join('\n')
}

export function buildJobSpec(
  deploymentId: string,
  imageTag: string,
  resources: { cpu?: number; memoryMb?: number } = {},
) {
  const id = jobId(deploymentId)
  return {
    Job: {
      ID: id,
      Name: id,
      Type: 'service',
      Datacenters: ['dc1'],
      TaskGroups: [
        {
          Name: 'app',
          Count: 1,
          Networks: [{ DynamicPorts: [{ Label: 'http', To: 3000 }] }],
          Tasks: [
            {
              Name: 'web',
              Driver: 'podman',
              Config: { image: imageTag, ports: ['http'] },
              Env: { PORT: '3000' },
              Vault: { Role: APP_VAULT_ROLE, Env: false, DisableFile: true, ChangeMode: 'noop' },
              Templates: [
                {
                  EmbeddedTmpl: envTemplate(deploymentId),
                  DestPath: 'secrets/env',
                  Envvars: true,
                  ChangeMode: 'noop',
                },
              ],
              Resources: {
                CPU: resources.cpu ?? 500,
                MemoryMB: resources.memoryMb ?? 512,
              },
              Services: [
                {
                  Name: id,
                  PortLabel: 'http',
                  Checks: [
                    {
                      Type: 'http',
                      Path: '/',
                      Interval: 10_000_000_000,
                      Timeout: 2_000_000_000,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}
