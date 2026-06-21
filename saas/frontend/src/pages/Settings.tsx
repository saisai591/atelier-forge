import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, MessageCircle, KeyRound, Save, RefreshCw, Copy, Check } from 'lucide-react'
import api from '../api/client'
import { useAuthStore } from '../store/auth'
import type { Tenant, CompanyInfo } from '../types'

export default function Settings() {
  const setTenant = useAuthStore((s) => s.setTenant)
  const qc = useQueryClient()

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['tenant-me'],
    queryFn: () => api.get('/tenants/me').then((r) => r.data),
  })

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Réglages</h1>
      <div className="space-y-6">
        {tenant && (
          <CompanySection
            initial={tenant.company || {}}
            onSaved={(c) => {
              setTenant({ ...tenant, company: c })
              qc.invalidateQueries({ queryKey: ['tenant-me'] })
            }}
          />
        )}
        <WhatsAppSection />
        <IngestKeySection />
      </div>
    </div>
  )
}

function Card({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-forge-600">{icon}</span>
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-gray-400 mb-4">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-4'}>{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, textarea }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean
}) {
  const cls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forge-500"
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} className={`${cls} resize-none`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  )
}

function CompanySection({ initial, onSaved }: { initial: CompanyInfo; onSaved: (c: CompanyInfo) => void }) {
  const [c, setC] = useState<CompanyInfo>(initial)
  const [done, setDone] = useState(false)
  useEffect(() => setC(initial), [initial])

  const save = useMutation({
    mutationFn: () => api.patch('/tenants/me/company', c).then((r) => r.data),
    onSuccess: () => { onSaved(c); setDone(true); setTimeout(() => setDone(false), 2000) },
  })

  const set = (k: keyof CompanyInfo) => (v: string) => setC((p) => ({ ...p, [k]: v }))

  return (
    <Card icon={<Building2 size={18} />} title="Identité de la société"
      subtitle="Apparaît sur les factures PDF (mentions légales obligatoires).">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Raison sociale" value={c.name ?? ''} onChange={set('name')} placeholder="Atelier Forge SARL" />
        <Field label="SIRET" value={c.siret ?? ''} onChange={set('siret')} placeholder="812 345 678 00012" />
        <Field label="Adresse" value={c.address ?? ''} onChange={set('address')} placeholder="12 rue des Artisans" />
        <Field label="Code postal / Ville" value={c.zip_city ?? ''} onChange={set('zip_city')} placeholder="75011 Paris" />
        <Field label="N° TVA" value={c.vat_number ?? ''} onChange={set('vat_number')} placeholder="FR12812345678" />
        <Field label="IBAN" value={c.iban ?? ''} onChange={set('iban')} placeholder="FR76 …" />
      </div>
      <div className="grid gap-3 mt-3">
        <Field label="Conditions de paiement" value={c.payment_terms ?? ''} onChange={set('payment_terms')} placeholder="Paiement à 30 jours" />
        <Field label="Mentions légales" value={c.legal_mentions ?? ''} onChange={set('legal_mentions')} textarea placeholder="TVA sur marge — biens d'occasion…" />
      </div>
      <button onClick={() => save.mutate()} disabled={save.isPending}
        className="mt-4 flex items-center gap-2 bg-forge-500 text-white px-4 py-2 rounded-lg hover:bg-forge-600 transition text-sm font-medium disabled:opacity-60">
        {done ? <Check size={16} /> : <Save size={16} />} {done ? 'Enregistré' : 'Enregistrer'}
      </button>
    </Card>
  )
}

function WhatsAppSection() {
  const [token, setToken] = useState('')
  const [phoneId, setPhoneId] = useState('')
  const [done, setDone] = useState(false)
  const qc = useQueryClient()

  const { data: integrations } = useQuery<Record<string, { provider?: string; has_token?: boolean; phone_id?: string }>>({
    queryKey: ['integrations'],
    queryFn: () => api.get('/tenants/me/integrations').then((r) => r.data),
  })
  const wa = integrations?.whatsapp

  useEffect(() => { if (wa?.phone_id) setPhoneId(wa.phone_id) }, [wa?.phone_id])

  const save = useMutation({
    mutationFn: () =>
      api.put('/tenants/me/integrations/whatsapp', {
        provider: 'meta', token, phone_id: phoneId,
      }).then((r) => r.data),
    onSuccess: () => { setToken(''); setDone(true); setTimeout(() => setDone(false), 2000); qc.invalidateQueries({ queryKey: ['integrations'] }) },
  })

  return (
    <Card icon={<MessageCircle size={18} />} title="Intégration WhatsApp"
      subtitle="WhatsApp Business Cloud API (Meta). Sans config, le mode console (test) est utilisé.">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Phone Number ID" value={phoneId} onChange={setPhoneId} placeholder="123456789012345" />
        <Field
          label={wa?.has_token ? 'Token (déjà configuré — laisser vide pour conserver)' : 'Token d\'accès'}
          value={token} onChange={setToken} placeholder="EAAG…"
        />
      </div>
      <button onClick={() => save.mutate()} disabled={save.isPending || !phoneId || !token}
        className="mt-4 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-60">
        {done ? <Check size={16} /> : <Save size={16} />} {done ? 'Enregistré' : 'Connecter'}
      </button>
      {wa?.has_token && <p className="text-xs text-green-600 mt-2">✓ WhatsApp connecté ({wa.provider})</p>}
    </Card>
  )
}

function IngestKeySection() {
  const [copied, setCopied] = useState(false)
  const qc = useQueryClient()

  const { data } = useQuery<{ ingest_key: string }>({
    queryKey: ['ingest-key'],
    queryFn: () => api.get('/tenants/me/ingest-key').then((r) => r.data),
  })

  const rotate = useMutation({
    mutationFn: () => api.post('/tenants/me/ingest-key/rotate').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingest-key'] }),
  })

  const copy = () => {
    if (data?.ingest_key) {
      navigator.clipboard.writeText(data.ingest_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card icon={<KeyRound size={18} />} title="Clé d'ingestion PXE"
      subtitle="À fournir par le serveur PXE (header X-Forge-Key) pour pousser les audits vers le stock.">
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 truncate">
          {data?.ingest_key ?? '…'}
        </code>
        <button onClick={copy} title="Copier" className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} className="text-gray-500" />}
        </button>
        <button onClick={() => rotate.mutate()} disabled={rotate.isPending} title="Régénérer"
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw size={15} className={`text-gray-500 ${rotate.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">La régénération révoque immédiatement l'ancienne clé.</p>
    </Card>
  )
}
