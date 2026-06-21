import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Package, ShoppingCart, FileText, MessageCircle, Settings, LogOut, Wrench, MonitorCog } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import api from '../api/client'

const NAV: { path: string; icon: typeof LayoutDashboard; label: string; end?: boolean }[] = [
  { path: '/',        icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/stock',   icon: Package,          label: 'Stock' },
  { path: '/orders',   icon: ShoppingCart,    label: 'Commandes' },
  { path: '/invoices', icon: FileText,        label: 'Factures' },
  { path: '/whatsapp', icon: MessageCircle,   label: 'WhatsApp' },
  { path: '/pxe',      icon: MonitorCog,      label: 'Contrôle PXE' },
  { path: '/clients',  icon: Users,           label: 'Clients' },
]

export default function Sidebar() {
  const { user, tenant, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  // Branding piloté par le tenant — le noyau reste neutre.
  const displayName = tenant?.branding?.display_name ?? tenant?.name ?? 'Forge'
  const subtitle = tenant?.business_type && tenant.business_type !== 'generic'
    ? tenant.business_type
    : 'Plateforme'

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-forge-500 rounded-lg flex items-center justify-center">
            <Wrench size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-forge-700 text-sm leading-tight truncate">{displayName}</div>
            <div className="text-xs text-gray-400 capitalize truncate">{subtitle}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ path, icon: Icon, label, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-forge-50 text-forge-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-100">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
              isActive ? 'bg-forge-50 text-forge-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          <Settings size={17} />
          Réglages
        </NavLink>
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-forge-100 flex items-center justify-center text-forge-700 text-xs font-bold shrink-0">
            {user?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-800 truncate">{user?.full_name}</div>
            <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={15} />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
