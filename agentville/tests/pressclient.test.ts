import { expect, test } from 'claude-code/testing'

import { inClient } from '../hooks/register'

// The desktop raises the pane's ui.press chain (same requestId) for a Button inside a Client before its post. A Client
// Button has an act, so the chain must leave the open card to `pressed`; a pane Button has none and still closes it.
const acts = ['hits:note-dismiss-task_1e8a823f', 'hits:card-close', 'btns-map:map-off', 'btns-o-s-other-0:start-0']
test('a Client Button press is recognized by its act, a pane Button is not', () => {
  const is = (el: string) => inClient(el, acts)
  expect([is('note-dismiss-task_1e8a823f@6'), is('note-dismiss-task_1e8a823f@7.1'), is('card-close@2'), is('map-off'), is('start-0'), is('start-0~2')]).toEqual([true, true, true, true, true, true])
  expect([is('pick-s-other'), is('floor-1'), is('idle-more'), is('more-abc'), is('note-start-task_zzz@6')]).toEqual([false, false, false, false, false])
})
