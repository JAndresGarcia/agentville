import { expect, test } from 'claude-code/testing'

import { chatUrl, diskColor, dueToMeasure, lockFree, ownLocal, parentLink, parseDf, parseDu, parseRegistry, rankWorktrees, relinkGrep, relinkHits, sessionsFind, SEP, parseSessions, recordOf, spawnedOf } from '../hooks/disk'
import type { BeatState, Session } from '../hooks/disk'

const DAY = 24 * 60 * 60_000
const NOW = 1_800_000_000_000
const R = '/Users/dev/code/demo/.claude/worktrees/'
const U = '/Users/dev' // the home

// Same shape as the app's git-worktrees.json: worktrees keyed by name, extra fields, ms timestamps. All values fake.
const wt = (name: string, leasedBy: string | null, createdAt: number, path = R + name) =>
  ({ name, path, leasedBy, baseRepo: '/Users/dev/code/demo', branch: 'claude/' + name, sourceBranch: 'main', createdAt, originRemote: { name: 'origin' }, autoTrusted: true })
const REGISTRY = {
  schemaVersion: 2,
  worktrees: {
    alpha: wt('alpha', 'local_aaaa-1111', NOW - 40 * DAY),
    beta: wt('beta', 'local_bbbb-2222', NOW - 2 * DAY),
    gamma: wt('gamma', null, NOW - 31 * DAY),
    delta: wt('delta', 'local_dddd-4444', NOW - 5 * DAY),
    rel: wt('rel', null, NOW, 'demo/.claude/worktrees/rel'),
    other: wt('other', null, NOW, '/Users/dev/code/demo/elsewhere/other'),
    evil: wt('evil', 'local_x; rm -rf /', NOW - DAY),
  },
  untrackedDirGc: {}, originUrls: {}, originPins: {}, pendingTombstones: [],
}

test('parseRegistry keeps absolute worktree paths and only clean leases', () => {
  const r = parseRegistry(REGISTRY, U)!
  expect(r.map((w) => w.name)).toEqual(['alpha', 'beta', 'gamma', 'delta', 'evil'])
  expect(r[0]).toEqual({ name: 'alpha', path: R + 'alpha', createdAt: NOW - 40 * DAY, leasedBy: 'local_aaaa-1111' })
  expect(r.find((w) => w.name === 'evil')!.leasedBy).toBe(null)
  expect(r.find((w) => w.name === 'gamma')!.leasedBy).toBe(null)
})

// AU item 8: "/.claude/worktrees/" anywhere in the path was enough, so du could be pointed at any folder.
test('parseRegistry keeps only <folder under home>/.claude/worktrees/<name>, with no . or .. part', () => {
  const only = (path: string) => parseRegistry({ ...REGISTRY, worktrees: { x: wt('x', null, NOW, path) } }, U)
  expect(only(R + 'x')).toHaveLength(1)
  expect(only(`${U}/.claude/worktrees/x`)).toHaveLength(1) // a session started in home
  for (const bad of ['/tmp/.claude/worktrees/x', '/Users/devil/.claude/worktrees/x', `${R}x/../../../../../etc`, `${R}../x`, `${R}./x`, `${R}x/sub`, `${U}/a/.claude/worktrees/`, `${U}/.claude/worktrees.x/y`])
    expect([bad, only(bad)]).toEqual([bad, []])
})

test('parseRegistry returns null for any other schema or junk', () => {
  expect(parseRegistry({ ...REGISTRY, schemaVersion: 3 }, U)).toBe(null)
  expect(parseRegistry({ worktrees: REGISTRY.worktrees }, U)).toBe(null)
  expect(parseRegistry(null, U)).toBe(null)
  expect(parseRegistry('x', U)).toBe(null)
  expect(parseRegistry({ schemaVersion: 2 }, U)).toBe(null)
  expect(parseRegistry({ schemaVersion: 2, worktrees: [wt('arr', null, 1), null, 7] }, U)).toEqual([{ name: 'arr', path: R + 'arr', createdAt: 1, leasedBy: null }])
})

test('diskColor thresholds', () => {
  expect(diskColor(10)).toBe('good')
  expect(diskColor(9.99)).toBe('mid')
  expect(diskColor(5)).toBe('mid')
  expect(diskColor(4.99)).toBe('bad')
})

test('parseDf reads the Available column', () => {
  const mac = 'Filesystem     1024-blocks      Used Available Capacity iused ifree %iused  Mounted on\n/dev/disk3s5    482797652 455000000   4194304    99%  1000 41943040    0%   /System/Volumes/Data\n'
  expect(parseDf(mac)).toBe(4194304)
  expect(parseDf('Filesystem 1024-blocks Used Available Capacity Mounted on\nmap auto home 0 0 0 100% /home\n')).toBe(0)
  expect(parseDf('')).toBe(null)
  expect(parseDf('garbage')).toBe(null)
})

