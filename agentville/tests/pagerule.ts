// The desktop page's own gate on a pane's tree, transcribed from the page build the app loads (cf5451c9a, functions
// Ve, ze, Ie, M, N, O; mod-clicks 4c): it refuses the WHOLE tree, without a word, unless nodes < 2000, depth < 32 and
// chars < 262,144. The engine and the test kit never run it, so a test runs it on what the kit drew (`ui.drawn()`).
type Met = { nodes: number; depth: number; chars: number }
type El = { type: string; props?: Record<string, any>; hover?: unknown; press?: { plugin?: string }; client?: { plugin?: string }; group?: { plugin?: string }; children?: unknown[] }
const N = (...e: unknown[]) => e.reduce<number>((a, t) => a + ((t as { length?: number } | undefined)?.length ?? 0), 0)
const M = (e: unknown) => Object.entries(e ?? {}).reduce((a, [k, v]) => a + k.length + (typeof v === 'string' ? v.length : 0), 0)
function own(e: El): number {
  const p = e.props ?? {}
  switch (e.type) {
    case 'engine': case 'fragment': return 0
    case 'Button': return N(p.key, p.label, p.hotkey, p.action, e.press?.plugin) + M(e.hover)
    case 'Input': return N(p.key, p.label, p.placeholder, p.value, p.submitLabel, e.press?.plugin)
    case 'Select': return N(p.key, p.label, p.value, e.press?.plugin) + (p.options ?? []).reduce((a: number, o: { value: string; label: string }) => a + N(o.value, o.label), 0)
    case 'Link': return N(p.href, p.label)
    case 'Code': return N(p.source, p.language, p.path)
    case 'Markdown': return N(p.text, p.key, e.press?.plugin) + N(...(p.pressableLinks ?? []))
    case 'Svg': return N(p.source, p.alt)
    case 'Client': return N(p.key, p.module, e.client?.plugin) + (JSON.stringify(p.props ?? null) ?? '').length
    default: return M(p) + M(e.hover) + N(e.group?.plugin)
  }
}
const extra = (e: El) => (e.type === 'Select' ? e.props?.options?.length ?? 0 : e.type === 'Markdown' ? e.props?.pressableLinks?.length ?? 0 : 0)
const join = (a: Met, b: Met): Met => ({ nodes: a.nodes + b.nodes, depth: Math.max(a.depth, b.depth + 1), chars: a.chars + b.chars })
export function pageMetrics(e: unknown, d = 1): Met {
  if (typeof e === 'string') return { nodes: 1, depth: 1, chars: e.length }
  if (!e || typeof e !== 'object') return { nodes: 1, depth: 1, chars: 0 }
  if (d >= 32) return { nodes: 2000, depth: 32, chars: 0 }
  const x = e as El
  return (x.children ?? []).map(c => pageMetrics(c, d + 1)).reduce(join, { nodes: 1 + extra(x), depth: 1, chars: own(x) })
}
/** Whether the desktop page would draw this tree. */
export const pageGate = (tree: unknown) => { const m = pageMetrics(tree); return m.nodes < 2000 && m.depth < 32 && m.chars < 262144 }
