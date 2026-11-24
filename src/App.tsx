import { useCallback, useEffect, useState } from 'react'
import { hasAccount, type Session } from './lib/vault'
import { useAutoLock } from './lib/useAutoLock'
import { Setup } from './components/Setup'
import { Unlock } from './components/Unlock'
import { VaultView } from './components/VaultView'
import { Splash } from './components/Splash'

type State = { kind: 'loading' } | { kind: 'setup' } | { kind: 'locked' } | { kind: 'open'; session: Session }

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  // intro: 'on' → splash covers everything, 'leaving' → screen mounts underneath, 'off' → gone
  const [intro, setIntro] = useState<'on' | 'leaving' | 'off'>('on')
  const introLeave = useCallback(() => setIntro('leaving'), [])
  const introDone = useCallback(() => setIntro('off'), [])

  useEffect(() => {
    hasAccount().then((exists) => setState({ kind: exists ? 'locked' : 'setup' }))
  }, [])

  const lock = useCallback(() => setState({ kind: 'locked' }), [])
  const open = useCallback((session: Session) => setState({ kind: 'open', session }), [])
  useAutoLock(state.kind === 'open', lock)

  let screen = null
  if (intro !== 'on') {
    if (state.kind === 'setup') screen = <Setup onDone={open} />
    else if (state.kind === 'locked') screen = <Unlock onUnlock={open} />
    else if (state.kind === 'open') screen = <VaultView session={state.session} onLock={lock} />
  }

  return (
    <>
      {screen}
      {intro !== 'off' && <Splash ready={state.kind !== 'loading'} onLeave={introLeave} onDone={introDone} />}
    </>
  )
}