test('parseDu reads kb and paths with spaces', () => {
  expect(parseDu(`1024\t${R}alpha\n52\t/Users/dev/My Code/.claude/worktrees/b\ndu: cannot read x\n`)).toEqual([
    { kb: 1024, path: R + 'alpha' },
    { kb: 52, path: '/Users/dev/My Code/.claude/worktrees/b' },
  ])
  expect(parseDu('')).toEqual([])
})

test('dueToMeasure: df every 5 min, du every 30 min', () => {
  expect(dueToMeasure(undefined, NOW)).toEqual({ df: true, du: true })
  expect(dueToMeasure({ at: NOW - 4 * 60_000, duAt: NOW - 29 * 60_000 }, NOW)).toEqual({ df: false, du: false })
  expect(dueToMeasure({ at: NOW - 5 * 60_000, duAt: NOW - 29 * 60_000 }, NOW)).toEqual({ df: true, du: false })
  expect(dueToMeasure({ at: NOW, duAt: NOW - 30 * 60_000 }, NOW)).toEqual({ df: false, du: true })
})

test('lockFree after 10 minutes', () => {
  expect(lockFree(undefined, NOW)).toBe(true)
  expect(lockFree(NOW - 9 * 60_000, NOW)).toBe(false)
  expect(lockFree(NOW - 10 * 60_000, NOW)).toBe(true)
})

test('rankWorktrees: top 6 by size, status and 30-day count', () => {
  const ses = (id: string, title: string, lastActivityAt: number, isArchived = false): Session => ({ cliSessionId: id, title, isArchived, lastActivityAt })
  const sessions: Record<string, Session> = {
    'local_aaaa-1111': ses('s-a', 'Old task', NOW - 35 * DAY),
    'local_bbbb-2222': ses('s-b', 'Busy task', NOW - DAY),
    'local_dddd-4444': ses('s-d', 'Archived task', NOW - 3 * DAY, true),
  }
  const beats: Record<string, BeatState> = { 's-b': { name: 'Beat B', ended: false, pending: true }, 's-a': { name: '', ended: false, pending: false } }
  const entries = [...parseRegistry(REGISTRY, U)!, ...['e1', 'e2', 'e3'].map((n) => ({ name: n, path: R + n, createdAt: NOW, leasedBy: null }))]
  const sizes = [
    { path: R + 'alpha', kb: 500 }, { path: R + 'beta', kb: 900 }, { path: R + 'gamma', kb: 100 },
    { path: R + 'delta', kb: 700 }, { path: R + 'evil', kb: 50 }, { path: R + 'e1', kb: 300 }, { path: R + 'e2', kb: 200 },
  ]
  const { top, stale } = rankWorktrees(entries, sizes, sessions, beats, NOW)
  expect(top).toEqual([
    { name: 'Beat B', path: R + 'beta', kb: 900, status: 'active' },
    { name: 'Archived task', path: R + 'delta', kb: 700, status: 'ended' },
    { name: 'Old task', path: R + 'alpha', kb: 500, status: 'paused' },
    { name: 'e1', path: R + 'e1', kb: 300, status: 'reserva' },
    { name: 'e2', path: R + 'e2', kb: 200, status: 'reserva' },
    { name: 'gamma', path: R + 'gamma', kb: 100, status: 'reserva' },
  ])
  // alpha (session idle 35 days) and gamma (unleased, created 31 days ago).
  expect(stale).toBe(2)
  expect(rankWorktrees(entries, sizes, sessions, { 's-b': { name: 'B', ended: true, pending: true } }, NOW).top[0]!.status).toBe('ended')
})

test('parseSessions keeps four fields of each well-formed chunk and drops the rest', () => {
  const chunk = (id: string, body: string) => `${SEP}${id}\n${body}\n`
  const out = parseSessions([
    chunk('local_a1', JSON.stringify({ cliSessionId: 'cli-1', title: 'T'.repeat(200), isArchived: true, lastActivityAt: 7, secret: 'x' })),
    chunk('local_b2', JSON.stringify({ cliSessionId: 'cli-2' })), // missing fields: defaults
    chunk('local_c3', '{not json'),
    chunk('local_d4', JSON.stringify({ cliSessionId: 'bad id;rm' })), // not an id
    chunk('nope', JSON.stringify({ cliSessionId: 'cli-5' })), // not a lease
    chunk('local_e5', JSON.stringify([1, 2])),
    'garbage with no separator',
  ].join(''))
  expect(out).toEqual({
    local_a1: { cliSessionId: 'cli-1', title: 'T'.repeat(80), isArchived: true, lastActivityAt: 7 },
    local_b2: { cliSessionId: 'cli-2', title: '', isArchived: false, lastActivityAt: 0 },
  })
  expect(parseSessions('')).toEqual({})
})

