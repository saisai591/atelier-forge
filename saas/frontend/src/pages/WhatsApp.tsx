import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send, CheckCircle, XCircle } from 'lucide-react'
import api from '../api/client'
import type { WhatsAppMessage, ClientType } from '../types'

const SEGMENTS: { value: ClientType | ''; label: string }[] = [
  { value: '',               label: 'Tous les clients' },
  { value: 'particulier',    label: 'Particuliers' },
  { value: 'grossiste',      label: 'Grossistes' },
  { value: 'semi_grossiste', label: 'Semi-grossistes' },
  { value: 'revendeur',      label: 'Revendeurs' },
]

export default function WhatsApp() {
  const [segment, setSegment] = useState<ClientType | ''>('')
  const [body, setBody] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: messages = [] } = useQuery<WhatsAppMessage[]>({
    queryKey: ['whatsapp-messages'],
    queryFn: () => api.get('/whatsapp/messages').then((r) => r.data),
  })

  const broadcast = useMutation({
    mutationFn: () =>
      api.post('/whatsapp/broadcast', {
        client_type: segment || undefined,
        body,
      }).then((r) => r.data),
    onSuccess: (d) => {
      setResult(`${d.sent} envoyé(s), ${d.failed} échec(s), ${d.skipped_no_number} sans numéro`)
      setBody('')
      qc.invalidateQueries({ queryKey: ['whatsapp-messages'] })
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <MessageCircle size={22} className="text-green-600" /> WhatsApp
      </h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Composer de diffusion */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Diffusion catalogue / promo</h2>
          <label className="block text-sm font-medium text-gray-700 mb-1">Segment</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as ClientType | '')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-forge-500"
          >
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Nouveau catalogue de PC reconditionnés disponible…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-forge-500 resize-none"
          />
          <button
            onClick={() => broadcast.mutate()}
            disabled={!body.trim() || broadcast.isPending}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-60"
          >
            <Send size={16} /> {broadcast.isPending ? 'Envoi…' : 'Diffuser'}
          </button>
          {result && <p className="text-sm text-gray-600 mt-3">{result}</p>}
        </div>

        {/* Journal */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Derniers messages</h2>
          {messages.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun message envoyé</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto">
              {messages.map((m) => (
                <div key={m.id} className="flex items-start gap-2 text-sm border-b border-gray-100 pb-2 last:border-0">
                  {m.status === 'sent' ? (
                    <CheckCircle size={15} className="text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono text-xs text-gray-500">{m.to_number}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(m.created_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-gray-700 truncate">{m.body}</p>
                    {m.error && <p className="text-xs text-red-500 truncate">{m.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
