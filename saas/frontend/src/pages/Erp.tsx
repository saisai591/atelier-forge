import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  MapPin,
  PackageCheck,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Tablet,
  Truck,
  Upload,
  Warehouse,
} from 'lucide-react'
import type { ReactNode } from 'react'

type ReceptionStatus = 'import' | 'reception' | 'scan' | 'controle' | 'pret'
type ShipmentStatus = 'preparation' | 'controle' | 'pret_transport'

interface ReceptionBatch {
  id: string
  supplier: string
  file: string
  format: string
  expected: number
  scanned: number
  pallets: number
  location: string
  status: ReceptionStatus
  nextAction: string
}

interface ClientShipment {
  id: string
  client: string
  reference: string
  machines: number
  pallets: number
  carrier: string
  status: ShipmentStatus
  documents: string
}

const receptions: ReceptionBatch[] = [
  {
    id: 'REC-2026-0623-01',
    supplier: 'Broker Europe',
    file: 'arrivage_broker_0623.xlsx',
    format: 'Excel fournisseur',
    expected: 84,
    scanned: 37,
    pallets: 4,
    location: 'Zone A - Quai 2',
    status: 'scan',
    nextAction: 'Continuer scan palette A2',
  },
  {
    id: 'REC-2026-0622-04',
    supplier: 'TechLease',
    file: 'lot_lease_778.csv',
    format: 'CSV avec colonnes inconnues',
    expected: 42,
    scanned: 42,
    pallets: 2,
    location: 'Controle qualite',
    status: 'controle',
    nextAction: 'Verifier batteries faibles',
  },
  {
    id: 'REC-2026-0621-02',
    supplier: 'Reprise Pro',
    file: 'manifest.xml',
    format: 'XML fournisseur',
    expected: 120,
    scanned: 120,
    pallets: 6,
    location: 'Stock entrant',
    status: 'pret',
    nextAction: 'Cloturer reception',
  },
]

const shipments: ClientShipment[] = [
  {
    id: 'SORT-2026-061',
    client: 'Client Marketplace Nord',
    reference: 'CMD-88421',
    machines: 30,
    pallets: 2,
    carrier: 'Geodis',
    status: 'preparation',
    documents: 'BL a generer',
  },
  {
    id: 'SORT-2026-060',
    client: 'Revendeur Pro',
    reference: 'PO-2026-1187',
    machines: 54,
    pallets: 3,
    carrier: 'DB Schenker',
    status: 'controle',
    documents: 'Liste colisage OK',
  },
  {
    id: 'SORT-2026-059',
    client: 'Atelier partenaire',
    reference: 'BL-5620',
    machines: 18,
    pallets: 1,
    carrier: 'Enlevement client',
    status: 'pret_transport',
    documents: 'BL + etiquette palette',
  },
]

const workflow = [
  { label: 'Import fournisseur', detail: 'Excel, CSV, XML', icon: Upload },
  { label: 'Reception palette', detail: 'Lot, quai, zone', icon: Warehouse },
  { label: 'Scan materiel', detail: 'PDA, tablette, douchette', icon: ScanLine },
  { label: 'Audit et controle', detail: 'PXE, etat, grade', icon: ShieldCheck },
  { label: 'Sortie client', detail: 'Palette, BL, transport', icon: Truck },
]

const fieldMapping = [
  ['SerialNumber', 'Numero de serie', 'Confiance 98%'],
  ['Model / Product', 'Marque + modele', 'Confiance 93%'],
  ['Asset Tag', 'Reference fournisseur', 'Confiance 91%'],
  ['Grade', 'Etat initial', 'A confirmer'],
]

const terminals = [
  { name: 'Unitech atelier', type: 'Android scanner', state: 'Connecte', icon: Smartphone },
  { name: 'Tablette reception', type: 'Mode debutant', state: 'Prete', icon: Tablet },
  { name: 'Douchette BT', type: 'Saisie rapide', state: 'A associer', icon: Barcode },
]

const receptionStatusLabel: Record<ReceptionStatus, string> = {
  import: 'Import',
  reception: 'Reception',
  scan: 'Scan en cours',
  controle: 'Controle',
  pret: 'Pret',
}

const receptionStatusStyle: Record<ReceptionStatus, string> = {
  import: 'border-slate-300/20 bg-slate-300/10 text-slate-200',
  reception: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
  scan: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
  controle: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  pret: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
}

const shipmentStatusLabel: Record<ShipmentStatus, string> = {
  preparation: 'Preparation',
  controle: 'Controle final',
  pret_transport: 'Pret transport',
}

const shipmentStatusStyle: Record<ShipmentStatus, string> = {
  preparation: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
  controle: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  pret_transport: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
}

