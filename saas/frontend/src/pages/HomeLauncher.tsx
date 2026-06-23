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
  Settings,
  Smartphone,
  Truck,
  Warehouse,
} from 'lucide-react'

const appCards = [
  {
    title: 'Deploiement PXE',
    subtitle: 'Audit, boot reseau, WinPE, WIM, drivers et logs PXE.',
    path: '/pxe',
    icon: MonitorCog,
    tone: 'cyan',
    status: 'Production',
  },
  {
    title: 'Atelier ERP',
    subtitle: 'Receptions fournisseurs, palettes, sorties client, BL et colisage.',
    path: '/erp',
    icon: Warehouse,
    tone: 'emerald',
    status: 'Nouveau',
  },
  {
    title: 'Scanner mobile',
    subtitle: 'Interface PDA/tablette pour retrouver une machine par QR ou code-barres.',
    path: '/mobile',
    icon: Smartphone,
    tone: 'blue',
    status: 'Atelier',
  },
  {
    title: 'Back-office',
    subtitle: 'Clients, stock, commandes, factures, WhatsApp et reglages SaaS.',
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
  { label: 'Guide', detail: 'FAQ et procedures', path: '/pxe', icon: BookOpen },
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

  return (
    <main className="min-h-screen bg-[#070a10] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">AtelierOS</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Tableau de bord applications
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Point d'entree unique pour ouvrir le bon module, sur la bonne route, sans chercher le port ou l'URL.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
            <div className="font-mono text-slate-300">{apiUrl}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">API detectee</div>
          </div>
        </header>

        <section className="grid gap-4 py-6 lg:grid-cols-4">
          {appCards.map((app) => {
            const Icon = app.icon
            return (
              <a
                key={app.title}
                href={resolveLanUrl(app.path)}
                className="group flex min-h-56 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.07]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className={`grid h-12 w-12 place-items-center rounded-xl border ${toneStyles[app.tone]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      {app.status}
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-black text-white">{app.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{app.subtitle}</p>
                </div>
                <div className="mt-5 flex items-center justify-between text-sm font-bold text-cyan-100">
                  Ouvrir
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </a>
            )
          })}
        </section>

        <section className="grid gap-5 pb-6 lg:grid-cols-[1fr_22rem]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white">Acces rapide technicien</h2>
                <p className="mt-1 text-sm text-slate-500">Raccourcis stables vers les zones les plus utilisees.</p>
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
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-cyan-300/25 hover:bg-cyan-300/10"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-slate-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-100">{link.label}</div>
                      <div className="truncate text-xs text-slate-500">{link.detail}</div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>

          <aside className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5">
            <Settings className="h-6 w-6 text-cyan-200" />
            <h2 className="mt-4 text-lg font-black text-white">Conseil structure</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-50/80">
              On garde `PXE` comme moteur technique, `ERP` comme gestion atelier, et `/` comme portail. C'est plus fiable
              pour vendre l'appliance: le client arrive d'abord sur un choix simple.
            </p>
          </aside>
        </section>
      </div>
    </main>
  )
}
