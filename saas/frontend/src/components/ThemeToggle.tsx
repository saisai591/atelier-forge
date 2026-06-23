import { Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '../hooks/useThemeMode'

export default function ThemeToggle({
  theme,
  onToggle,
  compact = false,
}: {
  theme: ThemeMode
  onToggle: () => void
  compact?: boolean
}) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition ${
        isDark
          ? 'border-white/10 bg-white/[0.055] text-slate-100 hover:bg-white/[0.08]'
          : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
      } ${compact ? 'h-10 px-3 text-xs' : 'px-4 py-3 text-sm'}`}
      aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {compact ? null : isDark ? 'Mode clair' : 'Mode sombre'}
    </button>
  )
}
