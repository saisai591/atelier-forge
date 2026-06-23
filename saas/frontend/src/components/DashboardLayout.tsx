import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Bell,
  ChevronRight,
  Command,
  Gauge,
  HardDrive,
  Home,
  Laptop,
  Menu,
  Moon,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  UserRound,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import api from '../api/client'

interface PxeAsset {
  key: string
  label: string
  status: string
  detail: string
  url: string | null
}

interface PxeClient {
  id: string
  stock_item_id: string | null
  hostname: string | null
  ip: string | null
  mac: string | null
  serial_number: string | null
  brand: string | null
  model: string | null
  state: string
  boot_mode: string | null
  current_task: string | null
  progress: number | null
  last_seen: string | null
  remote_url: string | null
  notes: string | null
  capabilities: string[]
}

interface PxeStatus {
  server_ip: string
  server_url: string
  smb_share: string
  mode: string
  diagnostic: string
  assets: PxeAsset[]
  clients: PxeClient[]
}

const navItems = [
  { label: 'Vue atelier', icon: Home, active: true },
  { label: 'Machines PXE', icon: Laptop },
  { label: 'Diagnostic', icon: Gauge },
  { label: 'Stock', icon: PackageCheck },
  { label: 'Etiquettes', icon: Tags },
  { label: 'Securite', icon: ShieldCheck },
  { label: 'Reglages', icon: Settings },
]

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data, isLoading, isFetching, refetch } = useQuery<PxeStatus>({
    queryKey: ['pxe-status-layout'],
    queryFn: () => api.get('/forge/pxe/status').then((r) => r.data),
    refetchInterval: 10000,
  })

  const clients = data?.clients ?? []
  const selected = clients.find((client) => client.id === selectedId) ?? clients[0] ?? null

  useEffect(() => {
    if (!selectedId && clients[0]) setSelectedId(clients[0].id)
  }, [clients, selectedId])

  const stats = useMemo(() => {
    const readyAssets = data?.assets.filter((asset) => asset.status === 'ready').length ?? 0
    const missingAssets = data?.assets.filter((asset) => asset.status !== 'ready').length ?? 0
    const liveClients = clients.filter((client) => client.state.toLowerCase().includes('live') || client.ip).length
    const warnings = clients.filter((client) => {
      const text = `${client.state} ${client.notes ?? ''}`.toLowerCase()
      return text.includes('warning') || text.includes('attention') || text.includes('failed') || text.includes('erreur')
    }).length
    return [
      { label: 'Machines vues', value: String(clients.length), icon: Laptop, trend: `${liveClients} avec IP ou agent live` },
      { label: 'Assets PXE prets', value: `${readyAssets}/${data?.assets.length ?? 0}`, icon: ShieldCheck, trend: `${missingAssets} a preparer` },
      { label: 'Serveur PXE', value: data?.server_ip ?? '-', icon: Wifi, trend: data?.mode ?? 'Chargement' },
      { label: 'Alertes', value: String(warnings), icon: Activity, trend: data?.diagnostic ?? 'Aucun diagnostic charge' },
    ]
  }, [clients, data])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-50">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_34rem),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.12),transparent_32rem)]" />

      <DesktopSidebar />
      <TabletDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-72">
        <TopBar onMenu={() => setSidebarOpen(true)} onRefresh={() => refetch()} isFetching={isFetching} />

        <main className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10">
          <section className="mb-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900/75 dark:shadow-black/20 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
                  <Wifi size={14} />
                  Donnees reelles PXE
                </div>
                <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Supervision atelier connectee au serveur {data?.server_ip ?? 'PXE'}.
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => refetch()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <Zap size={16} className={isFetching ? 'animate-pulse' : ''} />
                  Actualiser
                </button>
                <a
                  href={data?.server_url ? `${data.server_url}/tech/` : '/tech/'}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
                >
                  <Tags size={16} />
                  App technicien
                </a>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, trend }) => (
              <div key={label} className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-lg shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                    <p className="mt-3 text-3xl font-black">{isLoading ? '...' : value}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Icon size={20} />
                  </div>
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">{trend}</p>
              </div>
            ))}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-black/20">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-black">Machines PXE reelles</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Auto 10s
                </span>
              </div>

              {isLoading ? (
                <EmptyState title="Lecture du serveur PXE..." detail="Connexion API." />
              ) : clients.length === 0 ? (
                <EmptyState title="Aucune machine reelle" detail="Boote un PC en PXE." />
              ) : (
                <>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Machine</th>
                          <th className="px-5 py-3">Reseau</th>
                          <th className="px-5 py-3">Etat</th>
                          <th className="px-5 py-3">Boot</th>
                          <th className="px-5 py-3">Derniere vue</th>
                          <th className="px-5 py-3">Progression</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {clients.map((client) => (
                          <tr
                            key={client.id}
                            onClick={() => setSelectedId(client.id)}
                            className={`cursor-pointer transition hover:bg-blue-50/60 dark:hover:bg-blue-500/5 ${selected?.id === client.id ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
                          >
                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-950 dark:text-white">{machineTitle(client)}</div>
                              <div className="mt-1 text-xs text-slate-500">{client.serial_number ?? client.mac ?? client.id}</div>
                            </td>
                            <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                              <div>{client.ip ?? 'IP inconnue'}</div>
                              <div className="mt-1 text-slate-400">{client.mac ?? 'MAC inconnue'}</div>
                            </td>
                            <td className="px-5 py-4"><StatusBadge state={client.state} /></td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{client.boot_mode ?? '-'}</td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{formatDate(client.last_seen)}</td>
                            <td className="px-5 py-4"><Progress value={client.progress ?? 0} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-3 p-4 lg:hidden">
                    {clients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => setSelectedId(client.id)}
                        className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 ${selected?.id === client.id ? 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black">{machineTitle(client)}</div>
                            <div className="mt-1 text-xs text-slate-500">{client.ip ?? client.mac ?? client.id}</div>
                          </div>
                          <StatusBadge state={client.state} />
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                          <MiniMetric label="Boot" value={client.boot_mode ?? '-'} />
                          <MiniMetric label="Serie" value={client.serial_number ?? '-'} />
                          <MiniMetric label="Vu" value={formatDate(client.last_seen)} />
                        </div>
                        <div className="mt-4"><Progress value={client.progress ?? 0} /></div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <aside className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-black/20">
              {selected ? (
                <MachineDetail client={selected} assets={data?.assets ?? []} />
              ) : (
                <EmptyState title="Aucun detail" detail="Selectionne une machine reelle des qu'un audit PXE remonte." compact />
              )}
            </aside>
          </section>
        </main>
      </div>

      <BottomTabs />
      <a
        href={data?.server_url ? `${data.server_url}/tech/` : '/tech/'}
        className="fixed bottom-20 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-2xl shadow-blue-600/30 transition hover:-translate-y-1 hover:bg-blue-700 sm:hidden"
      >
        <Plus size={24} />
      </a>
    </div>
  )
}

function MachineDetail({ client, assets }: { client: PxeClient; assets: PxeAsset[] }) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Machine reelle</p>
          <h2 className="mt-2 text-xl font-black">{machineTitle(client)}</h2>
          <p className="mt-1 text-sm text-slate-500">{client.serial_number ?? client.mac ?? client.id}</p>
        </div>
        <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          <Laptop size={22} />
        </div>
      </div>

      <div className="mt-5 rounded-3xl bg-slate-50 p-4 dark:bg-slate-950/60">
        <StatusBadge state={client.state} />
        <div className="mt-4"><Progress value={client.progress ?? 0} large /></div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <DetailTile label="IP" value={client.ip ?? '-'} />
        <DetailTile label="MAC" value={client.mac ?? '-'} />
        <DetailTile label="Boot" value={client.boot_mode ?? '-'} />
        <DetailTile label="Vu" value={formatDate(client.last_seen)} />
      </div>

      {client.remote_url && (
        <a href={client.remote_url} className="mt-5 flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950">
          Ouvrir controle distant
        </a>
      )}

      <div className="mt-5 space-y-2">
        {assets.map((asset) => (
          <div key={asset.key} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-semibold">{asset.label}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${asset.status === 'ready' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          </div>
        ))}
      </div>
    </>
  )
}

function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/70 bg-white/85 px-4 py-5 shadow-2xl shadow-slate-200/70 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-black/20 lg:flex lg:flex-col">
      <Brand />
      <nav className="mt-8 flex-1 space-y-1">
        {navItems.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${active ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/15 dark:bg-white dark:text-slate-950' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'}`}
          >
            <Icon size={19} />
            <span>{label}</span>
            {active && <ChevronRight size={16} className="ml-auto" />}
          </button>
        ))}
      </nav>
      <div className="rounded-3xl bg-slate-950 p-4 text-white dark:bg-slate-900">
        <div className="mb-3 inline-flex rounded-2xl bg-white/10 p-2"><Command size={18} /></div>
        <p className="text-sm font-black">Flux reel</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">Serveur PXE actif.</p>
      </div>
    </aside>
  )
}

function TabletDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-slate-950/35 backdrop-blur-sm transition ${open ? 'opacity-100' : 'opacity-0'}`} />
      <aside className={`absolute inset-y-0 left-0 w-80 max-w-[86vw] border-r border-slate-200 bg-white p-4 shadow-2xl transition duration-300 dark:border-slate-800 dark:bg-slate-950 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between">
          <Brand />
          <button onClick={onClose} className="rounded-2xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"><X size={20} /></button>
        </div>
        <nav className="mt-8 space-y-1">
          {navItems.map(({ label, icon: Icon, active }) => (
            <button key={label} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold ${active ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900'}`}>
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  )
}

function TopBar({ onMenu, onRefresh, isFetching }: { onMenu: () => void; onRefresh: () => void; isFetching: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-slate-100/75 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3">
        <button onClick={onMenu} className="rounded-2xl p-2 text-slate-600 transition hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 lg:hidden"><Menu size={22} /></button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className="h-12 w-full rounded-2xl border border-white/70 bg-white/85 pl-11 pr-4 text-sm font-medium outline-none ring-blue-500/20 transition placeholder:text-slate-400 focus:ring-4 dark:border-slate-800 dark:bg-slate-900" placeholder="Rechercher machine, numero serie, IP, MAC..." />
        </div>
        <button onClick={onRefresh} className="hidden rounded-2xl bg-white/85 p-3 text-slate-600 ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:text-slate-950 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 sm:inline-flex">
          <Zap size={18} className={isFetching ? 'animate-pulse' : ''} />
        </button>
        <button className="hidden rounded-2xl bg-white/85 p-3 text-slate-600 ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:text-slate-950 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 sm:inline-flex"><Moon size={18} /></button>
        <button className="relative rounded-2xl bg-white/85 p-3 text-slate-600 ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:text-slate-950 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
        </button>
        <button className="hidden items-center gap-3 rounded-2xl bg-white/85 px-3 py-2 ring-1 ring-white/70 transition hover:-translate-y-0.5 dark:bg-slate-900 dark:ring-slate-800 md:flex">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950"><UserRound size={18} /></div>
          <div className="text-left">
            <p className="text-sm font-black">Technicien</p>
            <p className="text-xs text-slate-500">Atelier</p>
          </div>
        </button>
      </div>
    </header>
  )
}

function BottomTabs() {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.5rem] border border-white/70 bg-white/95 p-2 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 sm:hidden">
      {navItems.slice(0, 5).map(({ label, icon: Icon, active }) => (
        <button key={label} className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold transition ${active ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'}`}>
          <Icon size={18} />
          <span className="max-w-full truncate">{label.split(' ')[0]}</span>
        </button>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-600/25"><HardDrive size={22} /></div>
      <div>
        <p className="text-base font-black tracking-tight">Atelier Forge</p>
        <p className="text-xs font-semibold text-slate-400">PXE Diagnostic Suite</p>
      </div>
    </div>
  )
}

function StatusBadge({ state }: { state: string }) {
  const normalized = state.toLowerCase()
  const ok = normalized.includes('termine') || normalized.includes('certifie') || normalized.includes('ok')
  const live = normalized.includes('live') || normalized.includes('cours') || normalized.includes('actif')
  const warn = normalized.includes('warning') || normalized.includes('attention') || normalized.includes('failed') || normalized.includes('erreur')
  const className = warn
    ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20'
    : live
      ? 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20'
      : ok
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20'
        : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
  const dot = warn ? 'bg-amber-500' : live ? 'bg-blue-500' : ok ? 'bg-emerald-500' : 'bg-slate-400'
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${className}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {state || 'Inconnu'}
    </span>
  )
}

function Progress({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <div>
      <div className={`overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${large ? 'h-3' : 'h-2'}`}>
        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-500 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <p className="mt-1 text-xs font-bold text-slate-500">{value}%</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60">
      <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xs font-black">{value}</p>
    </div>
  )
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-100 p-4 dark:border-slate-800">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 break-words font-black">{value}</p>
    </div>
  )
}

function EmptyState({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return (
    <div className={`grid place-items-center text-center ${compact ? 'min-h-[260px]' : 'min-h-[420px] p-8'}`}>
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <Laptop size={24} />
        </div>
        <h3 className="mt-4 text-lg font-black">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
    </div>
  )
}

function machineTitle(client: PxeClient) {
  const label = `${client.brand ?? ''} ${client.model ?? ''}`.trim()
  return label || client.hostname || client.serial_number || client.mac || client.id
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

