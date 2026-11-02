import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Monitor } from '../types'

const empty: Monitor = {
  limits: [],
  baseline: {},
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  costUsd: 0,
  model: '',
}
const data = atom({ plugin: 'usage-monitor', key: 'data' } as const, empty)

const WIDTH = 40
const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n)

const remaining = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const s = Math.max(0, Math.floor((Date.parse(iso) - now) / 1000))
  const d = Math.floor(s / 86400)
  const hh = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d}d${hh}h` : `${hh}h${String(m).padStart(2, '0')}m`
}

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: '$ ' }

async function sync($: any, rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[], usd?: number) {
  await update($, data, (d: Monitor) => {
    const baseline = { ...d.baseline }
    for (const r of rateLimits) if (!(r.kind in baseline)) baseline[r.kind] = r.percentUsed
    return {
      ...d,
      baseline,
      limits: rateLimits.map(r => ({ kind: r.kind, percent: r.percentUsed, resetsAt: r.resetsAt })),
      costUsd: usd ?? d.costUsd,
    }
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const u = await $.session.usage()
    await sync($, u.rateLimits, u.cost?.usd)
    const model = await $.session.model()
    await update($, data, (d: Monitor) => ({ ...d, model }))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await sync($, e.rateLimits, e.cost?.usd)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const u = r.usage
    if (u && !e.agentId) {
      await update($, data, (d: Monitor) => ({
        ...d,
        model: u.model || e.model,
        input: d.input + u.input_tokens,
        output: d.output + u.output_tokens,
        cacheRead: d.cacheRead + u.cache_read_input_tokens,
        cacheWrite: d.cacheWrite + u.cache_creation_input_tokens,
      }))
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const d = await read($, data)
    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)

    const total = d.input + d.output + d.cacheRead + d.cacheWrite

    const rows = d.limits.map(l => {
      const base = Math.min(l.percent, d.baseline[l.kind] ?? l.percent)
      const ses = Math.max(0, l.percent - base)
      const acc = Math.round((base / 100) * WIDTH)
      const sn = Math.min(WIDTH - acc, Math.max(ses > 0 ? 1 : 0, Math.round((ses / 100) * WIDTH)))
      const free = Math.max(0, WIDTH - acc - sn)
      return (
        <Box key={l.kind}>
          <Text bold>{(LABELS[l.kind] ?? l.kind).padEnd(3)}</Text>
          <Text dimColor>[</Text>
          <Text color="cyan">{'█'.repeat(acc)}</Text>
          <Text color="magenta">{'█'.repeat(sn)}</Text>
          <Text dimColor>{'░'.repeat(free)}</Text>
          <Text dimColor>] </Text>
          <Text color="cyan" bold>{l.percent.toFixed(1)}%</Text>
          <Text color="magenta"> +{ses.toFixed(1)}%</Text>
          <Text dimColor> ↻ {remaining(l.resetsAt, now)}</Text>
        </Box>
      )
    })

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        <Box justifyContent="space-between">
          <Text color="cyan" bold>USAGE MONITOR</Text>
          <Text>
            <Text color="cyan">█</Text><Text> account </Text>
            <Text color="magenta">█</Text><Text> this session </Text>
            <Text dimColor>░ free</Text>
          </Text>
        </Box>
        {rows.length ? rows : <Text dimColor>no rate-limit data yet (subscription accounts report it after the first response)</Text>}
        <Box>
          <Text bold>ses </Text>
          <Text color="magenta" bold>{fmt(total)}</Text>
          <Text> tok </Text>
          <Text dimColor>| </Text>
          <Text>in </Text><Text bold>{fmt(d.input)}</Text>
          <Text> out </Text><Text bold>{fmt(d.output)}</Text>
          <Text> cache </Text><Text bold>{fmt(d.cacheRead + d.cacheWrite)}</Text>
          <Text dimColor> | </Text>
          <Text>cost </Text><Text bold>${d.costUsd.toFixed(2)}</Text>
          <Text dimColor> | </Text>
          <Text>model </Text><Text color="yellow" bold>{d.model || '—'}</Text>
        </Box>
      </Box>
    )
  })
}
