import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle, ClipboardList, Clock, Package, PackageCheck, ScanLine, TrendingUp, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import api from '../api/client'
import { useAuthStore } from '../store/auth'
import { useThemeMode } from '../hooks/useThemeMode'

interface Overview {
  stock: {
    total: number
    by_status: Record<string, number>
    by_grade: Record<string, number>
    available_value: number
    realized_margin: number
  }
  commerce: { by_status: Record<string, number>; total: number }
  accounting: { invoiced_ht: number; paid_ht: number; unpaid_ht: number }
  clients: { total: number; by_type: Record<string, number> }
}

interface AtelierOverview {
  receptions_open: number
  items_expected: number
  items_scanned: number
  pallets_active: number
  shipments_open: number
  documents_ready: number
}

const GRADE_COLORS: Record<string, string> = {
  A: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300',
  B: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-300',
  C: 'border-amber-300/30 bg-amber-300/10 text-amber-300',
  D: 'border-rose-300/30 bg-rose-300/10 text-rose-300',
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const { isDark } = useThemeMode()

  const { data, isLoading, isError } = useQuery<Overview>({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data),
  })
  const { data: erpOverview, isError: erpError } = useQuery<AtelierOverview>({
    queryKey: ['atelier-erp', 'overview'],
    queryFn: () => api.get('/atelier-erp/overview').then((r) => r.data),
  })

  const titleClass = isDark ? 'text-white' : 'text-slate-950'
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600'
  const panelClass = isDark
    ? 'border-white/10 bg-white/[0.035] shadow-black/30'
    : 'border-slate-200 bg-white shadow-slate-200/80'
  const readyCount = data?.stock.by_status.ready ?? 0
  const blockedCount = (data?.stock.by_status.in_diagnosis ?? 0) + (data?.accounting.unpaid_ht ? 1 : 0)
  const erpActionCount = (erpOverview?.receptions_open ?? 0) + (erpOverview?.shipments_open ?? 0) + (erpOverview?.pallets_active ?? 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Back-office AtelierOS</p>
          <h1 className={`mt-2 text-3xl font-black tracking-tight ${titleClass}`}>
            Bonjour, {user?.full_name?.split(' ')[0] ?? 'atelier'}
          </h1>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${panelClass}`}>
          <span className="text-cyan-300">Etat global : </span>
          {isError ? 'API a verifier' : isLoading ? 'Chargement' : blockedCount > 0 ? 'Actions a traiter' : 'Pret'}
        </div>
      </header>

      {isLoading || !data ? (
        <div className={`rounded-2xl border p-6 text-sm ${panelClass} ${mutedClass}`}>
          Chargement des indicateurs...
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard isDark={isDark} icon={<Wallet size={20} />} tone="cyan" label="Valeur stock" value={`${data.stock.available_value.toFixed(0)} EUR`} />
            <StatCard isDark={isDark} icon={<TrendingUp size={20} />} tone="emerald" label="Marge realisee" value={`${data.stock.realized_margin.toFixed(0)} EUR`} />
            <StatCard isDark={isDark} icon={<AlertCircle size={20} />} tone="rose" label="Impayes HT" value={`${data.accounting.unpaid_ht.toFixed(0)} EUR`} />
            <StatCard isDark={isDark} icon={<ClipboardList size={20} />} tone={erpError ? 'rose' : 'violet'} label="ERP atelier" value={erpError ? 'API KO' : erpActionCount} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <ActionTile isDark={isDark} tone="emerald" title="Pret" value={readyCount} />
            <ActionTile isDark={isDark} tone="amber" title="A traiter" value={data.stock.by_status.in_diagnosis ?? 0} />
            <ActionTile isDark={isDark} tone="rose" title="Bloque" value={data.accounting.unpaid_ht > 0 ? 1 : 0} />
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <Panel isDark={isDark} title={`Stock (${data.stock.total})`} icon={<Package size={18} />}>
              <div className="space-y-3">
                <StatusBar isDark={isDark} label="Pretes" icon={<CheckCircle size={14} className="text-emerald-400" />} count={readyCount} total={data.stock.total} color="bg-emerald-400" />
                <StatusBar isDark={isDark} label="En diagnostic" icon={<Clock size={14} className="text-amber-400" />} count={data.stock.by_status.in_diagnosis ?? 0} total={data.stock.total} color="bg-amber-400" />
                <StatusBar isDark={isDark} label="Vendues" icon={<TrendingUp size={14} className="text-violet-400" />} count={data.stock.by_status.sold ?? 0} total={data.stock.total} color="bg-violet-400" />
              </div>
              {Object.keys(data.stock.by_grade).length > 0 && (
                <div className={`mt-5 flex flex-wrap gap-2 border-t pt-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  <span className={`self-center text-xs font-bold ${mutedClass}`}>Grades</span>
                  {Object.entries(data.stock.by_grade).sort().map(([g, n]) => (
                    <span key={g} className={`rounded-lg border px-2 py-1 text-xs font-black ${GRADE_COLORS[g] ?? (isDark ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700')}`}>
                      {g} · {n}
                    </span>
                  ))}
                </div>
              )}
            </Panel>

            <Panel isDark={isDark} title="Facturation HT" icon={<Wallet size={18} />}>
              <div className="space-y-3">
                <Row isDark={isDark} label="Facture" value={data.accounting.invoiced_ht} tone="slate" />
                <Row isDark={isDark} label="Encaisse" value={data.accounting.paid_ht} tone="emerald" />
                <Row isDark={isDark} label="En attente de paiement" value={data.accounting.unpaid_ht} tone="rose" />
              </div>
              {data.accounting.invoiced_ht > 0 && (
                <div className={`mt-5 border-t pt-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  <div className={`h-2 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                    <div className="h-full bg-emerald-400" style={{ width: `${(data.accounting.paid_ht / data.accounting.invoiced_ht) * 100}%` }} />
                  </div>
                  <p className={`mt-2 text-xs font-bold ${mutedClass}`}>
                    {((data.accounting.paid_ht / data.accounting.invoiced_ht) * 100).toFixed(0)}% encaisse
                  </p>
                </div>
              )}
            </Panel>

            <Panel isDark={isDark} title="Atelier ERP" icon={<PackageCheck size={18} />}>
              <div className="space-y-3">
                <StatusBar isDark={isDark} label="Receptions ouvertes" icon={<Package size={14} className="text-cyan-400" />} count={erpOverview?.receptions_open ?? 0} total={Math.max(erpOverview?.receptions_open ?? 0, 1)} color="bg-cyan-400" />
                <StatusBar isDark={isDark} label="Palettes actives" icon={<PackageCheck size={14} className="text-emerald-400" />} count={erpOverview?.pallets_active ?? 0} total={Math.max(erpOverview?.pallets_active ?? 0, 1)} color="bg-emerald-400" />
                <StatusBar isDark={isDark} label="Sorties client" icon={<TrendingUp size={14} className="text-violet-400" />} count={erpOverview?.shipments_open ?? 0} total={Math.max(erpOverview?.shipments_open ?? 0, 1)} color="bg-violet-400" />
              </div>
              <a
                href="/erp"
                className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black transition ${isDark ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15' : 'border-cyan-200 bg-cyan-50 text-cyan-900 hover:bg-cyan-100'}`}
              >
                <ScanLine size={16} />
                Ouvrir reception / scan
              </a>
            </Panel>
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, tone, isDark }: {
  icon: ReactNode
  label: string
  value: string | number
  tone: 'cyan' | 'emerald' | 'rose' | 'violet'
  isDark: boolean
}) {
  const toneClass = {
    cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-300',
    emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300',
    rose: 'border-rose-300/25 bg-rose-300/10 text-rose-300',
    violet: 'border-violet-300/25 bg-violet-300/10 text-violet-300',
  }[tone]

  return (
    <div className={`rounded-2xl border p-5 shadow-xl ${isDark ? 'border-white/10 bg-white/[0.035] shadow-black/25' : 'border-slate-200 bg-white shadow-slate-200/80'}`}>
      <div className={`mb-4 inline-flex rounded-xl border p-2 ${toneClass}`}>{icon}</div>
      <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{value}</div>
      <div className={`mt-1 text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</div>
    </div>
  )
}

function ActionTile({ title, value, tone, isDark }: {
  title: string
  value: number
  tone: 'emerald' | 'amber' | 'rose'
  isDark: boolean
}) {
  const toneClass = {
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  }[tone]

  return (
    <div className={`rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white'}`}>
      <div className={`text-4xl font-black ${toneClass}`}>{value}</div>
      <div className={`mt-2 text-lg font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{title}</div>
    </div>
  )
}

function Panel({ title, icon, children, isDark }: {
  title: string
  icon: ReactNode
  children: ReactNode
  isDark: boolean
}) {
  return (
    <div className={`rounded-2xl border p-6 shadow-2xl ${isDark ? 'border-white/10 bg-white/[0.035] shadow-black/30' : 'border-slate-200 bg-white shadow-slate-200/80'}`}>
      <h2 className={`mb-5 flex items-center gap-2 text-lg font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>
        {icon}
        {title}
      </h2>
      {children}
    </div>
  )
}

function StatusBar({ label, icon, count, total, color, isDark }: {
  label: string
  icon: ReactNode
  count: number
  total: number
  color: string
  isDark: boolean
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className={`flex items-center gap-1.5 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{icon} {label}</span>
        <span className={`font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{count}</span>
      </div>
      <div className={`h-2 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Row({ label, value, tone, isDark }: {
  label: string
  value: number
  tone: 'slate' | 'emerald' | 'rose'
  isDark: boolean
}) {
  const color = tone === 'emerald' ? 'text-emerald-400' : tone === 'rose' ? 'text-rose-400' : isDark ? 'text-white' : 'text-slate-950'
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      <span className={`font-black ${color}`}>{value.toFixed(2)} EUR</span>
    </div>
  )
}
