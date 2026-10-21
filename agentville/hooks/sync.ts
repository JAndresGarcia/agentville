// Always in sync: which mod a session loaded and which one sits on disk, so a session behind says to reload it.
// The I/O helpers (register.tsx, where they are called with $) read with `$.fs` and run processes by argv only, never a shell.
/** The disk's version, and whether it counts: a checkout counts only with no uncommitted change in the plugin folder. */
export type Disk = { ver: string; clean: boolean }

export const SYNC_EVERY = 20000
/** The reload marks older versions stored per session; register.tsx's cleanup deletes this session's own and those of
 * ended sessions. Nothing writes one now. */
export const syncKey = (id: string) => `sync:${id}`
export const isMod = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{12}$/.test(v)

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
/** First 12 hex of SHA-256 over the files sorted by name, each as `name\0content\0`. */
export async function versionOf(files: [name: string, content: string][]): Promise<string> {
  const all = [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([n, c]) => `${n}\0${c}\0`).join('')
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(all))).slice(0, 12)
}

/**
 * Where the newest mod sits. A directory install (root outside the plugin cache) is its own disk root and a git
 * checkout. A cache install's disk root is the `installPath` of `agentville@<its marketplace>` in
 * installed_plugins.json, only when that path stays inside the same marketplace's cache folder. null: no disk root.
 */
export function diskRootOf(installed: unknown, root: string, home: string): { root: string; checkout: boolean } | null {
  const cache = `${home}/.claude/plugins/cache/`
  if (!root.startsWith(cache)) return { root, checkout: true }
  const mkt = root.slice(cache.length).split('/')[0] ?? ''
  const list = (installed as { plugins?: Record<string, unknown> } | null)?.plugins?.[`agentville@${mkt}`]
  if (!mkt || !Array.isArray(list)) return null
  for (const x of list) {
    const p = (x as { installPath?: unknown } | null)?.installPath
    if (typeof p === 'string' && p.startsWith(`${cache}${mkt}/agentville/`) && !p.split('/').includes('..')) return { root: p.replace(/\/+$/, ''), checkout: false }
  }
  return null
}

