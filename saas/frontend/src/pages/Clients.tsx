import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import api from '../api/client'
import Modal from '../components/Modal'
import { TextInput, NumberInput, Select, SubmitBar } from '../components/form'
import type { Client, ClientType } from '../types'

const TYPE_LABELS: Record<ClientType, string> = {
  particulier:   'Particulier',
  grossiste:     'Grossiste',
  semi_grossiste:'Semi-grossiste',
  revendeur:     'Revendeur',
}

const TYPE_COLORS: Record<ClientType, string> = {
  particulier:   'bg-blue-100 text-blue-700',
  grossiste:     'bg-purple-100 text-purple-700',
  semi_grossiste:'bg-orange-100 text-orange-700',
  revendeur:     'bg-green-100 text-green-700',
}

export default function Clients() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ClientType | ''>('')
  const [showForm, setShowForm] = useState(false)

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', typeFilter],
    queryFn: () =>
      api.get(`/clients/${typeFilter ? `?type=${typeFilter}` : ''}`).then((r) => r.data),
  })

  const filtered = clients.filter((c) => {
    const haystack = `${c.first_name ?? ''} ${c.last_name ?? ''} ${c.company_name ?? ''} ${c.email}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-forge-500 text-white px-4 py-2 rounded-lg hover:bg-forge-600 transition text-sm font-medium">
          <Plus size={16} /> Nouveau client
        </button>
      </div>

      {showForm && <ClientForm onClose={() => setShowForm(false)} />}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forge-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ClientType | '')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forge-500"
        >
          <option value="">Tous les types</option>
          {(Object.keys(TYPE_LABELS) as ClientType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Aucun client trouvé</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Téléphone</th>
                <th className="px-4 py-3 text-left">Remise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.company_name ?? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[c.type]}`}>
                      {TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.email}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.discount_rate > 0 ? `${c.discount_rate}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ClientForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [type, setType] = useState<ClientType>('particulier')
  const [companyName, setCompanyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [taxNumber, setTaxNumber] = useState('')
  const [discount, setDiscount] = useState<number | ''>('')

  const isCompany = type !== 'particulier'

  const create = useMutation({
    mutationFn: () =>
      api.post('/clients/', {
        type,
        company_name: isCompany ? companyName : null,
        first_name: firstName || null,
        last_name: lastName || null,
        email,
        phone: phone || null,
        whatsapp: whatsapp || null,
        tax_number: taxNumber || null,
        discount_rate: discount === '' ? 0 : discount,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      onClose()
    },
  })

  return (
    <Modal title="Nouveau client" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-3">
        <Select<ClientType> label="Type" value={type} onChange={setType} required
          options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value: value as ClientType, label }))} />
        {isCompany && <TextInput label="Raison sociale" value={companyName} onChange={setCompanyName} required />}
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Prénom" value={firstName} onChange={setFirstName} />
          <TextInput label="Nom" value={lastName} onChange={setLastName} />
        </div>
        <TextInput label="Email" type="email" value={email} onChange={setEmail} required />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Téléphone" value={phone} onChange={setPhone} />
          <TextInput label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="+33…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="N° TVA" value={taxNumber} onChange={setTaxNumber} />
          <NumberInput label="Remise (%)" value={discount} onChange={setDiscount} placeholder="0" />
        </div>
        {create.isError && <p className="text-red-500 text-sm">Erreur lors de l'enregistrement.</p>}
        <SubmitBar onCancel={onClose} pending={create.isPending} />
      </form>
    </Modal>
  )
}
