import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PackagePlus, Cpu, ShieldCheck } from 'lucide-react'
import api from '../api/client'
import Modal from '../components/Modal'
import { TextInput, NumberInput, Select, SubmitBar } from '../components/form'
import type { StockItem, StockStatus } from '../types'

const STATUS_LABELS: Record<StockStatus, string> = {
  received:         'Reçu',
  in_diagnosis:     'Diagnostic',
  in_refurbishment: 'Reconditionnement',
  ready:            'Prêt',
  sold:             'Vendu',
  scrapped:         'Rebut',
}

const STATUS_COLORS: Record<StockStatus, string> = {
  received:         'bg-gray-100 text-gray-600',
  in_diagnosis:     'bg-yellow-100 text-yellow-700',
  in_refurbishment: 'bg-blue-100 text-blue-700',
  ready:            'bg-green-100 text-green-700',
  sold:             'bg-purple-100 text-purple-700',
  scrapped:         'bg-red-100 text-red-700',
}

export default function Stock() {
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<StockItem | null>(null)
  const { data: items = [], isLoading } = useQuery<StockItem[]>({
    queryKey: ['stock'],
    queryFn: () => api.get('/stock/').then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-forge-500 text-white px-4 py-2 rounded-lg hover:bg-forge-600 transition text-sm font-medium">
          <PackagePlus size={16} /> Réceptionner
        </button>
      </div>

      {showForm && <StockForm onClose={() => setShowForm(false)} />}
      {detail && <StockDetail item={detail} onClose={() => setDetail(null)} />}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Aucun article en stock</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Appareil</th>
                <th className="px-4 py-3 text-left">N° série</th>
                <th className="px-4 py-3 text-left">Grade</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-right">Achat</th>
                <th className="px-4 py-3 text-right">Vente</th>
                <th className="px-4 py-3 text-left">Reçu le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} onClick={() => setDetail(item)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.brand} {item.model}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {item.serial_number ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {item.grade ? (
                      <span className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">{item.grade}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {item.purchase_price != null ? `${item.purchase_price} €` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {item.sale_price != null ? `${item.sale_price} €` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(item.received_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StockForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [category, setCategory] = useState('laptop')
  const [grade, setGrade] = useState('')
  const [purchase, setPurchase] = useState<number | ''>('')
  const [sale, setSale] = useState<number | ''>('')

  const create = useMutation({
    mutationFn: () =>
      api.post('/stock/', {
        brand: brand || null,
        model: model || null,
        serial_number: serial || null,
        category,
        grade: grade || null,
        purchase_price: purchase === '' ? null : purchase,
        sale_price: sale === '' ? null : sale,
        status: 'received',
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] })
      onClose()
    },
  })

  return (
    <Modal title="Réceptionner une machine" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Marque" value={brand} onChange={setBrand} placeholder="Dell" />
          <TextInput label="Modèle" value={model} onChange={setModel} placeholder="Latitude 5520" />
        </div>
        <TextInput label="N° de série" value={serial} onChange={setSerial} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Catégorie" value={category} onChange={setCategory}
            options={[
              { value: 'laptop', label: 'Portable' },
              { value: 'desktop', label: 'Fixe' },
              { value: 'screen', label: 'Écran' },
              { value: 'other', label: 'Autre' },
            ]} />
          <Select label="Grade" value={grade} onChange={setGrade}
            options={[
              { value: '', label: '— non évalué —' },
              { value: 'A', label: 'A' }, { value: 'B', label: 'B' },
              { value: 'C', label: 'C' }, { value: 'D', label: 'D' },
            ]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Prix d'achat (€)" value={purchase} onChange={setPurchase} />
          <NumberInput label="Prix de vente (€)" value={sale} onChange={setSale} />
        </div>
        {create.isError && <p className="text-red-500 text-sm">Erreur lors de l'enregistrement.</p>}
        <SubmitBar onCancel={onClose} pending={create.isPending} label="Réceptionner" />
      </form>
    </Modal>
  )
}

const STATUS_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: 'received', label: 'Reçu' },
  { value: 'in_diagnosis', label: 'Diagnostic' },
  { value: 'in_refurbishment', label: 'Reconditionnement' },
  { value: 'ready', label: 'Prêt' },
  { value: 'sold', label: 'Vendu' },
  { value: 'scrapped', label: 'Rebut' },
]

// Accès tolérant aux clés Linux (audit.sh) ET WinPE (audit.ps1).
function pick(o: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k]
    if (v !== undefined && v !== null && v !== '' && v !== '?') return String(v)
  }
  return null
}

