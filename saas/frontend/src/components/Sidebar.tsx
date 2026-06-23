import { NavLink, useNavigate } from 'react-router-dom'
import {
  BriefcaseBusiness,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MonitorCog,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import api from '../api/client'
import ThemeToggle from './ThemeToggle'
import type { ThemeMode } from '../hooks/useThemeMode'

const NAV: { path: string; icon: typeof LayoutDashboard; label: string; end?: boolean }[] = [
  { path: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/app/stock', icon: Package, label: 'Stock' },
  { path: '/app/orders', icon: ShoppingCart, label: 'Commandes' },
  { path: '/app/invoices', icon: FileText, label: 'Factures' },
  { path: '/app/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { path: '/pxe', icon: MonitorCog, label: 'Controle PXE' },
  { path: '/erp', icon: BriefcaseBusiness, label: 'ERP Atelier' },
  { path: '/app/clients', icon: Users, label: 'Clients' },
]

interface SidebarProps {
  theme: ThemeMode
  isDark: boolean
  onToggleTheme: () => void
}

export default function Sidebar({ theme, isDark, onToggleTheme }: SidebarProps) {
  const { user, tenant, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Auth is disabled during product build; this keeps the button harmless.
    }
    logout()
    navigate('/')
  }

  const displayName = tenant?.branding?.display_name ?? tenant?.name ?? 'Forge'
  const subtitle = tenant?.business_type && tenant.business_type !== 'generic'
    ? tenant.business_type
    : 'Plateforme'

  const shellClass = isDark
    ? 'border-white/10 bg-[#0b1018]/95 text-slate-100 shadow-2xl shadow-black/30'
    : 'border-slate-200 bg-white text-slate-950 shadow-xl shadow-slate-200/70'
  const borderClass = isDark ? 'border-white/10' : 'border-slate-200'
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const navIdleClass = isDark
    ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
  const navActiveClass = isDark
    ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-950/20'
    : 'border-cyan-500/25 bg-cyan-50 text-cyan-800 shadow-sm'

  return (
    <aside className={`flex w-64 shrink-0 flex-col border-r ${shellClass}`}>
      <div className={`border-b p-4 ${borderClass}`}>
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
            <Wrench size={17} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-black leading-tight">{displayName}</div>
            <div className={`truncate text-xs capitalize ${mutedClass}`}>{subtitle}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ path, icon: Icon, label, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                isActive ? navActiveClass : `border-transparent ${navIdleClass}`
              }`
            }
          >
            <Icon size={17} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={`space-y-2 border-t p-3 ${borderClass}`}>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} className="w-full justify-center" />
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
              isActive ? navActiveClass : `border-transparent ${navIdleClass}`
            }`
          }
        >
          <Home size={17} />
          <span className="truncate">Accueil modules</span>
        </NavLink>
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
              isActive ? navActiveClass : `border-transparent ${navIdleClass}`
            }`
          }
        >
          <Settings size={17} />
          <span className="truncate">Reglages</span>
        </NavLink>
        <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-white/[0.035]' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-xs font-black text-cyan-300">
            {user?.full_name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold">{user?.full_name ?? 'AtelierOS'}</div>
            <div className={`text-xs capitalize ${mutedClass}`}>{user?.role ?? 'mode atelier'}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
            isDark ? 'text-slate-400 hover:bg-rose-400/10 hover:text-rose-200' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-700'
          }`}
        >
          <LogOut size={15} />
          Sortir
        </button>
      </div>
    </aside>
  )
}
