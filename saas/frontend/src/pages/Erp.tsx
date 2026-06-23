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
  import: 'bg-slate-100 text-slate-700',
  reception: 'bg-cyan-100 text-cyan-800',
  scan: 'bg-blue-100 text-blue-800',
  controle: 'bg-amber-100 text-amber-800',
  pret: 'bg-emerald-100 text-emerald-800',
}

const shipmentStatusLabel: Record<ShipmentStatus, string> = {
  preparation: 'Preparation',
  controle: 'Controle final',
  pret_transport: 'Pret transport',
}

const shipmentStatusStyle: Record<ShipmentStatus, string> = {
  preparation: 'bg-blue-100 text-blue-800',
  controle: 'bg-amber-100 text-amber-800',
  pret_transport: 'bg-emerald-100 text-emerald-800',
}

export default function Erp() {
  const totalExpected = receptions.reduce((sum, item) => sum + item.expected, 0)
  const totalScanned = receptions.reduce((sum, item) => sum + item.scanned, 0)
  const openShipments = shipments.filter((item) => item.status !== 'pret_transport').length

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-forge-600">Atelier ERP</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Reception, stock et sorties client</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500">
            Base atelier modulaire pour importer les fichiers fournisseurs, scanner les palettes, lier les audits
            machines et preparer les expeditions client.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-forge-700">
            <Upload size={16} />
            Importer arrivage
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
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

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-5">
          {workflow.map((step, index) => (
            <div key={step.label} className="flex min-h-24 items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-forge-600 shadow-sm">
                <step.icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-950">{step.label}</p>
                <p className="truncate text-xs text-gray-500">{step.detail}</p>
              </div>
              {index < workflow.length - 1 && <ArrowRight className="ml-auto hidden text-gray-300 xl:block" size={16} />}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <ModuleHeader
              title="Arrivages fournisseurs"
              subtitle="Chaque fichier fournisseur devient une reception controlee et scannable."
              action="Nouvelle reception"
              icon={FileSpreadsheet}
            />
            <div className="divide-y divide-gray-100">
              {receptions.map((item) => (
                <article key={item.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-950">{item.id}</span>
                        <StatusBadge label={receptionStatusLabel[item.status]} className={receptionStatusStyle[item.status]} />
                      </div>
                      <h3 className="mt-2 truncate text-xl font-bold text-gray-950">{item.supplier}</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {item.file} - {item.format}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
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
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <ModuleHeader
              title="Sorties client et palettes"
              subtitle="Preparation des palettes client avec etiquettes, BL et liste de colisage."
              action="Creer sortie"
              icon={Truck}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Sortie</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Machines</th>
                    <th className="px-5 py-3">Transport</th>
                    <th className="px-5 py-3">Documents</th>
                    <th className="px-5 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shipments.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-5 py-4 font-semibold text-gray-950">{item.id}</td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">{item.client}</div>
                        <div className="text-xs text-gray-500">{item.reference}</div>
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        {item.machines} machines / {item.pallets} palettes
                      </td>
                      <td className="px-5 py-4 text-gray-700">{item.carrier}</td>
                      <td className="px-5 py-4 text-gray-700">{item.documents}</td>
                      <td className="px-5 py-4">
                        <StatusBadge label={shipmentStatusLabel[item.status]} className={shipmentStatusStyle[item.status]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <ModuleHeader
              title="Import intelligent"
              subtitle="Preparation du futur moteur de correspondance fournisseur."
              icon={FileSpreadsheet}
            />
            <div className="space-y-3 p-5 pt-0">
              {fieldMapping.map(([source, target, confidence]) => (
                <div key={source} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-gray-950">{source}</span>
                    <ArrowRight className="shrink-0 text-gray-300" size={15} />
                    <span className="truncate text-sm font-semibold text-forge-700">{target}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{confidence}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <ModuleHeader title="Terminaux atelier" subtitle="PDA, tablettes et scanners prevus pour les techniciens." icon={Smartphone} />
            <div className="space-y-3 p-5 pt-0">
              {terminals.map((terminal) => (
                <div key={terminal.name} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-700">
                    <terminal.icon size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-950">{terminal.name}</p>
                    <p className="truncate text-xs text-gray-500">{terminal.type}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {terminal.state}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
              <div>
                <h2 className="font-semibold text-amber-950">Etape suivante</h2>
                <p className="mt-2 text-sm text-amber-800">
                  Ajouter le modele backend: receptions, palettes, clients, sorties, documents et liaisons avec les audits.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
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
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
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
    <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-700">
          <Icon size={19} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      {action && (
        <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
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
        <span className="font-semibold text-gray-700">Scan</span>
        <span className="font-bold text-gray-950">{percent}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-forge-600" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {current} machines scannees sur {total}
      </p>
    </div>
  )
}

function StatusBadge({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>
}

function InfoPill({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1">
      <Icon size={13} />
      {label}
    </span>
  )
}
