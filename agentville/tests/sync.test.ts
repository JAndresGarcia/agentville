import { expect, test } from 'claude-code/testing'

import { diskOf, diskRootOf, isClean, isMod, syncTick, tailOf, versionAt, versionOf } from '../hooks/sync'
import type { Io } from '../hooks/sync'

const HOME = '/Users/dev'
const CACHE = `${HOME}/.claude/plugins/cache/`
const REPO = '/Users/dev/code/agentville/agentville'

// A fake engine: files in a map, git and tail answered by `git`, and a recorded command.run (never called).
// `links`: where a path lands when it is not where it says (a symlink), as stat's realPath answers with resolve.
function fake(files: Record<string, string>, opts: { dirty?: () => boolean; links?: Record<string, string> } = {}) {
  const runs: unknown[] = [], argvs: (readonly string[])[] = [], inits: unknown[] = []
  const list = async (dir: string) => {
    const names = new Map<string, 'file' | 'dir'>()
    for (const p of Object.keys(files)) if (p.startsWith(dir + '/')) { const rest = p.slice(dir.length + 1).split('/'); names.set(rest[0]!, rest.length > 1 ? 'dir' : 'file') }
    if (!names.size) throw new Error('ENOENT')
    return [...names].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false }))
  }
  const read = async (p: string) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]! }
  const run = async (argv: readonly string[], init?: { cwd?: string; timeoutMs?: number }) => {
    argvs.push(argv); inits.push(init)
    if (argv[0] === '/usr/bin/git') return { exitCode: 0, stdout: opts.dirty?.() ? ' M hooks/beat.ts\n' : '', stderr: '', cwd: init?.cwd }
    return { exitCode: 0, stdout: 'TAIL', stderr: '' }
  }
  // a path ending in .fifo is a FIFO; any other in `files` a regular file, one that holds some a folder
  const stat = async (p: string, o?: { resolve: boolean }) => {
    const dir = Object.keys(files).some(f => f.startsWith(p + '/')), link = opts.links?.[p]
    if (!(p in files) && !dir && !link) throw new Error('ENOENT')
    return { kind: dir || link ? 'dir' as const : p.endsWith('.fifo') ? 'other' as const : 'file' as const, size: 1, mtimeMs: 0, isLink: !!link, ...(o?.resolve ? { realPath: link ?? p } : {}) }
  }
  const $ = {
    fs: { list, read, stat },
    process: { run },
    command: { run: async (a: unknown) => { runs.push(a) } },
  } as unknown as Io
  return { $, runs, argvs, inits, files }
}
const mod = (root: string, beat = 'v1') => ({ [`${root}/hooks/beat.ts`]: beat, [`${root}/hooks/hooks.json`]: '{}', [`${root}/agents/builder.md`]: 'b', [`${root}/skills/flujo/SKILL.md`]: 's', [`${root}/.claude-plugin/plugin.json`]: '{"name":"agentville"}' })

test('versionOf: 12 hex, independent of order, changes with any name or content', async () => {
  const a = await versionOf([['hooks/a.ts', 'x'], ['hooks/b.ts', 'y']])
  expect(isMod(a)).toBe(true)
  expect(await versionOf([['hooks/b.ts', 'y'], ['hooks/a.ts', 'x']])).toBe(a)
  expect((await versionOf([['hooks/a.ts', 'x'], ['hooks/b.ts', 'z']])) === a).toBe(false)
  expect((await versionOf([['hooks/a.ts', 'xy'], ['hooks/b.ts', '']])) === a).toBe(false)
  expect([isMod('abc'), isMod('0123456789AB'), isMod('0123456789ab'), isMod(12)]).toEqual([false, false, true, false])
})

test('versionAt reads hooks, agents, skills/*/* and plugin.json, and nothing else', async () => {
  const f = fake({ ...mod(REPO), [`${REPO}/tests/x.test.ts`]: 'ignored', [`${REPO}/README.md`]: 'ignored' })
  const v = await versionAt(f.$, REPO)
  expect(isMod(v)).toBe(true)
  f.files[`${REPO}/tests/x.test.ts`] = 'changed'
  expect(await versionAt(f.$, REPO)).toBe(v)
  f.files[`${REPO}/skills/flujo/SKILL.md`] = 's2'
  expect((await versionAt(f.$, REPO)) === v).toBe(false)
  delete f.files[`${REPO}/.claude-plugin/plugin.json`]
  expect(await versionAt(f.$, REPO)).toBe(null)
  expect(f.argvs).toEqual([]) // no process at all
})

test('diskRootOf: a directory install is its own checkout; a cache install follows installed_plugins.json, inside its cache only', () => {
  expect(diskRootOf(null, REPO, HOME)).toEqual({ root: REPO, checkout: true })
  const old = `${CACHE}jandresgarcia/agentville/0.1.0`, next = `${CACHE}jandresgarcia/agentville/0.2.0`
  const inst = (p: unknown, key = 'agentville@jandresgarcia') => ({ version: 2, plugins: { [key]: [{ scope: 'user', installPath: p }] } })
  expect(diskRootOf(inst(next), old, HOME)).toEqual({ root: next, checkout: false })
  expect(diskRootOf(inst(next, 'agentville@other'), old, HOME)).toBe(null)
  // the marketplace name comes from the loaded path, never a fixed id: an install kept under an older name still resolves
  expect(diskRootOf(inst(`${CACHE}my-fork/agentville/2`, 'agentville@my-fork'), `${CACHE}my-fork/agentville/1`, HOME)).toEqual({ root: `${CACHE}my-fork/agentville/2`, checkout: false })
  expect(diskRootOf(inst('/tmp/evil'), old, HOME)).toBe(null)
  expect(diskRootOf(inst(`${CACHE}jandresgarcia/agentville/../../../../evil`), old, HOME)).toBe(null)
  expect(diskRootOf(inst(`${CACHE}ponytail/agentville/1`), old, HOME)).toBe(null)
  expect(diskRootOf(inst(42), old, HOME)).toBe(null)
  expect(diskRootOf('garbage', old, HOME)).toBe(null)
})

