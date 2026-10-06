import test from 'node:test'
import assert from 'node:assert/strict'
import { maskLine, platformSecrets, userEnvSecrets } from './mask'

test('masks credentials embedded in URLs', () => {
  const line = 'Cloning into https://oauth2:ghp_abcdef123456@github.com/acme/app.git'
  assert.equal(maskLine(line, []), 'Cloning into https://oauth2:***@github.com/acme/app.git')
})

test('masks bearer tokens', () => {
  assert.equal(maskLine('curl -H "Authorization: Bearer abcdefgh12345678"', []), 'curl -H "Authorization: Bearer ***"')
})

test('masks platform secrets by variable name and URL password', () => {
  const secrets = platformSecrets({
    ADMIN_TOKEN: 'adm-1234567890',
    NOMAD_TOKEN: 'nomad-secret-id',
    DATABASE_URL: 'postgresql://hangar:p4ssw0rdvalue@postgres:5432/hangar',
    REDIS_URL: 'redis://:r3disPassw0rd@redis:6379',
    NODE_ENV: 'production',
    PATH: '/usr/bin',
  })
  const out = maskLine('adm-1234567890 nomad-secret-id p4ssw0rdvalue r3disPassw0rd production /usr/bin', secrets)
  assert.equal(out, '*** *** *** *** production /usr/bin')
})

test('user env: long values always masked, short plain values left alone', () => {
  const secrets = userEnvSecrets({ NODE_ENV: 'prod', PORT: '3000', API_KEY: 'k3y!', STRIPE: 'sk_live_51Habcdef' })
  const out = maskLine('NODE_ENV=prod PORT=3000 key=k3y! stripe sk_live_51Habcdef', secrets)
  assert.equal(out, 'NODE_ENV=prod PORT=3000 key=*** stripe ***')
})

test('masks each line of a multi-line secret and its URL-encoded form', () => {
  const key = '-----BEGIN KEY-----\nAAAABBBBCCCCDDDD\n-----END KEY-----'
  const secrets = userEnvSecrets({ PRIVATE_KEY: key, PASS: 'a b&c=d/e' })
  assert.equal(maskLine('AAAABBBBCCCCDDDD', secrets), '***')
  assert.equal(maskLine('a%20b%26c%3Dd%2Fe', secrets), '***')
})

test('longer secrets win over their substrings', () => {
  const secrets = ['abcd1234', 'abcd1234-extra']
  assert.equal(maskLine('abcd1234-extra', secrets), '***')
})

test('masks the clone URL inside an execa error message', () => {
  const message = 'Command failed with exit code 128: git clone --depth=1 https://user:tok3n-value@github.com/a/b.git /tmp/x'
  assert.ok(!maskLine(message, []).includes('tok3n-value'))
})

test('leaves ordinary log lines untouched', () => {
  const line = '#5 [4/6] RUN npm ci --omit=dev && npm run build'
  assert.equal(maskLine(line, platformSecrets({ HOME: '/root' })), line)
})
