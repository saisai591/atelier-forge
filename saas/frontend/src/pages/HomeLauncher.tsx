import {
  ArrowRight,
  BookOpen,
  Boxes,
  ClipboardCheck,
  Database,
  Gauge,
  HardDrive,
  MonitorCog,
  QrCode,
  Smartphone,
  Truck,
  Warehouse,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import { useThemeMode } from '../hooks/useThemeMode'

const appCards = [
  {
    title: 'Deploiement PXE',
    subtitle: 'Audit, WIM, drivers, logs.',
    path: '/pxe',
    icon: MonitorCog,
    tone: 'cyan',
    status: 'Production',
  },
  {
    title: 'Atelier ERP',
    subtitle: 'Receptions, palettes, sorties.',
    path: '/erp',
    icon: Warehouse,
    tone: 'emerald',
    status: 'Nouveau',
  },
  {
    title: 'Scanner mobile',
    subtitle: 'PDA, QR, code-barres.',
    path: '/mobile',
    icon: Smartphone,
    tone: 'blue',
    status: 'Atelier',
  },
  {
    title: 'Back-office',
    subtitle: 'Stock, clients, factures.',
    path: '/app',
    icon: Gauge,
    tone: 'slate',
    status: 'Gestion',
  },
]

const quickLinks = [
  { label: 'Images WIM', detail: 'ISO, WIM, profils', path: '/pxe', icon: Database },
  { label: 'Audits machines', detail: 'Retours PXE et etiquettes', path: '/pxe', icon: ClipboardCheck },
  { label: 'Pilotes', detail: 'Packs par modele', path: '/pxe', icon: HardDrive },
  { label: 'Palettes client', detail: 'Preparation transport', path: '/erp', icon: Truck },
  { label: 'Stock atelier', detail: 'Machines et grades', path: '/app/stock', icon: Boxes },
  { label: 'Guide', detail: 'Aide separee', path: '/guide', icon: BookOpen },
]

const toneStyles: Record<string, string> = {
  cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
  emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
  blue: 'border-blue-300/25 bg-blue-300/10 text-blue-100',
  slate: 'border-slate-300/20 bg-white/[0.06] text-slate-100',
}

function resolveLanUrl(path: string) {
  if (typeof window === 'undefined') return path
  const { protocol, hostname, port } = window.location
  const devPort = port === '5173' ? ':5173' : ''
  return `${protocol}//${hostname}${devPort}${path}`
}

function resolveApiUrl() {
  if (typeof window === 'undefined') return '/api'
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:8000/api'
  return `http://${window.location.hostname}:8000/api`
}

export default function HomeLauncher() {
  const apiUrl = resolveApiUrl()
  const { theme, isDark, toggleTheme } = useThemeMode()
  const pageClass = isDark ? 'bg-[#070a10] text-slate-100' : 'bg-slate-100 text-slate-950'
  const borderClass = isDark ? 'border-white/10' : 'border-slate-200'
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600'
  const softMutedClass = isDark ? 'text-slate-500' : 'text-slate-500'
  const titleClass = isDark ? 'text-white' : 'text-slate-950'
  const panelClass = isDark
    ? 'border-white/10 bg-white/[0.035] shadow-black/30'
    : 'border-slate-200 bg-white shadow-slate-200/70'
  const cardClass = isDark
    ? 'border-white/10 bg-white/[0.045] shadow-black/30 hover:border-cyan-300/30 hover:bg-white/[0.07]'
    : 'border-slate-200 bg-white shadow-slate-200/80 hover:border-cyan-300/60 hover:bg-cyan-50/50'
  const quickClass = isDark
    ? 'border-white/10 bg-black/20 hover:border-cyan-300/25 hover:bg-cyan-300/10'
    : 'border-slate-200 bg-slate-50 hover:border-cyan-300/60 hover:bg-cyan-50'
  const iconShellClass = isDark ? 'bg-white/[0.06] text-slate-200' : 'bg-slate-100 text-slate-700'

  return (
    <main className={`min-h-screen ${pageClass}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className={`flex flex-col gap-4 border-b ${borderClass} pb-5 lg:flex-row lg:items-end lg:justify-between`}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">AtelierOS</p>
            <h1 className={`mt-2 text-3xl font-black tracking-tight sm:text-4xl ${titleClass}`}>
              Tableau de bord applications
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <div className={`rounded-2xl border px-4 py-3 text-sm ${panelClass}`}>
              <div className={`font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{apiUrl}</div>
              <div className={`mt-1 text-xs font-semibold uppercase tracking-[0.18em] ${softMutedClass}`}>API detectee</div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 py-5 lg:grid-cols-4">
          {appCards.map((app) => {
            const Icon = app.icon
            return (
              <a
                key={app.title}
                href={resolveLanUrl(app.path)}
                className={`group flex min-h-56 flex-col justify-between rounded-2xl border p-5 shadow-2xl transition hover:-translate-y-0.5 ${cardClass}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className={`grid h-12 w-12 place-items-center rounded-xl border ${toneStyles[app.tone]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em] ${isDark ? 'border-white/10 bg-black/20 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      {app.status}
                    </span>
                  </div>
                  <h2 className={`mt-5 text-xl font-black ${titleClass}`}>{app.title}</h2>
                  <p className={`mt-2 text-sm font-semibold ${mutedClass}`}>{app.subtitle}</p>
                </div>
                <div className="mt-5 flex items-center justify-between text-sm font-bold text-cyan-100">
                  Ouvrir
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </a>
            )
          })}
        </section>

        <section className="pb-6">
          <div className={`rounded-2xl border p-5 shadow-2xl ${panelClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className={`text-lg font-black ${titleClass}`}>Acces rapide technicien</h2>
              </div>
              <QrCode className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {quickLinks.map((link) => {
                const Icon = link.icon
                return (
                  <a
                    key={link.label}
                    href={resolveLanUrl(link.path)}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition ${quickClass}`}
                  >
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${iconShellClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-bold ${titleClass}`}>{link.label}</div>
                      <div className={`truncate text-xs ${softMutedClass}`}>{link.detail}</div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
