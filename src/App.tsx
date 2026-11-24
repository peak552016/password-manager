import { useCallback, useEffect, useState } from 'react'
import { hasAccount, type Session } from './lib/vault'
import { useAutoLock } from './lib/useAutoLock'
import { Setup } from './components/Setup'
import { Unlock } from './components/Unlock'
import { VaultView } from './components/VaultView'

type State = { kind: 'loading' } | { kind: 'setup' } | { kind: 'locked' } | { kind: 'open'; session: Session }

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    hasAccount().then((exists) => setState({ kind: exists ? 'locked' : 'setup' }))
  }, [])

  const lock = useCallback(() => setState({ kind: 'locked' }), [])
  const open = useCallback((session: Session) => setState({ kind: 'open', session }), [])
  useAutoLock(state.kind === 'open', lock)

  switch (state.kind) {
    case 'loading':
      return null
    case 'setup':
      return <Setup onDone={open} />
    case 'locked':
      return <Unlock onUnlock={open} />
    case 'open':
      return <VaultView session={state.session} onLock={lock} />
  }
}
