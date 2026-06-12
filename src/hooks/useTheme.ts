import { useEffect, useState } from 'react'

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem('theme')
  if (stored === 'dark') return true
  if (stored === 'light') return false
  // Default to dark — cinematic OS experience
  return true
}

export function useTheme() {
  const [dark, setDark] = useState<boolean>(getInitialDark)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  // On first mount, also sync to DOM in case SSR/hydration mismatch
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', getInitialDark() ? 'dark' : 'light')
  }, [])

  return { dark, toggle: () => setDark((d) => !d) }
}
