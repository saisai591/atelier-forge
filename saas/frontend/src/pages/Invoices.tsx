import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Download, FileDown, Plus, Trash2, CheckCircle, Send } from 'lucide-react'
import api from '../api/client'
import Modal from '../components/Modal'
import { SubmitBar } from '../components/form'
import type { Invoice, InvoiceStatus, Client } from '../types'

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:     'Brouillon',
  issued:    'Émise',
  paid:      'Payée',
  cancelled: 'Annulée',
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft:     'bg-gray-100 text-gray-600',
  issued:    'bg-blue-100 text-blue-700',
  paid:      'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function Invoices() {
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices/').then((r) => r.data),
  })

  const issue = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/issue`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/pay`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })

  const exportFec = async () => {
    const year = new Date().getFullYear()
    const res = await api.get(`/invoices/export/fec?year=${year}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `FEC-${year}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openPdf = async (inv: Invoice) => {
    const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
        <div className="flex gap-2">
          <button
            onClick={exportFec}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
          >
            <Download size={16} /> Export FEC
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-forge-500 text-white px-4 py-2 rounded-lg hover:bg-forge-600 transition text-sm font-medium">
            <FileText size={16} /> Nouvelle facture
          </button>
        </div>
      </div>

      {showForm && <InvoiceForm onClose={() => setShowForm(false)} />}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Aucune facture</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Numéro</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-right">HT</th>
                <th className="px-4 py-3 text-right">TVA</th>
                <th className="px-4 py-3 text-right">TTC</th>
                <th className="px-4 py-3 text-left">Émise le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                    {inv.number ?? '— brouillon —'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{inv.total_ht.toFixed(2)} €</td>
                  <td className="px-4 py-3 text-right text-gray-500">{inv.total_vat.toFixed(2)} €</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{inv.total_ttc.toFixed(2)} €</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {inv.status === 'draft' && (
                        <button onClick={() => issue.mutate(inv.id)} disabled={issue.isPending}
                          title="Émettre (numéro définitif)"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium">
                          <Send size={14} /> Émettre
                        </button>
                      )}
                      {inv.status === 'issued' && (
                        <button onClick={() => pay.mutate(inv.id)} disabled={pay.isPending}
                          title="Marquer payée"
                          className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-medium">
                          <CheckCircle size={14} /> Payer
                        </button>
                      )}
                      <button onClick={() => openPdf(inv)} title="Ouvrir le PDF"
                        className="inline-flex items-center gap-1 text-forge-600 hover:text-forge-700 text-xs font-medium">
                        <FileDown size={15} /> PDF
                      </button>
                    </div>
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

interface DraftLine {
  description: string
  quantity: number
  unit_price_ht: number
  vat_rate: number
}

function InvoiceForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [clientId, setClientId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([
    { description: '', quantity: 1, unit_price_ht: 0, vat_rate: 20 },
  ])

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients/').then((r) => r.data),
  })

  const addLine = () => setLines((ls) => [...ls, { description: '', quantity: 1, unit_price_ht: 0, vat_rate: 20 }])
  const update = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const remove = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i))

  const totalHt = lines.reduce((s, l) => s + l.quantity * l.unit_price_ht, 0)
  const totalVat = lines.reduce((s, l) => s + (l.quantity * l.unit_price_ht * l.vat_rate) / 100, 0)

  const create = useMutation({
    mutationFn: () =>
      api.post('/invoices/', { client_id: clientId, lines }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
    },
  })

  const clientLabel = (c: Client) => c.company_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email
  const inputCls = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forge-500'

  return (
    <Modal title="Nouvelle facture" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client <span className="text-red-500">*</span></label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required className={`w-full ${inputCls}`}>
            <option value="">— Choisir un client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{clientLabel(c)} ({c.type})</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Lignes (prix HT)</span>
            <button type="button" onClick={addLine} className="flex items-center gap-1 text-forge-600 text-sm hover:text-forge-700">
              <Plus size={14} /> Ligne
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={l.description} onChange={(e) => update(i, { description: e.target.value })}
                  placeholder="Désignation" required className={`flex-1 ${inputCls}`} />
                <input type="number" min={1} value={l.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                  className={`w-14 ${inputCls}`} title="Qté" />
                <input type="number" step="0.01" value={l.unit_price_ht} onChange={(e) => update(i, { unit_price_ht: Number(e.target.value) })}
                  className={`w-24 ${inputCls}`} title="PU HT" />
                <input type="number" step="0.1" value={l.vat_rate} onChange={(e) => update(i, { vat_rate: Number(e.target.value) })}
                  className={`w-16 ${inputCls}`} title="TVA %" />
                <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 p-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-6 pt-2 border-t border-gray-100 text-sm">
          <span className="text-gray-500">HT <b className="text-gray-900">{totalHt.toFixed(2)} €</b></span>
          <span className="text-gray-500">TVA <b className="text-gray-900">{totalVat.toFixed(2)} €</b></span>
          <span className="text-gray-500">TTC <b className="text-gray-900">{(totalHt + totalVat).toFixed(2)} €</b></span>
        </div>

        {create.isError && <p className="text-red-500 text-sm">Erreur lors de l'enregistrement.</p>}
        <SubmitBar onCancel={onClose} pending={create.isPending} label="Créer le brouillon" />
      </form>
    </Modal>
  )
}
