/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly DEV: boolean
    readonly PROD: boolean
    readonly MODE: string
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    /** Set to "true" to expose the dev-only demo data tools. Never enable in production. */
    readonly VITE_ENABLE_DEMO_DATA?: string
    /** Override the router/asset base path (defaults to /kk-cricket-team/). */
    readonly VITE_BASE_PATH?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export {}
