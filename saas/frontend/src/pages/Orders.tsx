import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Truck, Plus, Trash2, FileText } from 'lucide-react'
import api from '../api/client'
import Modal from '../components/Modal'
import { TextInput, SubmitBar } from '../components/form'
import type { Order, OrderStatus, Client, StockItem } from '../types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  draft:     'Devis',
  confirmed: 'Confirmée',
  prepared:  'Préparée',
  shipped:   'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  draft:     'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  prepared:  'bg-indigo-100 text-indigo-700',
  shipped:   'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function Orders() {
  const [showForm, setShowForm] = useState(false)
  const [shipOrder, setShipOrder] = useState<Order | null>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders/').then((r) => r.data),
  })

  const invoiceFromOrder = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/from-order/${id}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); navigate('/invoices') },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-forge-500 text-white px-4 py-2 rounded-lg hover:bg-forge-600 transition text-sm font-medium">
          <ShoppingCart size={16} /> Nouvelle commande
        </button>
      </div>

      {showForm && <OrderForm onClose={() => setShowForm(false)} />}
      {shipOrder && <ShipForm order={shipOrder} onClose={() => setShipOrder(null)} />}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Aucune commande</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Référence</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-center">Articles</th>
                <th className="px-4 py-3 text-right">Remise</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Suivi</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{o.reference}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{o.lines.length}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{o.discount_rate > 0 ? `${o.discount_rate}%` : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{o.total.toFixed(2)} €</td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.tracking_number ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Truck size={13} className="text-orange-500" />
                        {o.carrier} · {o.tracking_number}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(o.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {!['shipped', 'delivered', 'cancelled'].includes(o.status) && (
                        <button onClick={() => setShipOrder(o)} title="Expédier"
                          className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 text-xs font-medium">
                          <Truck size={14} /> Expédier
                        </button>
                      )}
                      {o.status !== 'cancelled' && (
                        <button onClick={() => invoiceFromOrder.mutate(o.id)} disabled={invoiceFromOrder.isPending}
                          title="Générer la facture"
                          className="inline-flex items-center gap-1 text-forge-600 hover:text-forge-700 text-xs font-medium">
                          <FileText size={14} /> Facturer
                        </button>
                      )}
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
  stock_item_id: string | null
  description: string
  quantity: number
  unit_price: number
}

function OrderForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [clientId, setClientId] = useState('')
  const [address, setAddress] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients/').then((r) => r.data),
  })
  const { data: ready = [] } = useQuery<StockItem[]>({
    queryKey: ['stock', 'ready'],
    queryFn: () => api.get('/stock/?status=ready').then((r) => r.data),
  })

  const addFromStock = (item: StockItem) => {
    setLines((ls) => [...ls, {
      stock_item_id: item.id,
      description: `${item.brand ?? ''} ${item.model ?? ''}`.trim() || 'Machine',
      quantity: 1,
      unit_price: item.sale_price ?? 0,
    }])
  }
  const addFree = () => setLines((ls) => [...ls, { stock_item_id: null, description: '', quantity: 1, unit_price: 0 }])
  const update = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const remove = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i))

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)

  const create = useMutation({
    mutationFn: () =>
      api.post('/orders/', {
        client_id: clientId,
        shipping_address: address || null,
        lines: lines.map((l) => ({
          stock_item_id: l.stock_item_id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      onClose()
    },
  })

  const clientLabel = (c: Client) => c.company_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email
  const inputCls = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forge-500'

  return (
    <Modal title="Nouvelle commande" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client <span className="text-red-500">*</span></label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required className={`w-full ${inputCls}`}>
            <option value="">— Choisir un client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{clientLabel(c)} ({c.type})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Adresse de livraison</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={`w-full ${inputCls}`} placeholder="12 rue… 75011 Paris" />
        </div>

        {/* Lignes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Articles</span>
            <div className="flex gap-2">
              <select
                value="" onChange={(e) => { const it = ready.find((r) => r.id === e.target.value); if (it) addFromStock(it) }}
                className={inputCls}
              >
                <option value="">+ depuis le stock</option>
                {ready.map((it) => (
                  <option key={it.id} value={it.id}>{it.brand} {it.model} · {it.sale_price ?? 0}€</option>
                ))}
              </select>
              <button type="button" onClick={addFree} className="flex items-center gap-1 text-forge-600 text-sm hover:text-forge-700">
                <Plus size={14} /> Ligne libre
              </button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="text-gray-400 text-sm py-3 text-center border border-dashed border-gray-200 rounded-lg">Aucun article</p>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={l.description} onChange={(e) => update(i, { description: e.target.value })}
                    placeholder="Désignation" required className={`flex-1 ${inputCls}`} />
                  <input type="number" min={1} value={l.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                    className={`w-16 ${inputCls}`} title="Quantité" />
                  <input type="number" step="0.01" value={l.unit_price} onChange={(e) => update(i, { unit_price: Number(e.target.value) })}
                    className={`w-24 ${inputCls}`} title="Prix unitaire" />
                  <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500">Sous-total (avant remise client)</span>
          <span className="font-semibold text-gray-900">{subtotal.toFixed(2)} €</span>
        </div>

        {create.isError && <p className="text-red-500 text-sm">Erreur lors de l'enregistrement.</p>}
        <SubmitBar onCancel={onClose} pending={create.isPending} label="Créer le devis" />
      </form>
    </Modal>
  )
}

function ShipForm({ order, onClose }: { order: Order; onClose: () => void }) {
  const qc = useQueryClient()
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')

  const ship = useMutation({
    mutationFn: () =>
      api.post(`/orders/${order.id}/ship`, { carrier, tracking_number: tracking }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['stock'] })  // machines passées en vendu
      onClose()
    },
  })

  return (
    <Modal title={`Expédier ${order.reference}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); ship.mutate() }} className="space-y-3">
        <p className="text-sm text-gray-500">
          Les {order.lines.length} article(s) liés au stock passeront automatiquement en « vendu ».
        </p>
        <TextInput label="Transporteur" value={carrier} onChange={setCarrier} placeholder="Chronopost, Colissimo…" required />
        <TextInput label="N° de suivi" value={tracking} onChange={setTracking} placeholder="XY123456789FR" required />
        {ship.isError && <p className="text-red-500 text-sm">Erreur lors de l'expédition.</p>}
        <SubmitBar onCancel={onClose} pending={ship.isPending} label="Confirmer l'expédition" />
      </form>
    </Modal>
  )
}
