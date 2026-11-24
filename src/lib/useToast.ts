import { useEffect, useState } from 'react'

export function useToast(): [string, (m: string) => void] {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(''), 2200)
    return () => clearTimeout(t)
  }, [msg])
  return [msg, setMsg]
}
