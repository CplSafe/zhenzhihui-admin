/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_DEEPAUTH_API_BASE_URL?: string
  readonly VITE_ZZH_REMOTE_ORIGIN?: string
  readonly VITE_DEEPAUTH_REMOTE_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
