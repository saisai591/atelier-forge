import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useThemeMode } from '../hooks/useThemeMode'

export default function Layout() {
  const { theme, isDark, toggleTheme } = useThemeMode()

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'bg-[#070a10] text-slate-100' : 'bg-slate-100 text-slate-950'}`}>
      <Sidebar theme={theme} isDark={isDark} onToggleTheme={toggleTheme} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
