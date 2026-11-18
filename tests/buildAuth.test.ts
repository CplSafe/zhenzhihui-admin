import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateBuildAuth } from '../scripts/build-auth.ts'

const valid = {
  VITE_ZZH_REMOTE_ORIGIN: 'https://zzh-dev.zhongdahengrui.com',
  VITE_DEEPAUTH_REMOTE_ORIGIN: 'https://zzh-auth.zhongdahengrui.com',
}
test('release builds reject the legacy IP origins that drop the OAuth callback', () => {
  for (const mode of ['production', 'test']) {
    for (const key of Object.keys(valid)) {
      for (const value of ['http://115.190.63.215:9000', 'https://115.190.63.215', '', 'https://localhost', 'https://user:pass@example.com', 'https://example.com/path']) {
        assert.throws(() => validateBuildAuth('build', mode, { ...valid, [key]: value }), new RegExp(key))
      }
    }
    assert.doesNotThrow(() => validateBuildAuth('build', mode, valid))
  }
  assert.doesNotThrow(() => validateBuildAuth('serve', 'development', {}))
})
test('TEST command loads the real callback and authentication origins', () => {
  const env = Object.fromEntries(readFileSync(new URL('../.env.test', import.meta.url), 'utf8')
    .split('\n').filter(line => line.startsWith('VITE_')).map(line => line.split('=')))
  assert.equal(env.VITE_ZZH_REMOTE_ORIGIN, valid.VITE_ZZH_REMOTE_ORIGIN)
  assert.equal(env.VITE_DEEPAUTH_REMOTE_ORIGIN, valid.VITE_DEEPAUTH_REMOTE_ORIGIN)
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(pkg.scripts['build:test'], /vite build --mode test/)
})