test('isClean and tailOf run argv only, never a shell; tailOf reads only a regular file', async () => {
  let dirty = false
  const f = fake({ '/Users/dev/.claude/projects/x/1.jsonl': '', '/Users/dev/p.fifo': '' }, { dirty: () => dirty })
  expect(await isClean(f.$, REPO)).toBe(true)
  dirty = true
  expect(await isClean(f.$, REPO)).toBe(false)
  expect(await tailOf(f.$, '/Users/dev/.claude/projects/x/1.jsonl')).toBe('TAIL')
  expect(await tailOf(f.$, '-n1')).toBe('')
  expect(await tailOf(f.$, '/Users/dev/p.fifo')).toBe('') // never run on a FIFO
  expect(await tailOf(f.$, '/Users/dev/gone.jsonl')).toBe('')
  expect(f.argvs).toEqual([['/usr/bin/git', '--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain', '--', '.'], ['/usr/bin/git', '--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain', '--', '.'], ['/usr/bin/tail', '-c', '400000', '/Users/dev/.claude/projects/x/1.jsonl']])
  expect(f.inits[2]).toEqual({ timeoutMs: 5000 }) // a FIFO swapped in after the stat never holds the sync
  const timedOut = { fs: { stat: async () => ({ kind: 'file' }) }, process: { run: async () => { throw new Error('timed out') } } } as unknown as Io
  expect(await tailOf(timedOut, '/Users/dev/.claude/projects/x/1.jsonl')).toBe('') // a run that rejects (its timeout) reads as nothing
})

test('diskOf: a dirty checkout does not count; a cache install needs no git', async () => {
  const f = fake(mod(REPO), { dirty: () => true })
  expect(await diskOf(f.$, REPO, HOME)).toEqual({ ver: (await versionAt(f.$, REPO))!, clean: false })
  const old = `${CACHE}jandresgarcia/agentville/0.1.0`, next = `${CACHE}jandresgarcia/agentville/0.2.0`
  const g = fake({ ...mod(old), ...mod(next, 'v2'), [`${HOME}/.claude/plugins/installed_plugins.json`]: JSON.stringify({ plugins: { 'agentville@jandresgarcia': [{ installPath: next }] } }) })
  const d = await diskOf(g.$, old, HOME)
  expect([d?.ver === (await versionAt(g.$, next)), d?.ver === (await versionAt(g.$, old)), d?.clean, g.argvs]).toEqual([true, false, true, []])
  const h = fake(mod(REPO), { dirty: () => true }), v = (await versionAt(h.$, REPO))!
  expect([await diskOf(h.$, REPO, HOME, v), h.argvs]).toEqual([{ ver: v, clean: true }, []]) // in sync: no git at all
})

// AU item 7: installPath was checked as a string, so a link inside the cache could load a version from anywhere.
test('diskOf: a cache install whose installPath links out of the marketplace cache folder has no disk root', async () => {
  const old = `${CACHE}jandresgarcia/agentville/0.1.0`, next = `${CACHE}jandresgarcia/agentville/0.2.0`, evil = '/tmp/evil/agentville'
  const inst = { [`${HOME}/.claude/plugins/installed_plugins.json`]: JSON.stringify({ plugins: { 'agentville@jandresgarcia': [{ installPath: next }] } }) }
  const g = fake({ ...mod(old), ...mod(next, 'v2'), ...mod(evil, 'v3'), ...inst }, { links: { [next]: evil } }) // readable as written too
  expect(await diskOf(g.$, old, HOME)).toBe(null)
  const inside = `${CACHE}jandresgarcia/agentville/0.2.0-real`
  const h = fake({ ...mod(old), ...mod(inside, 'v2'), ...inst }, { links: { [next]: inside } }) // a link that stays inside counts, read where it lands
  expect((await diskOf(h.$, old, HOME))?.ver).toBe((await versionAt(h.$, inside))!)
})

// The listen loop as register.tsx runs it: one check every 20 s.
async function loop(f: ReturnType<typeof fake>, loaded: string, ticks: number, edit: (i: number) => void = () => {}) {
  const all: (string | null)[] = []
  for (let i = 0; i < ticks; i++) { edit(i); all.push((await syncTick(f.$, { root: REPO, home: HOME, loaded })).stuck) }
  return all
}

test('syncTick: a clean newer version is stuck at once, on every tick, and never runs /reload-plugins', async () => {
  const f = fake(mod(REPO))
  const v1 = (await versionAt(f.$, REPO))!
  f.files[`${REPO}/hooks/beat.ts`] = 'v2'
  const v2 = (await versionAt(f.$, REPO))!
  expect(await loop(f, v1, 4)).toEqual([v2, v2, v2, v2])
  expect(f.runs).toEqual([])
})

test('syncTick: in sync, a dirty checkout or an unreadable disk is not stuck', async () => {
  const f = fake(mod(REPO)), v1 = (await versionAt(f.$, REPO))!
  expect(await loop(f, v1, 2)).toEqual([null, null])
  let dirty = true
  const g = fake(mod(REPO, 'v3'), { dirty: () => dirty })
  expect(await loop(g, v1, 2)).toEqual([null, null])
  dirty = false
  expect(await loop(g, v1, 1)).toEqual([(await versionAt(g.$, REPO))!])
  const h = fake({})
  expect(await loop(h, v1, 1)).toEqual([null])
  expect([f.runs, g.runs, h.runs]).toEqual([[], [], []])
})
