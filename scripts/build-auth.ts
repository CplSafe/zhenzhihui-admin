import { isIP } from 'node:net'

// These origins are compiled into the login callback allowlist, not just the dev proxy.
export function validateBuildAuth(command: string, mode: string, env: Record<string, string>) {
  if (command !== 'build' || !['production', 'test'].includes(mode)) return
  for (const key of ['VITE_ZZH_REMOTE_ORIGIN', 'VITE_DEEPAUTH_REMOTE_ORIGIN']) {
    let url: URL
    try {
      url = new URL(env[key] || '')
    } catch {
      throw new Error(`${key} must be an HTTPS origin for ${mode} builds`)
    }
    if (url.protocol !== 'https:' || isIP(url.hostname.replace(/^\[|\]$/g, '')) ||
        url.hostname === 'localhost' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`${key} must be a public HTTPS origin for ${mode} builds; use build:test for TEST`)
    }
  }
}
