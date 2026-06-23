import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Battery, CheckCircle2, ClipboardCheck, ExternalLink, PackageCheck, Printer, QrCode, RefreshCw, Search, Truck, Wrench } from 'lucide-react'

interface MobileAudit {
  id: string
  filename: string
  brand?: string | null
  model?: string | null
  serial_number?: string | null
  cpu?: string | null
  ram?: string | null
  ram_mb?: number | null
  main_disk?: string | null
  battery_status?: string | null
  grade_proposed?: string | null
  updated_at?: string | null
  ip?: string | null
  mac?: string | null
  raw?: Record<string, unknown> | null
}

const statusActions = [
  { id: 'received', label: 'Recu', icon: PackageCheck, tone: 'cyan' },
  { id: 'audited', label: 'Audite', icon: ClipboardCheck, tone: 'emerald' },
  { id: 'repair', label: 'A reparer', icon: Wrench, tone: 'amber' },
  { id: 'ready', label: 'Pret vente', icon: CheckCircle2, tone: 'emerald' },
  { id: 'ship', label: 'Expedition', icon: Truck, tone: 'slate' },
]

export default function MobileScanner() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [audits, setAudits] = useState<MobileAudit[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const selected = useMemo(() => {
    if (selectedId) return audits.find((audit) => audit.id === selectedId) ?? null
    return null
  }, [audits, selectedId])

  const filtered = useMemo(() => {
    const needle = normalize(query)
    if (!needle) return audits.slice(0, 8)
    return audits.filter((audit) => auditSearchText(audit).includes(needle)).slice(0, 8)
  }, [audits, query])

  async function loadAudits() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${resolveApiBase()}/forge/pxe/audits?limit=100`, { credentials: 'include' })
      if (!response.ok) throw new Error(`API ${response.status}`)
      const data = await response.json() as MobileAudit[]
      setAudits(data)
      if (!selectedId && data.length) setSelectedId(data[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur API')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAudits()
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [selectedId, lastAction])

  function submitScan(value: string) {
    const needle = normalize(value)
    if (!needle) return
    const match = audits.find((audit) => auditSearchText(audit).includes(needle))
    if (match) {
      setSelectedId(match.id)
      setLastAction(`Machine trouvee: ${machineName(match)}`)
      setQuery('')
      return
    }
    setLastAction(`Aucun resultat pour ${value}`)
  }

  function markAction(label: string) {
    if (!selected) return
    setLastAction(`${label}: ${machineName(selected)}`)
  }

  return (
    <main className="min-h-screen bg-[#05080d] text-slate-100">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-4">
        <header className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">AOS Deploy Mobile</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Scan atelier</h1>
          </div>
          <button
            type="button"
            onClick={loadAudits}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-950/40"
            aria-label="Synchroniser"
          >
            <RefreshCw className={loading ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
          </button>
        </header>

        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            submitScan(query)
          }}
        >
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Scanner ou saisir</label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-3 shadow-xl shadow-black/20 focus-within:border-cyan-300/40">
            <QrCode className="h-6 w-6 shrink-0 text-cyan-200" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="SN, QR, code-barres..."
              className="min-w-0 flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:text-slate-600"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
            />
            <button type="submit" className="rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-slate-950">
              OK
            </button>
          </div>
        </form>

        {error ? (
          <div className="mt-3 flex gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>API indisponible: {error}</div>
          </div>
        ) : null}

        {lastAction ? (
          <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">
            {lastAction}
          </div>
        ) : null}

        <section className="mt-4 flex-1 overflow-hidden">
          {selected ? <MachineCard audit={selected} onAction={markAction} /> : <EmptyState loading={loading} />}

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Derniers audits</h2>
              <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-xs text-slate-400">{audits.length}</span>
            </div>
            <div className="grid gap-2">
              {filtered.map((audit) => (
                <button
                  key={audit.id}
                  type="button"
                  onClick={() => setSelectedId(audit.id)}
                  className={`rounded-2xl border p-3 text-left transition ${audit.id === selected?.id ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-white/10 bg-white/[0.045]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-white">{machineName(audit)}</div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-500">{audit.serial_number || audit.filename}</div>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-xs font-bold text-slate-300">{audit.grade_proposed || 'A'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

function MachineCard({ audit, onAction }: { audit: MobileAudit; onAction: (label: string) => void }) {
  return (
    <article className="rounded-3xl border border-cyan-300/20 bg-[#091622] p-4 shadow-2xl shadow-black/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Machine active</div>
          <h2 className="mt-2 break-words text-2xl font-black leading-tight text-white">{machineName(audit)}</h2>
          <div className="mt-2 font-mono text-sm text-slate-400">{audit.serial_number || audit.filename}</div>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white text-2xl font-black text-slate-950">
          {audit.grade_proposed || 'A'}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <InfoRow label="CPU" value={audit.cpu || '-'} />
        <InfoRow label="RAM" value={audit.ram || (audit.ram_mb ? `${audit.ram_mb} MB` : '-')} />
        <InfoRow label="Disque" value={audit.main_disk || '-'} />
        <InfoRow label="Batterie" value={audit.battery_status || 'Aucune'} icon={<Battery className="h-4 w-4" />} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {statusActions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.label)}
              className="min-h-16 rounded-2xl border border-white/10 bg-white/[0.055] p-3 text-left transition active:scale-[0.98]"
            >
              <Icon className={`mb-2 h-5 w-5 ${action.tone === 'emerald' ? 'text-emerald-300' : action.tone === 'amber' ? 'text-amber-300' : action.tone === 'cyan' ? 'text-cyan-300' : 'text-slate-300'}`} />
              <div className="text-sm font-black text-white">{action.label}</div>
            </button>
          )
        })}
        <a
          href="/"
          className="min-h-16 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-left transition active:scale-[0.98]"
        >
          <ExternalLink className="mb-2 h-5 w-5 text-cyan-200" />
          <div className="text-sm font-black text-white">Dashboard</div>
        </a>
        <button
          type="button"
          onClick={() => onAction('Impression etiquette')}
          className="min-h-16 rounded-2xl border border-white/10 bg-white/[0.055] p-3 text-left transition active:scale-[0.98]"
        >
          <Printer className="mb-2 h-5 w-5 text-slate-300" />
          <div className="text-sm font-black text-white">Etiquette</div>
        </button>
      </div>
    </article>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="flex items-center gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="break-words text-right text-sm font-bold text-slate-100">{value}</div>
    </div>
  )
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-center">
      <div>
        <Search className="mx-auto h-10 w-10 text-slate-500" />
        <h2 className="mt-4 text-xl font-black text-white">{loading ? 'Synchronisation...' : 'Aucune machine'}</h2>
      </div>
    </div>
  )
}

function machineName(audit: MobileAudit) {
  return [audit.brand, audit.model].filter(Boolean).join(' ') || 'Machine inconnue'
}

function auditSearchText(audit: MobileAudit) {
  return normalize([
    audit.id,
    audit.filename,
    audit.serial_number,
    audit.brand,
    audit.model,
    audit.cpu,
    audit.ip,
    audit.mac,
  ].filter(Boolean).join(' '))
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function resolveApiBase() {
  if (typeof window === 'undefined') return '/api'
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return '/api'
  return `http://${window.location.hostname}:8000/api`
}