function StockDetail({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<StockStatus>(item.status)
  const [grade, setGrade] = useState(item.grade ?? '')
  const [purchase, setPurchase] = useState<number | ''>(item.purchase_price ?? '')
  const [sale, setSale] = useState<number | ''>(item.sale_price ?? '')

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/stock/${item.id}`, {
        status, grade: grade || null,
        purchase_price: purchase === '' ? null : purchase,
        sale_price: sale === '' ? null : sale,
      }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock'] }); onClose() },
  })

  const audit = (item.audit_data ?? {}) as Record<string, unknown>
  const cert = (item.erase_cert ?? {}) as Record<string, unknown>
  const hasAudit = Object.keys(audit).length > 0
  const hasCert = Object.keys(cert).length > 0

  const disks = (audit['Disques'] ?? audit['Disks'] ?? audit['disks'] ?? []) as Record<string, unknown>[]
  const cpu = pick(audit, 'CPU', 'Processeur')
  const ram = pick(audit, 'RAM_Go', 'RAM')
  const battery = pick(audit, 'Batterie_Usure_pct', 'Batterie_Usure')

  return (
    <Modal title={`${item.brand ?? ''} ${item.model ?? ''}`.trim() || 'Machine'} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Édition rapide */}
        <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="grid sm:grid-cols-2 gap-3">
          <Select<StockStatus> label="Statut" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <Select label="Grade" value={grade} onChange={setGrade}
            options={[{ value: '', label: '— non évalué —' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' }]} />
          <NumberInput label="Prix d'achat (€)" value={purchase} onChange={setPurchase} />
          <NumberInput label="Prix de vente (€)" value={sale} onChange={setSale} />
          <div className="sm:col-span-2">
            <SubmitBar onCancel={onClose} pending={save.isPending} />
          </div>
        </form>

        <div className="text-xs text-gray-500 font-mono border-t border-gray-100 pt-3">
          N° série : {item.serial_number ?? '—'}
        </div>

        {/* Audit matériel (PXE) */}
        {hasAudit && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><Cpu size={16} /> Audit matériel</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm mb-3">
              {cpu && <Info label="CPU" value={cpu} />}
              {ram && <Info label="RAM" value={`${ram} Go`} />}
              {battery && <Info label="Usure batterie" value={`${battery} %`} />}
            </div>
            {disks.length > 0 && (
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead className="bg-gray-50 text-gray-500">
                  <tr><th className="px-2 py-1 text-left">Disque</th><th className="px-2 py-1 text-left">Bus</th><th className="px-2 py-1 text-left">Taille</th><th className="px-2 py-1 text-left">Santé</th></tr>
                </thead>
                <tbody>
                  {disks.map((d, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1">{pick(d, 'dev', 'Modele', 'Model') ?? '—'}</td>
                      <td className="px-2 py-1">{pick(d, 'bus', 'Bus') ?? '—'}</td>
                      <td className="px-2 py-1">{pick(d, 'taille', 'Taille_Go', 'Size') ?? '—'}</td>
                      <td className="px-2 py-1">{pick(d, 'sante', 'Sante', 'Health', 'HealthStatus') ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Certificat d'effacement */}
        {hasCert && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><ShieldCheck size={16} className="text-green-600" /> Certificat d'effacement</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info label="Certificat" value={pick(cert, 'certificat_id') ?? '—'} />
              <Info label="Méthode" value={pick(cert, 'methode') ?? '—'} />
              <Info label="Résultat" value={pick(cert, 'resultat') ?? '—'} />
              <Info label="Date" value={pick(cert, 'date_fin') ?? '—'} />
            </div>
            {pick(cert, 'signature') && (
              <p className="text-xs text-green-600 mt-2">✓ Certificat signé numériquement</p>
            )}
          </div>
        )}

        {!hasAudit && !hasCert && (
          <p className="text-sm text-gray-400">Aucun audit PXE ni certificat associé à cette machine.</p>
        )}
      </div>
    </Modal>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-gray-800 font-medium truncate">{value}</div>
    </div>
  )
}
