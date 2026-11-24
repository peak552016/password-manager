let clearTimer: ReturnType<typeof setTimeout> | undefined

/** Copy, then try to wipe the clipboard after 30 s (best-effort; iOS may refuse). */
export async function copySecret(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
  clearTimeout(clearTimer)
  clearTimer = setTimeout(async () => {
    try {
      if ((await navigator.clipboard.readText()) === text) await navigator.clipboard.writeText('')
    } catch {
      /* not allowed in background; ignore */
    }
  }, 30_000)
}
