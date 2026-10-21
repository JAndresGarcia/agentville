// register's shape against the engine's Register type, checked by tsc (a type only: nothing runs). It lives here, not
// in hooks/register.tsx, because the plugin directory refuses a second use of the name register in that file.
import type { Register } from 'claude-code'
import type { register } from '../hooks/register'

type RegisterShape<R extends Register> = R
export type RegisterChecked = RegisterShape<typeof register>
