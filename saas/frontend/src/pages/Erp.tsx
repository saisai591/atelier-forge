import {
  AlertTriangle,
  Battery,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileText,
  HardDrive,
  PackageCheck,
  QrCode,
  Search,
  Truck,
  UserRound,
  Wrench,
} from 'lucide-react'

type TicketStatus = 'a_traiter' | 'diagnostic' | 'reparation' | 'pret' | 'livre'
type Priority = 'haute' | 'normale' | 'basse'

interface WorkshopTicket {
  id: string
  client: string
  machine: string
  serial: string
  status: TicketStatus
  priority: Priority
  issue: string
  technician: string
  eta: string
  audit: {
    cpu: string
    ram: string
    disk: string
    battery: string
  }
}

const tickets: WorkshopTicket[] = [
  {
    id: 'AT-1028',
    client: 'Atelier Demo',
    machine: 'HP ZBook 15 G7',
    serial: '5CD1234A8F',
    status: 'diagnostic',
    priority: 'haute',
    issue: 'Audit recu, batterie a valider avant etiquette',
    technician: 'Nassim',
    eta: 'Aujourd hui',
    audit: { cpu: 'i7-10850H', ram: '32 Go', disk: 'NVMe 1 To', battery: 'Usure 18%' },
  },
  {
    id: 'AT-1027',
    client: 'Reprise Pro',
    machine: 'Dell Latitude 5420',
    serial: 'DL5420-8841',
    status: 'reparation',
    priority: 'normale',
    issue: 'Drivers manquants apres image marketplace',
    technician: 'Amina',
    eta: 'Demain',
    audit: { cpu: 'i5-1145G7', ram: '16 Go', disk: 'SSD 512 Go', battery: 'Usure 9%' },
  },
  {
    id: 'AT-1026',
    client: 'Stock interne',
    machine: 'Lenovo T14 Gen 2',
    serial: 'PF3ZK92M',
    status: 'pret',
    priority: 'basse',
    issue: 'Pret vente, etiquette a imprimer',
    technician: 'Said',
    eta: 'Pret',
    audit: { cpu: 'Ryzen 5 Pro', ram: '16 Go', disk: 'SSD 256 Go', battery: 'Usure 22%' },
  },
]

const statusLabels: Record<TicketStatus, string> = {
  a_traiter: 'A traiter',
  diagnostic: 'Diagnostic',
  reparation: 'Reparation',
  pret: 'Pret',
  livre: 'Livre',
}

const statusStyles: Record<TicketStatus, string> = {
  a_traiter: 'bg-slate-100 text-slate-700',
  diagnostic: 'bg-amber-100 text-amber-700',
  reparation: 'bg-blue-100 text-blue-700',
  pret: 'bg-emerald-100 text-emerald-700',
  livre: 'bg-gray-100 text-gray-600',
}

const priorityStyles: Record<Priority, string> = {
  haute: 'bg-red-50 text-red-700 ring-red-100',
  normale: 'bg-sky-50 text-sky-700 ring-sky-100',
  basse: 'bg-gray-50 text-gray-600 ring-gray-100',
}

const workflow = [
  { label: 'Reception', value: 18, icon: Truck, color: 'text-sky-600', bg: 'bg-sky-50' },
  { label: 'Diagnostic', value: 7, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'Reparation', value: 5, icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Pret vente', value: 12, icon: PackageCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
]

const quickActions = [
  'Scanner QR machine',
  'Creer ticket depuis audit',
  'Imprimer etiquette',
  'Generer fiche PDF',
  'Preparer annonce marketplace',
  'Commander pieces',
]

export default function Erp() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-forge-600">ERP Atelier</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Pilotage atelier et machines</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500">
            Vue simple pour relier clients, audits PXE, tickets, etiquettes, stock pieces et sortie marketplace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-forge-700">
            <QrCode size={16} />
            Scanner machine
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <FileText size={16} />
            Export PDF
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workflow.map((item) => (
          <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{item.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-950">{item.value}</p>
              </div>
              <div className={`rounded-lg ${item.bg} p-2 ${item.color}`}>
                <item.icon size={20} />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-400">Synchronise avec audits et tickets atelier.</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Tickets machines actifs</h2>
              <p className="text-sm text-gray-500">Chaque ticket doit pouvoir repartir vers etiquette, drivers, WIM ou marketplace.</p>
            </div>
            <label className="flex min-w-64 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              <Search size={15} />
              <input className="w-full bg-transparent outline-none" placeholder="Rechercher serie, client, modele" />
            </label>
          </div>

          <div className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-gray-950">{ticket.id}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[ticket.status]}`}>
                        {statusLabels[ticket.status]}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${priorityStyles[ticket.priority]}`}>
                        Priorite {ticket.priority}
                      </span>
                    </div>
                    <h3 className="mt-2 truncate text-xl font-bold text-gray-950">{ticket.machine}</h3>
                    <p className="mt-1 text-sm text-gray-500">{ticket.issue}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                      <InfoPill icon={UserRound} label={ticket.client} />
                      <InfoPill icon={QrCode} label={ticket.serial} />
                      <InfoPill icon={CheckCircle2} label={ticket.technician} />
                    </div>
                  </div>

                  <div className="grid min-w-72 grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-xs">
                    <AuditValue icon={Cpu} label="CPU" value={ticket.audit.cpu} />
                    <AuditValue icon={HardDrive} label="Disque" value={ticket.audit.disk} />
                    <AuditValue icon={PackageCheck} label="RAM" value={ticket.audit.ram} />
                    <AuditValue icon={Battery} label="Batterie" value={ticket.audit.battery} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">Actions rapides</h2>
            <div className="mt-4 grid gap-2">
              {quickActions.map((action) => (
                <button key={action} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:border-forge-200 hover:bg-forge-50 hover:text-forge-700">
                  {action}
                  <span className="text-gray-300">›</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 text-amber-600" size={20} />
              <div>
                <h2 className="font-semibold text-amber-900">Prochaines connexions ERP</h2>
                <p className="mt-2 text-sm text-amber-800">
                  Brancher cette page aux audits reels, au stock pieces, aux devis/factures et aux commandes drivers.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}

function InfoPill({ icon: Icon, label }: { icon: typeof UserRound; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1">
      <Icon size={13} />
      {label}
    </span>
  )
}

function AuditValue({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-gray-400">
        <Icon size={13} />
        {label}
      </div>
      <div className="mt-1 truncate font-semibold text-gray-800">{value}</div>
    </div>
  )
}