// Sub-offices (B1): the app's session records, as the probe saw them (all values fake). The link is spawnedFrom.sessionId.
const PARENT = { sessionId: 'local_p-1', cliSessionId: 'cli-parent', title: 'Padre', isArchived: false }
const CHILD = { sessionId: 'local_c-1', cliSessionId: 'cli-child', spawnedFrom: { sessionId: 'local_p-1' }, priorCliSessionIds: ['old'] }

test('parentLink: a valid pair gives the parent CLI id', () => {
  expect(parentLink(CHILD, PARENT, 'cli-child')).toBe('cli-parent')
  expect(spawnedOf(CHILD)).toBe('local_p-1')
})

test('parentLink: anything off gives null', () => {
  const bad: [unknown, unknown, string][] = [
    [CHILD, PARENT, 'someone-else'], // not this session's record
    [{ ...CHILD, spawnedFrom: { sessionId: 'p-1' } }, { ...PARENT, sessionId: 'p-1' }, 'cli-child'], // no local_ prefix
    [{ ...CHILD, spawnedFrom: { sessionId: 'local_../x' } }, { ...PARENT, sessionId: 'local_../x' }, 'cli-child'],
    [CHILD, { ...PARENT, sessionId: 'local_other' }, 'cli-child'], // sessionId mismatch
    [CHILD, { ...PARENT, cliSessionId: 'cli-child' }, 'cli-child'], // self link
    [CHILD, { ...PARENT, cliSessionId: 'cli parent; rm' }, 'cli-child'], // bad parent id
    [CHILD, { ...PARENT, cliSessionId: 7 }, 'cli-child'],
    [{ ...CHILD, cliSessionId: 7 }, PARENT, '7'],
    [{ ...CHILD, spawnedFrom: { sessionId: 3 } }, PARENT, 'cli-child'],
    [{ ...CHILD, spawnedFrom: 'local_p-1' }, PARENT, 'cli-child'],
    [{ cliSessionId: 'cli-child' }, PARENT, 'cli-child'], // missing spawnedFrom
    [{ cliSessionId: 'cli-child', forkedFromSessionId: 'local_p-1' }, PARENT, 'cli-child'], // a fork is not a child
    [CHILD, { cliSessionId: 'cli-parent' }, 'cli-child'], // parent without sessionId
    [[CHILD], PARENT, 'cli-child'], [CHILD, [PARENT], 'cli-child'],
    [null, PARENT, 'cli-child'], [CHILD, null, 'cli-child'], ['x', 'y', 'cli-child'], [undefined, undefined, ''],
  ]
  for (const [own, parent, me] of bad) expect([own, parent, parentLink(own, parent, me)]).toEqual([own, parent, null])
  expect([spawnedOf(null), spawnedOf({ spawnedFrom: null }), spawnedOf('local_x')]).toEqual([null, null, null])
})

test('relinkHits keeps at most 20 paths of the records\' shape under the folder, relative to it', () => {
  const D = '/r', ok = 'ab-12/cd-34/local_e-5.json'
  expect(relinkHits([ok, '../x/local_a.json', 'ab/cd/other.json', 'ab/cd/local_a b.json', 'AB/cd/local_a.json', 'ab/cd/ef/local_a.json'].map(p => `${D}/${p}`).join('\n') + `\n/abs/a/local_b.json\n${ok}\n`, D)).toEqual([ok])
  expect(relinkHits(Array.from({ length: 25 }, (_, i) => `${D}/a/b/local_${i}.json`).join('\n'), D)).toEqual(Array.from({ length: 20 }, (_, i) => `a/b/local_${i}.json`))
  expect(relinkHits('', D)).toEqual([])
})

test('relinkGrep and sessionsFind are argv only: a fixed-string grep and a find of regular files three folders down', () => {
  expect(relinkGrep('s-1', '/r')).toEqual(['/usr/bin/grep', '-rlF', '--include=local_*.json', '-e', 's-1', '--', '/r'])
  expect(sessionsFind('/app', ['local_a', 'local_b'])).toEqual(['/usr/bin/find', '/app/claude-code-sessions', '-mindepth', '3', '-maxdepth', '3', '-type', 'f', '(', '-name', 'local_a.json', '-o', '-name', 'local_b.json', ')'])
})

// "Ir al chat" (D): this session's own record id, from its own record only, and the one link built from it.
const UUID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', LOCAL_ID = `local_${UUID}`
const OWN = { sessionId: LOCAL_ID, cliSessionId: 'cli-me', title: 'Yo' }

