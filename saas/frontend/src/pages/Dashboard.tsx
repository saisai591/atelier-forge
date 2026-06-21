import { useQuery } from '@tanstack/react-query'
import { Package, TrendingUp, Wallet, AlertCircle, Users, CheckCircle, Clock } from 'lucide-react'
import api from '../api/client'
import { useAuthStore } from '../store/auth'

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

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-yellow-100 text-yellow-700',
  D: 'bg-red-100 text-red-700',
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery<Overview>({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Bonjour, {user?.full_name?.split(' ')[0]}
      </h1>

      {isLoading || !data ? (
        <p className="text-gray-400 text-sm">Chargement des indicateurs…</p>
      ) : (
        <>
          {/* KPIs principaux */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={<Wallet size={20} />} color="blue"
              label="Valeur du stock" value={`${data.stock.available_value.toFixed(0)} €`} />
            <StatCard icon={<TrendingUp size={20} />} color="green"
              label="Marge réalisée" value={`${data.stock.realized_margin.toFixed(0)} €`} />
            <StatCard icon={<AlertCircle size={20} />} color="red"
              label="Impayé (HT)" value={`${data.accounting.unpaid_ht.toFixed(0)} €`} />
            <StatCard icon={<Users size={20} />} color="purple"
              label="Clients" value={data.clients.total} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Stock */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Package size={18} /> Stock ({data.stock.total})
              </h2>
              <div className="space-y-2 mb-4">
                <StatusBar label="Prêtes" icon={<CheckCircle size={14} className="text-green-500" />}
                  count={data.stock.by_status['ready'] ?? 0} total={data.stock.total} color="bg-green-500" />
                <StatusBar label="En diagnostic" icon={<Clock size={14} className="text-yellow-500" />}
                  count={data.stock.by_status['in_diagnosis'] ?? 0} total={data.stock.total} color="bg-yellow-500" />
                <StatusBar label="Vendues" icon={<TrendingUp size={14} className="text-purple-500" />}
                  count={data.stock.by_status['sold'] ?? 0} total={data.stock.total} color="bg-purple-500" />
              </div>
              {Object.keys(data.stock.by_grade).length > 0 && (
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400 self-center">Grades :</span>
                  {Object.entries(data.stock.by_grade).sort().map(([g, n]) => (
                    <span key={g} className={`px-2 py-0.5 rounded text-xs font-medium ${GRADE_COLORS[g] ?? 'bg-gray-100 text-gray-600'}`}>
                      {g} · {n}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Comptabilité */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Wallet size={18} /> Facturation (HT)
              </h2>
              <div className="space-y-3">
                <Row label="Facturé" value={data.accounting.invoiced_ht} color="text-gray-900" />
                <Row label="Encaissé" value={data.accounting.paid_ht} color="text-green-600" />
                <Row label="En attente de paiement" value={data.accounting.unpaid_ht} color="text-red-600" />
              </div>
              {data.accounting.invoiced_ht > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500"
                      style={{ width: `${(data.accounting.paid_ht / data.accounting.invoiced_ht) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {((data.accounting.paid_ht / data.accounting.invoiced_ht) * 100).toFixed(0)}% encaissé
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number
  color: 'blue' | 'green' | 'red' | 'purple'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600', purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-3`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}

function StatusBar({ label, icon, count, total, color }: {
  label: string; icon: React.ReactNode; count: number; total: number; color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="flex items-center gap-1.5 text-gray-600">{icon} {label}</span>
        <span className="font-medium text-gray-900">{count}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`font-semibold ${color}`}>{value.toFixed(2)} €</span>
    </div>
  )
}
