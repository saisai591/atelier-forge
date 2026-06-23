import { useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'atelieros-theme-mode'

function initialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggleTheme = () => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))

  return { theme, isDark: theme === 'dark', toggleTheme, setTheme }
}