export default function Erp() {
  const totalExpected = receptions.reduce((sum, item) => sum + item.expected, 0)
  const totalScanned = receptions.reduce((sum, item) => sum + item.scanned, 0)
  const openShipments = shipments.filter((item) => item.status !== 'pret_transport').length

  return (
    <main className="min-h-screen bg-[#070a10] text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Atelier ERP</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Reception, stock et sorties client
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Base atelier modulaire pour importer les fichiers fournisseurs, scanner les palettes, lier les audits
              machines et preparer les expeditions client.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-300/15">
              <Upload size={16} />
              Importer arrivage
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-white/[0.08]">
              <QrCode size={16} />
              Scanner
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Receptions ouvertes" value={receptions.length.toString()} icon={ClipboardList} tone="blue" />
          <MetricCard label="Machines attendues" value={totalExpected.toString()} icon={Boxes} tone="slate" />
          <MetricCard label="Machines scannees" value={`${totalScanned}/${totalExpected}`} icon={ScanLine} tone="emerald" />
          <MetricCard label="Sorties a preparer" value={openShipments.toString()} icon={Truck} tone="amber" />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/30">
          <div className="grid gap-3 lg:grid-cols-5">
            {workflow.map((step, index) => (
              <div
                key={step.label}
                className="flex min-h-24 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                  <step.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{step.label}</p>
                  <p className="truncate text-xs text-slate-500">{step.detail}</p>
                </div>
                {index < workflow.length - 1 && <ArrowRight className="ml-auto hidden text-slate-600 xl:block" size={16} />}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="space-y-6">
            <Panel>
              <ModuleHeader
                title="Arrivages fournisseurs"
                subtitle="Chaque fichier fournisseur devient une reception controlee et scannable."
                action="Nouvelle reception"
                icon={FileSpreadsheet}
              />
              <div className="divide-y divide-white/10">
                {receptions.map((item) => (
                  <article key={item.id} className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-cyan-100">{item.id}</span>
                          <StatusBadge label={receptionStatusLabel[item.status]} className={receptionStatusStyle[item.status]} />
                        </div>
                        <h3 className="mt-2 truncate text-xl font-black text-white">{item.supplier}</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {item.file} - {item.format}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                          <InfoPill icon={MapPin} label={item.location} />
                          <InfoPill icon={Boxes} label={`${item.pallets} palettes`} />
                          <InfoPill icon={PackageCheck} label={item.nextAction} />
                        </div>
                      </div>
                      <ProgressBlock current={item.scanned} total={item.expected} />
                    </div>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel>
              <ModuleHeader
                title="Sorties client et palettes"
                subtitle="Preparation des palettes client avec etiquettes, BL et liste de colisage."
                action="Creer sortie"
                icon={Truck}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/[0.035] text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Sortie</th>
                      <th className="px-5 py-3">Client</th>
                      <th className="px-5 py-3">Machines</th>
                      <th className="px-5 py-3">Transport</th>
                      <th className="px-5 py-3">Documents</th>
                      <th className="px-5 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {shipments.map((item) => (
                      <tr key={item.id} className="align-top transition hover:bg-white/[0.035]">
                        <td className="px-5 py-4 font-mono font-bold text-cyan-100">{item.id}</td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-white">{item.client}</div>
                          <div className="text-xs text-slate-500">{item.reference}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          {item.machines} machines / {item.pallets} palettes
                        </td>
                        <td className="px-5 py-4 text-slate-300">{item.carrier}</td>
                        <td className="px-5 py-4 text-slate-300">{item.documents}</td>
                        <td className="px-5 py-4">
                          <StatusBadge label={shipmentStatusLabel[item.status]} className={shipmentStatusStyle[item.status]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <aside className="space-y-6">
            <Panel>
              <ModuleHeader
                title="Import intelligent"
                subtitle="Preparation du futur moteur de correspondance fournisseur."
                icon={FileSpreadsheet}
              />
              <div className="space-y-3 p-5 pt-0">
                {fieldMapping.map(([source, target, confidence]) => (
                  <div key={source} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-bold text-white">{source}</span>
                      <ArrowRight className="shrink-0 text-slate-600" size={15} />
                      <span className="truncate text-sm font-bold text-cyan-100">{target}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{confidence}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <ModuleHeader title="Terminaux atelier" subtitle="PDA, tablettes et scanners prevus pour les techniciens." icon={Smartphone} />
              <div className="space-y-3 p-5 pt-0">
                {terminals.map((terminal) => (
                  <div key={terminal.name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.055] text-slate-200">
                      <terminal.icon size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{terminal.name}</p>
                      <p className="truncate text-xs text-slate-500">{terminal.type}</p>
                    </div>
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-bold text-emerald-100">
                      {terminal.state}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-amber-200" size={20} />
                <div>
                  <h2 className="font-black text-amber-50">Etape suivante</h2>
                  <p className="mt-2 text-sm leading-6 text-amber-50/75">
                    Brancher cette interface aux endpoints ERP reels pour supprimer les donnees de demonstration.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: typeof ClipboardList
  tone: 'blue' | 'slate' | 'emerald' | 'amber'
}) {
  const tones = {
    blue: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
    slate: 'border-slate-300/20 bg-white/[0.055] text-slate-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-white">{value}</p>
        </div>
        <div className={`rounded-xl border p-2 ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30">{children}</div>
}

function ModuleHeader({
  title,
  subtitle,
  action,
  icon: Icon,
}: {
  title: string
  subtitle: string
  action?: string
  icon: typeof ClipboardList
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <Icon size={19} />
        </div>
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {action && (
        <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/[0.07]">
          {action}
        </button>
      )}
    </div>
  )
}

function ProgressBlock({ current, total }: { current: number; total: number }) {
  const percent = Math.round((current / total) * 100)

  return (
    <div className="w-full shrink-0 lg:w-72">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-slate-300">Scan</span>
        <span className="font-mono font-black text-white">{percent}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-300 shadow-lg shadow-cyan-500/30" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {current} machines scannees sur {total}
      </p>
    </div>
  )
}

function StatusBadge({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>{label}</span>
}

function InfoPill({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.055] px-2 py-1">
      <Icon size={13} />
      {label}
    </span>
  )
}
