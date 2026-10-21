// Always in sync: which mod a session loaded and which one sits on disk, so a session behind says to reload it.
// The I/O helpers read with `$.fs` and run processes by argv only, never a shell.
import type { EngineInterface } from 'claude-code'

export type Io = Pick<EngineInterface, 'fs' | 'process'>
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

/** The version of the mod at `root`: hooks/*, agents/*, skills/*\/* and .claude-plugin/plugin.json. null when unreadable. */
export async function versionAt($: Pick<Io, 'fs'>, root: string): Promise<string | null> {
  try {
    const files: [string, string][] = []
    const add = async (dir: string) => {
      for (const e of await $.fs.list(`${root}/${dir}`).catch(() => [])) if (e.kind === 'file') files.push([`${dir}/${e.name}`, await $.fs.read(`${root}/${dir}/${e.name}`)])
    }
    await add('hooks')
    await add('agents')
    for (const s of await $.fs.list(`${root}/skills`).catch(() => [])) if (s.kind === 'dir') await add(`skills/${s.name}`)
    files.push(['.claude-plugin/plugin.json', await $.fs.read(`${root}/.claude-plugin/plugin.json`)])
    return await versionOf(files)
  } catch {
    return null // a file removed mid-read: no version this round
  }
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

/**
 * True when git reports no uncommitted or untracked change under `root`. Argv only; no index lock taken and no
 * fsmonitor program started (git status runs no repo hooks). Not a repo: false.
 */
export async function isClean($: Pick<Io, 'process'>, root: string): Promise<boolean> {
  const r = await $.process.run(['/usr/bin/git', '--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain', '--', '.'], { cwd: root }).catch(() => null)
  return !!r && r.exitCode === 0 && r.stdout.trim() === ''
}

/** The last 400 KB of a file, argv only; '' when unreadable. `path` must be absolute, so it never reads as a flag, and a
 * regular file (a FIFO would hold the read). */
export async function tailOf($: Pick<Io, 'process' | 'fs'>, path: string): Promise<string> {
  if (!path.startsWith('/') || (await $.fs.stat(path).catch(() => null))?.kind !== 'file') return ''
  const r = await $.process.run(['/usr/bin/tail', '-c', '400000', path], { timeoutMs: 5000 }).catch(() => null) // a swap to a FIFO after the stat
  return r?.exitCode === 0 ? r.stdout : ''
}

/** The mod on disk for a session loaded from `loadedRoot`. Git runs only when the version differs from `loaded`: in
 * sync, nothing is spawned (the version is what loaded, whatever else the checkout holds). */
export async function diskOf($: Pick<Io, 'fs' | 'process'>, loadedRoot: string, home: string, loaded?: string): Promise<Disk | null> {
  const cached = loadedRoot.startsWith(`${home}/.claude/plugins/cache/`)
  const installed = cached ? await $.fs.read(`${home}/.claude/plugins/installed_plugins.json`).then(JSON.parse).catch(() => null) : null
  let at = diskRootOf(installed, loadedRoot, home)
  if (at && !at.checkout) { // the path as written can link out of the cache: where it lands must stay inside it
    const real = (p: string) => $.fs.stat(p, { resolve: true }).then(s => s.realPath ?? null, () => null)
    const [r, c] = await Promise.all([real(at.root), real(`${home}/.claude/plugins/cache/${loadedRoot.slice(`${home}/.claude/plugins/cache/`.length).split('/')[0]}/agentville`)])
    at = r && c && r.startsWith(`${c}/`) ? { root: r, checkout: false } : null
  }
  const ver = at && (await versionAt($, at.root))
  if (!at || !ver) return null
  return { ver, clean: !at.checkout || ver === loaded || (await isClean($, at.root)) }
}

/**
 * One check, every SYNC_EVERY inside `listen`. Answers the version on disk this session is behind (put it in the beat as
 * `syncStuck`), or null: in sync, a checkout mid-edit, or no version readable. The mod never reloads itself: the app
 * refuses a plugin's /reload-plugins over its remote connection (142 of 142 tries refused, 2026-10-20), so the pane says
 * to type it in that session's chat.
 */
export async function syncTick($: Io, s: { root: string; home: string; loaded: string }): Promise<{ stuck: string | null; disk: Disk | null }> {
  const disk = await diskOf($, s.root, s.home, s.loaded)
  return { stuck: disk?.clean && disk.ver !== s.loaded ? disk.ver : null, disk }
}
