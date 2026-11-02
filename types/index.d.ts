export type Limit = { kind: string; percent: number; resetsAt?: string }
export type Monitor = {
  limits: Limit[]
  baseline: Record<string, number>
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  costUsd: number
  model: string
}

declare module 'claude-code' {
  interface PluginState {
    'usage-monitor': { data: Monitor }
  }
}