test('ownLocal: this session\'s record under its own file name gives its local_<uuid> id; anything off gives null', () => {
  expect(ownLocal(OWN, 'cli-me', `${LOCAL_ID}.json`)).toBe(LOCAL_ID)
  const bad: [unknown, string, string][] = [
    [OWN, 'cli-other', `${LOCAL_ID}.json`], // another session's record
    [{ ...OWN, sessionId: 'local_c-1' }, 'cli-me', 'local_c-1.json'], // not a uuid
    [{ ...OWN, sessionId: `local_${'-'.repeat(36)}` }, 'cli-me', `local_${'-'.repeat(36)}.json`], // 36 characters, not its 8-4-4-4-12 shape
    [{ ...OWN, sessionId: `local_${UUID.toUpperCase()}` }, 'cli-me', `local_${UUID.toUpperCase()}.json`],
    [{ ...OWN, sessionId: `local_../${UUID.slice(3)}` }, 'cli-me', `local_../${UUID.slice(3)}.json`],
    [OWN, 'cli-me', `local_${UUID.replace('0a', '0b')}.json`], // a mismatched file name
    [OWN, 'cli-me', LOCAL_ID], [{ ...OWN, sessionId: 7 }, 'cli-me', '7.json'], [{ ...OWN, cliSessionId: undefined }, '', `${LOCAL_ID}.json`],
    [null, 'cli-me', `${LOCAL_ID}.json`], ['x', 'cli-me', 'x.json'], [[OWN], 'cli-me', `${LOCAL_ID}.json`],
  ]
  for (const [own, me, file] of bad) expect([own, file, ownLocal(own, me, file)]).toEqual([own, file, null])
})

test('chatUrl: claude://claude.ai/epitaxy/ and a local_<uuid> id, nothing else', () => {
  expect(chatUrl(LOCAL_ID)).toBe(`claude://claude.ai/epitaxy/${LOCAL_ID}`)
  for (const bad of ['local_x', `local_${'-'.repeat(36)}`, `local_${'a'.repeat(36)}`, `local_${UUID.slice(1)}a`, `local_${UUID.toUpperCase()}`, `${LOCAL_ID}\n`, `${LOCAL_ID}?`, `${LOCAL_ID}?x=1`, UUID, `x${LOCAL_ID}`, `/${LOCAL_ID}`, `local_${UUID}0`, '', undefined, null, 7, ['a']]) expect([bad, chatUrl(bad)]).toEqual([bad, null])
})

test('recordOf: the whole record when it parses; cut short, each field from its first compact name; a name in a string never counts', () => {
  const full = JSON.stringify({ sessionId: 'local_c-1', cliSessionId: 'cli-child', title: 'x', isArchived: true, spawnedFrom: { sessionId: 'local_p-1', taskId: 't' }, more: 'y'.repeat(50) })
  expect(recordOf(full)).toEqual(JSON.parse(full))
  const cut = full.slice(0, -20) // cut at RECORD_MAX: no longer JSON
  expect(recordOf(cut)).toEqual({ sessionId: 'local_c-1', cliSessionId: 'cli-child', isArchived: true, spawnedFrom: { sessionId: 'local_p-1' } })
  expect(parentLink(recordOf(cut), PARENT, 'cli-child')).toBe('cli-parent')
  // a title that spells the fields is a string: its quotes are escaped, so nothing in it is read
  const sly = JSON.stringify({ title: '"cliSessionId":"evil","isArchived":true,"spawnedFrom":{"sessionId":"local_x"}', sessionId: 'local_c-1' }).slice(0, -1)
  expect(recordOf(sly)).toEqual({ sessionId: undefined, cliSessionId: undefined }) // its brace also ends the record's own fields
  // the record's own ids and flag come before its first nested object or list: a nested one with the same names never counts
  expect(recordOf('{"sessionId":"local_a","x":[{"cliSessionId":"evil","isArchived":true}],"cliSessionId":"me"')).toEqual({ sessionId: 'local_a', cliSessionId: undefined })
  expect(recordOf('{"sessionId":"local_a","cliSessionId":"me","isArchived":false,"x":{"cliSessionId":"evil"}')).toEqual({ sessionId: 'local_a', cliSessionId: 'me', isArchived: false })
  expect([recordOf(''), recordOf('[1,2'), recordOf('null'), recordOf('[1]'), recordOf('"x"')]).toEqual([null, null, null, null, null])
  expect(recordOf('{"isArchived":false,"sessionId":"a"')).toEqual({ sessionId: 'a', cliSessionId: undefined, isArchived: false })
})
