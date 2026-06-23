import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  Boxes,
  ClipboardList,
  Download,
  FileSpreadsheet,
  PackagePlus,
  MapPin,
  PackageCheck,
  Printer,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Tablet,
  Truck,
  Upload,
  Warehouse,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import ThemeToggle from '../components/ThemeToggle'
import api from '../api/client'
import { useThemeMode } from '../hooks/useThemeMode'

type ReceptionStatus = 'import_pending' | 'receiving' | 'scanning' | 'quality_control' | 'closed'
type ShipmentStatus = 'draft' | 'picking' | 'quality_control' | 'ready_for_carrier' | 'shipped'
type PalletStatus = 'expected' | 'in_progress' | 'complete' | 'blocked'
type ErpWorkspace = 'receptions' | 'shipments' | 'pallets' | 'scan' | 'inventory' | 'documents'
type DocumentFilter = 'all' | AtelierDocument['document_type']

interface AtelierOverview {
  receptions_open: number
  items_expected: number
  items_scanned: number
  pallets_active: number
  shipments_open: number
  documents_ready: number
}

interface ReceptionBatch {
  id: string
  reference: string
  supplier_name: string
  source_filename?: string | null
  source_format?: string | null
  expected_items: number
  scanned_items: number
  pallet_count: number
  location?: string | null
  status: ReceptionStatus
  mapping_profile?: Record<string, unknown>
  notes?: string | null
}

interface ClientShipment {
  id: string
  reference: string
  client_name: string
  carrier?: string | null
  expected_items: number
  pallet_count: number
  status: ShipmentStatus
  document_state?: Record<string, unknown>
  notes?: string | null
}

interface AtelierPallet {
  id: string
  reception_id?: string | null
  shipment_id?: string | null
  reference: string
  label?: string | null
  expected_items: number
  scanned_items: number
  location?: string | null
  status: PalletStatus
}

interface SupplierImportPreview {
  filename: string
  file_format: string
  detected_columns: string[]
  row_count: number
  field_guesses: Array<{ source_column: string; target_field: string; confidence: number }>
  warnings: string[]
}

interface ScanSession {
  id: string
  reception_id?: string | null
  pallet_id?: string | null
  operator_name?: string | null
  device_name?: string | null
  device_type?: string | null
  status: 'open' | 'paused' | 'closed'
  scanned_count: number
  anomaly_count: number
  created_at: string
}

interface ScanEvent {
  id: string
  session_id: string
  code: string
  event_type: 'found' | 'unknown' | 'duplicate' | 'wrong_batch' | 'manual_note'
  message?: string | null
  created_at: string
}

interface MachineLookup {
  code: string
  found: boolean
  source: string
  stock_item_id?: string | null
  serial_number?: string | null
  brand?: string | null
  model?: string | null
  grade?: string | null
  status?: string | null
  summary?: Record<string, unknown>
}

interface AtelierDocument {
  id: string
  reception_id?: string | null
  shipment_id?: string | null
  document_type: 'supplier_manifest' | 'pallet_label' | 'delivery_note' | 'packing_list' | 'quality_report'
  title: string
  file_path?: string | null
  payload: Record<string, unknown>
  created_at: string
}

const workflow = [
  { label: 'Import fournisseur', detail: 'Excel, CSV, XML', icon: Upload },
  { label: 'Reception palette', detail: 'Lot, quai, zone', icon: Warehouse },
  { label: 'Scan materiel', detail: 'PDA, tablette, douchette', icon: ScanLine },
  { label: 'Audit et controle', detail: 'PXE, etat, grade', icon: ShieldCheck },
  { label: 'Sortie client', detail: 'Palette, BL, transport', icon: Truck },
]

const terminals = [
  { name: 'Unitech atelier', type: 'Android scanner', state: 'Connecte', icon: Smartphone },
  { name: 'Tablette reception', type: 'Mode debutant', state: 'Prete', icon: Tablet },
  { name: 'Douchette BT', type: 'Saisie rapide', state: 'A associer', icon: Barcode },
]

const receptionStatusLabel: Record<ReceptionStatus, string> = {
  import_pending: 'Import',
  receiving: 'Reception',
  scanning: 'Scan en cours',
  quality_control: 'Controle',
  closed: 'Cloturee',
}

const receptionStatusStyle: Record<ReceptionStatus, string> = {
  import_pending: 'border-slate-300/20 bg-slate-300/10 text-slate-200',
  receiving: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
  scanning: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
  quality_control: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  closed: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
}

function nextRef(prefix: string) {
  const now = new Date()
  const day = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`.padStart(6, '0')
  return `${prefix}-${day}-${time}`
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function downloadPdf(path: string, filename: string) {
  const response = await api.get(path, { responseType: 'blob' })
  saveBlob(response.data, filename)
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function exportRows(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.map(csvEscape).join(';'),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(';')),
  ].join('\n')
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
}

export default function Erp() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [lastLookup, setLastLookup] = useState<MachineLookup | null>(null)
  const [machineLookups, setMachineLookups] = useState<MachineLookup[]>([])
  const [lastImportPreview, setLastImportPreview] = useState<SupplierImportPreview | null>(null)
  const [pendingImportFileName, setPendingImportFileName] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<ErpWorkspace>('receptions')
  const [documentFilter, setDocumentFilter] = useState<DocumentFilter>('all')
  const { theme, isDark, toggleTheme } = useThemeMode()

  const overviewQuery = useQuery<AtelierOverview>({
    queryKey: ['atelier-erp', 'overview'],
    queryFn: () => api.get('/atelier-erp/overview').then((response) => response.data),
  })
  const receptionsQuery = useQuery<ReceptionBatch[]>({
    queryKey: ['atelier-erp', 'receptions'],
    queryFn: () => api.get('/atelier-erp/receptions').then((response) => response.data),
  })
  const shipmentsQuery = useQuery<ClientShipment[]>({
    queryKey: ['atelier-erp', 'shipments'],
    queryFn: () => api.get('/atelier-erp/shipments').then((response) => response.data),
  })
  const palletsQuery = useQuery<AtelierPallet[]>({
    queryKey: ['atelier-erp', 'pallets'],
    queryFn: () => api.get('/atelier-erp/pallets').then((response) => response.data),
  })
  const scanSessionsQuery = useQuery<ScanSession[]>({
    queryKey: ['atelier-erp', 'scan-sessions'],
    queryFn: () => api.get('/atelier-erp/scan-sessions').then((response) => response.data),
  })
  const documentsQuery = useQuery<AtelierDocument[]>({
    queryKey: ['atelier-erp', 'documents'],
    queryFn: () => api.get('/atelier-erp/documents').then((response) => response.data),
  })

  const receptions = receptionsQuery.data ?? []
  const shipments = shipmentsQuery.data ?? []
  const pallets = palletsQuery.data ?? []
  const scanSessions = scanSessionsQuery.data ?? []
  const documents = documentsQuery.data ?? []
  const filteredDocuments = documentFilter === 'all' ? documents : documents.filter((document) => document.document_type === documentFilter)
  const activeSession = scanSessions.find((session) => session.id === activeSessionId)
    ?? scanSessions.find((session) => session.status === 'open')
    ?? null
  const overview = overviewQuery.data

  const scanEventsQuery = useQuery<ScanEvent[]>({
    queryKey: ['atelier-erp', 'scan-events', activeSession?.id],
    queryFn: () => api.get(`/atelier-erp/scan-sessions/${activeSession?.id}/events`).then((response) => response.data),
    enabled: Boolean(activeSession?.id),
  })

  const totalExpected = overview?.items_expected ?? receptions.reduce((sum, item) => sum + item.expected_items, 0)
  const totalScanned = overview?.items_scanned ?? receptions.reduce((sum, item) => sum + item.scanned_items, 0)
  const openShipments = overview?.shipments_open ?? shipments.filter((item) => item.status !== 'shipped').length

  const latestFieldMapping = useMemo(() => {
    const latest = receptions.find((item) => item.mapping_profile && Object.keys(item.mapping_profile).length > 0)
    const guesses = (latest?.mapping_profile?.field_guesses ?? []) as SupplierImportPreview['field_guesses']
    if (!guesses.length) {
      return [
        ['SerialNumber', 'Numero de serie', 'En attente fichier'],
        ['Model / Product', 'Marque + modele', 'En attente fichier'],
        ['Asset Tag', 'Reference fournisseur', 'En attente fichier'],
        ['Grade', 'Etat initial', 'En attente fichier'],
      ]
    }
    return guesses.slice(0, 6).map((guess) => [
      guess.source_column,
      guess.target_field,
      `Confiance ${guess.confidence}%`,
    ])
  }, [receptions])

  const invalidateErp = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['atelier-erp', 'overview'] }),
      queryClient.invalidateQueries({ queryKey: ['atelier-erp', 'receptions'] }),
      queryClient.invalidateQueries({ queryKey: ['atelier-erp', 'shipments'] }),
      queryClient.invalidateQueries({ queryKey: ['atelier-erp', 'pallets'] }),
      queryClient.invalidateQueries({ queryKey: ['atelier-erp', 'scan-sessions'] }),
      queryClient.invalidateQueries({ queryKey: ['atelier-erp', 'documents'] }),
    ])
  }

  const createReception = useMutation({
    mutationFn: async () => {
      const payload = {
        reference: nextRef('REC'),
        supplier_name: 'Arrivage atelier',
        source_filename: 'saisie-manuelle',
        source_format: 'manual',
        expected_items: 0,
        scanned_items: 0,
        pallet_count: 0,
        location: 'Zone reception',
        status: 'receiving',
        notes: 'Reception creee depuis AtelierOS.',
      }
      return api.post('/atelier-erp/receptions', payload).then((response) => response.data)
    },
    onSuccess: async () => {
      setMessage('Reception creee. Vous pouvez maintenant scanner ou importer un fichier fournisseur.')
      await invalidateErp()
    },
  })

  const createShipment = useMutation({
    mutationFn: async () => {
      const payload = {
        reference: nextRef('SORT'),
        client_name: 'Client a renseigner',
        carrier: 'Transport a definir',
        expected_items: 0,
        pallet_count: 0,
        status: 'draft',
        document_state: {},
        notes: 'Sortie creee depuis AtelierOS.',
      }
      return api.post('/atelier-erp/shipments', payload).then((response) => response.data)
    },
    onSuccess: async () => {
      setMessage('Sortie client creee. Completez le client, les palettes et les documents.')
      await invalidateErp()
    },
  })

  const createScanSession = useMutation({
    mutationFn: async (receptionId?: string) => {
      const payload = {
        reception_id: receptionId ?? null,
        operator_name: 'Technicien atelier',
        device_name: 'Interface AtelierOS',
        device_type: 'web',
      }
      return api.post('/atelier-erp/scan-sessions', payload).then((response) => response.data)
    },
    onSuccess: async (session: ScanSession) => {
      setActiveSessionId(session.id)
      setMessage('Session scan ouverte. Le PDA ou la douchette peut envoyer les codes.')
      await queryClient.invalidateQueries({ queryKey: ['atelier-erp'] })
    },
  })

  const updateReception = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ReceptionBatch> }) =>
      api.patch(`/atelier-erp/receptions/${id}`, payload).then((response) => response.data),
    onSuccess: async () => {
      setMessage('Reception mise a jour.')
      await invalidateErp()
    },
  })

  const updateShipment = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ClientShipment> }) =>
      api.patch(`/atelier-erp/shipments/${id}`, payload).then((response) => response.data),
    onSuccess: async () => {
      setMessage('Sortie client mise a jour.')
      await invalidateErp()
    },
  })

  const deleteReception = useMutation({
    mutationFn: async (id: string) => api.delete(`/atelier-erp/receptions/${id}`),
    onSuccess: async () => {
      setMessage('Reception supprimee.')
      await invalidateErp()
    },
  })

  const deleteShipment = useMutation({
    mutationFn: async (id: string) => api.delete(`/atelier-erp/shipments/${id}`),
    onSuccess: async () => {
      setMessage('Sortie supprimee.')
      await invalidateErp()
    },
  })

  const createPallet = useMutation({
    mutationFn: async ({ shipmentId, receptionId, reference }: { shipmentId?: string; receptionId?: string; reference: string }) =>
      api.post<AtelierPallet>('/atelier-erp/pallets', {
        shipment_id: shipmentId ?? null,
        reception_id: receptionId ?? null,
        reference,
        label: reference,
        expected_items: 0,
        scanned_items: 0,
        location: shipmentId ? 'Zone sortie' : 'Zone reception',
        status: 'expected',
        metadata_json: {},
      }).then((response) => response.data),
    onSuccess: async () => {
      setMessage('Palette creee.')
      await invalidateErp()
    },
  })

  const updatePallet = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<AtelierPallet> }) =>
      api.patch(`/atelier-erp/pallets/${id}`, payload).then((response) => response.data),
    onSuccess: async () => {
      setMessage('Palette mise a jour.')
      await invalidateErp()
    },
  })

  const deletePallet = useMutation({
    mutationFn: async (id: string) => api.delete(`/atelier-erp/pallets/${id}`),
    onSuccess: async () => {
      setMessage('Palette supprimee.')
      await invalidateErp()
    },
  })

  const submitScanCode = useMutation({
    mutationFn: async (code: string) => {
      let session = activeSession
      if (!session) {
        const createdSession = await api.post<ScanSession>('/atelier-erp/scan-sessions', {
          reception_id: receptions[0]?.id ?? null,
          operator_name: 'Technicien atelier',
          device_name: 'Interface AtelierOS',
          device_type: 'web',
        }).then((response) => response.data)
        session = createdSession
        setActiveSessionId(session.id)
      }
      if (!session) throw new Error('Session scan non creee')
      const lookup = await api.get<MachineLookup>(`/atelier-erp/machine-lookup/${encodeURIComponent(code)}`).then((response) => response.data)
      const event = await api.post<ScanEvent>(`/atelier-erp/scan-sessions/${session.id}/events`, {
        code,
        event_type: lookup.found ? 'found' : 'unknown',
        message: lookup.found
          ? `${lookup.brand || ''} ${lookup.model || ''}`.trim() || 'Machine trouvee'
          : 'Code inconnu dans stock/audits',
        matched_stock_item_id: lookup.stock_item_id ?? null,
        payload: lookup,
      }).then((response) => response.data)
      return { lookup, event }
    },
    onSuccess: async ({ lookup }) => {
      setLastLookup(lookup)
      setMachineLookups((current) => [lookup, ...current.filter((item) => item.code !== lookup.code)].slice(0, 50))
      setScanCode('')
      setMessage(lookup.found ? `Machine trouvee : ${lookup.brand || ''} ${lookup.model || lookup.serial_number || lookup.code}` : `Code non reconnu : ${lookup.code}`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['atelier-erp', 'scan-sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['atelier-erp', 'scan-events'] }),
      ])
    },
    onError: () => {
      setMessage('Scan impossible. Verifiez la session ou le backend ERP.')
    },
  })

  const updateScanSession = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ScanSession['status'] }) =>
      api.patch(`/atelier-erp/scan-sessions/${id}`, { status }).then((response) => response.data),
    onSuccess: async () => {
      setMessage('Session scan mise a jour.')
      await queryClient.invalidateQueries({ queryKey: ['atelier-erp', 'scan-sessions'] })
    },
  })

  const previewSupplierFile = async (file: File) => {
    setBusyAction('import')
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const preview = await api.post<SupplierImportPreview>('/atelier-erp/supplier-import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((response) => response.data)
      setLastImportPreview(preview)
      setPendingImportFileName(file.name)
      setMessage(`Apercu pret : ${preview.row_count} ligne(s), ${preview.detected_columns.length} colonne(s). Validez pour creer la reception.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Apercu impossible. Verifiez le fichier.')
    } finally {
      setBusyAction(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const commitSupplierPreview = async () => {
    if (!lastImportPreview) return
    setBusyAction('commit-import')
    setMessage(null)
    try {
      await api.post('/atelier-erp/supplier-import/commit', {
        reference: nextRef('REC'),
        supplier_name: (pendingImportFileName || lastImportPreview.filename).replace(/\.[^.]+$/, '') || 'Fournisseur',
        source_filename: lastImportPreview.filename,
        source_format: lastImportPreview.file_format,
        expected_items: lastImportPreview.row_count,
        pallet_count: 0,
        location: 'Zone reception',
        mapping_profile: {
          detected_columns: lastImportPreview.detected_columns,
          field_guesses: lastImportPreview.field_guesses,
          warnings: lastImportPreview.warnings,
        },
        notes: `Import ${lastImportPreview.file_format} depuis interface ERP.`,
      })
      setMessage(`Fichier importe : ${lastImportPreview.row_count} ligne(s), ${lastImportPreview.detected_columns.length} colonne(s).`)
      setPendingImportFileName(null)
      await invalidateErp()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import impossible. Verifiez le fichier.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDownloadBl = async (shipment: ClientShipment) => {
    setBusyAction(`bl-${shipment.id}`)
    try {
      await downloadPdf(`/atelier-erp/shipments/${shipment.id}/delivery-note.pdf`, `bl-${shipment.reference}.pdf`)
      await api.post('/atelier-erp/documents', {
        shipment_id: shipment.id,
        document_type: 'delivery_note',
        title: `BL ${shipment.reference}`,
        file_path: null,
        payload: { reference: shipment.reference, generated_from: 'erp_interface' },
      })
      setMessage(`BL genere pour ${shipment.reference}.`)
      await invalidateErp()
    } finally {
      setBusyAction(null)
    }
  }

  const handleDownloadPackingList = async (shipment: ClientShipment) => {
    setBusyAction(`packing-${shipment.id}`)
    try {
      await downloadPdf(`/atelier-erp/shipments/${shipment.id}/packing-list.pdf`, `colisage-${shipment.reference}.pdf`)
      await api.post('/atelier-erp/documents', {
        shipment_id: shipment.id,
        document_type: 'packing_list',
        title: `Liste colisage ${shipment.reference}`,
        file_path: null,
        payload: { reference: shipment.reference, generated_from: 'erp_interface' },
      })
      setMessage(`Liste de colisage generee pour ${shipment.reference}.`)
      await invalidateErp()
    } finally {
      setBusyAction(null)
    }
  }

  const handlePrintLabel = async (shipment: ClientShipment) => {
    setBusyAction(`label-${shipment.id}`)
    try {
      let pallet: AtelierPallet | undefined = pallets.find((item) => item.shipment_id === shipment.id)
      if (!pallet) {
        pallet = await api.post<AtelierPallet>('/atelier-erp/pallets', {
          shipment_id: shipment.id,
          reference: `${shipment.reference}-PAL-01`,
          label: `Palette ${shipment.reference}`,
          expected_items: shipment.expected_items,
          scanned_items: 0,
          location: 'Zone sortie',
          status: 'expected',
          metadata_json: {},
        }).then((response) => response.data)
        await invalidateErp()
      }
      if (pallet) {
        await downloadPdf(`/atelier-erp/pallets/${pallet.id}/label.pdf`, `palette-${pallet.reference}.pdf`)
        await api.post('/atelier-erp/documents', {
          shipment_id: shipment.id,
          document_type: 'pallet_label',
          title: `Etiquette palette ${pallet.reference}`,
          file_path: null,
          payload: { pallet_reference: pallet.reference, generated_from: 'erp_interface' },
        })
        setMessage(`Etiquette palette generee pour ${pallet.reference}.`)
        await invalidateErp()
      }
    } finally {
      setBusyAction(null)
    }
  }

  const handlePrintPalletLabel = async (pallet: AtelierPallet) => {
    setBusyAction(`pallet-label-${pallet.id}`)
    try {
      await downloadPdf(`/atelier-erp/pallets/${pallet.id}/label.pdf`, `palette-${pallet.reference}.pdf`)
      await api.post('/atelier-erp/documents', {
        shipment_id: pallet.shipment_id ?? null,
        reception_id: pallet.reception_id ?? null,
        document_type: 'pallet_label',
        title: `Etiquette palette ${pallet.reference}`,
        file_path: null,
        payload: { pallet_reference: pallet.reference, generated_from: 'erp_pallet_workspace' },
      })
      setMessage(`Etiquette palette generee pour ${pallet.reference}.`)
      await invalidateErp()
    } finally {
      setBusyAction(null)
    }
  }

  const pageClass = isDark ? 'bg-[#070a10] text-slate-100' : 'bg-slate-100 text-slate-950'
  const borderClass = isDark ? 'border-white/10' : 'border-slate-200'
  const titleClass = isDark ? 'text-white' : 'text-slate-950'
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600'
  const softMutedClass = isDark ? 'text-slate-500' : 'text-slate-500'
  const panelClass = isDark
    ? 'border-white/10 bg-white/[0.035] shadow-black/30'
    : 'border-slate-200 bg-white shadow-slate-200/80'
  const tileClass = isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50'
  const subtleTileClass = isDark ? 'border-white/10 bg-white/[0.055]' : 'border-slate-200 bg-white'
  const isLoading = overviewQuery.isLoading || receptionsQuery.isLoading || shipmentsQuery.isLoading
  const inputClass = `w-full rounded-lg border px-2 py-1.5 text-sm font-bold outline-none transition ${
    isDark
      ? 'border-white/10 bg-black/20 text-white placeholder:text-slate-600 focus:border-cyan-300/40'
      : 'border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-cyan-400'
  }`
  const workspaceTiles: Array<{ key: ErpWorkspace; label: string; detail: string; value: string; icon: typeof ClipboardList }> = [
    { key: 'receptions', label: 'Receptions', detail: 'Arrivages et imports', value: `${overview?.receptions_open ?? receptions.length}`, icon: ClipboardList },
    { key: 'shipments', label: 'Sorties', detail: 'Clients, BL, transport', value: `${openShipments}`, icon: Truck },
    { key: 'pallets', label: 'Palettes', detail: 'Etiquettes et zones', value: `${pallets.length}`, icon: PackagePlus },
    { key: 'scan', label: 'Scan', detail: 'Douchette et anomalies', value: `${activeSession?.scanned_count ?? 0}`, icon: ScanLine },
    { key: 'inventory', label: 'Inventaire', detail: 'Machines scannees', value: `${machineLookups.length}`, icon: ShieldCheck },
    { key: 'documents', label: 'Documents', detail: 'BL, etiquettes, rapports', value: `${documents.length}`, icon: Download },
  ]
  const exportWorkspace = () => {
    const date = new Date().toISOString().slice(0, 10)
    if (workspace === 'receptions') {
      exportRows(`atelieros-receptions-${date}.csv`, receptions.map((item) => ({
        reference: item.reference,
        fournisseur: item.supplier_name,
        statut: item.status,
        attendu: item.expected_items,
        scanne: item.scanned_items,
        palettes: item.pallet_count,
        zone: item.location || '',
        fichier: item.source_filename || '',
      })))
    } else if (workspace === 'shipments') {
      exportRows(`atelieros-sorties-${date}.csv`, shipments.map((item) => ({
        reference: item.reference,
        client: item.client_name,
        transporteur: item.carrier || '',
        statut: item.status,
        machines: item.expected_items,
        palettes: item.pallet_count,
      })))
    } else if (workspace === 'pallets') {
      exportRows(`atelieros-palettes-${date}.csv`, pallets.map((item) => ({
        reference: item.reference,
        statut: item.status,
        attendu: item.expected_items,
        scanne: item.scanned_items,
        zone: item.location || '',
        reception_id: item.reception_id || '',
        sortie_id: item.shipment_id || '',
      })))
    } else if (workspace === 'documents') {
      exportRows(`atelieros-documents-${date}.csv`, documents.map((item) => ({
        titre: item.title,
        type: item.document_type,
        cree_le: item.created_at,
        reception_id: item.reception_id || '',
        sortie_id: item.shipment_id || '',
      })))
    } else {
      const rows = workspace === 'inventory'
        ? machineLookups.map((item) => ({
          code: item.code,
          trouve: item.found ? 'oui' : 'non',
          source: item.source,
          serie: item.serial_number || '',
          marque: item.brand || '',
          modele: item.model || '',
          grade: item.grade || '',
          statut: item.status || '',
        }))
        : (scanEventsQuery.data ?? []).map((item) => ({
        code: item.code,
        type: item.event_type,
        message: item.message || '',
        cree_le: item.created_at,
      }))
      exportRows(`atelieros-${workspace}-${date}.csv`, rows)
    }
  }
  const documentFilters: Array<{ value: DocumentFilter; label: string }> = [
    { value: 'all', label: 'Tous' },
    { value: 'delivery_note', label: 'BL' },
    { value: 'pallet_label', label: 'Etiquettes' },
    { value: 'packing_list', label: 'Colisage' },
    { value: 'quality_report', label: 'Qualite' },
    { value: 'supplier_manifest', label: 'Fournisseur' },
  ]
  const guidance: Record<ErpWorkspace, string[]> = {
    receptions: ['Importer le fichier fournisseur', 'Verifier les colonnes detectees', 'Scanner les machines ou creer les palettes'],
    shipments: ['Renseigner le client', 'Ajouter les palettes', 'Generer BL puis etiquettes palette'],
    pallets: ['Verifier zone et quantites', 'Passer la palette en complete', 'Imprimer etiquette palette'],
    scan: ['Ouvrir une session', 'Scanner code-barres ou numero de serie', 'Traiter les anomalies avant cloture'],
    inventory: ['Scanner ou rechercher une machine', 'Verifier marque modele et grade', 'Exporter ou imprimer etiquette depuis la fiche'],
    documents: ['Verifier les BL generes', 'Verifier les etiquettes palette', 'Exporter si besoin pour archive'],
  }
  const blockedPallets = pallets.filter((pallet) => pallet.status === 'blocked').length
  const incompletePallets = pallets.filter((pallet) => pallet.status !== 'complete').length
  const scanAnomalies = activeSession?.anomaly_count ?? scanSessions.reduce((sum, session) => sum + session.anomaly_count, 0)
  const actionState = blockedPallets > 0 || scanAnomalies > 0
    ? { label: 'Bloque', detail: `${blockedPallets} palette(s) bloquee(s), ${scanAnomalies} anomalie(s) scan`, className: 'border-rose-300/25 bg-rose-300/10 text-rose-100' }
    : incompletePallets > 0 || openShipments > 0
      ? { label: 'A traiter', detail: `${incompletePallets} palette(s) a finir, ${openShipments} sortie(s) ouverte(s)`, className: 'border-amber-300/25 bg-amber-300/10 text-amber-100' }
      : { label: 'Pret', detail: 'Aucune anomalie critique detectee', className: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' }

  return (
    <main className={`min-h-screen ${pageClass}`}>
      <div className="mx-auto w-full max-w-[1560px] space-y-6 px-4 py-5 sm:px-6 lg:px-8 2xl:px-10">
        <header className={`flex flex-col gap-4 border-b ${borderClass} pb-5 lg:flex-row lg:items-end lg:justify-between`}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Atelier ERP</p>
            <h1 className={`mt-2 text-3xl font-black tracking-tight sm:text-4xl ${titleClass}`}>
              Reception, stock et sorties client
            </h1>
            <p className={`mt-3 max-w-4xl text-sm leading-6 ${mutedClass}`}>
              Interface connectee aux donnees reelles : import fournisseur, scan atelier, BL et etiquettes palette.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void previewSupplierFile(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busyAction === 'import'}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-300/15 disabled:opacity-50"
            >
              <Upload size={16} />
              {busyAction === 'import' ? 'Import...' : 'Importer'}
            </button>
            <button
              type="button"
              onClick={() => createScanSession.mutate(receptions[0]?.id)}
              disabled={createScanSession.isPending}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition hover:bg-cyan-300/10 disabled:opacity-50 ${isDark ? 'border-white/10 bg-white/[0.055] text-slate-100' : 'border-slate-200 bg-white text-slate-700 shadow-sm'}`}
            >
              <QrCode size={16} />
              Scanner
            </button>
            <button
              type="button"
              onClick={exportWorkspace}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition hover:bg-cyan-300/10 ${isDark ? 'border-white/10 bg-white/[0.055] text-slate-100' : 'border-slate-200 bg-white text-slate-700 shadow-sm'}`}
            >
              <FileSpreadsheet size={16} />
              Export CSV
            </button>
          </div>
        </header>

        {message && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${isDark ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100' : 'border-cyan-200 bg-cyan-50 text-cyan-900'}`}>
            {message}
          </div>
        )}

        <section className={`rounded-2xl border p-4 ${actionState.className}`}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-lg font-black">Etat atelier : {actionState.label}</div>
            <div className="text-sm font-bold opacity-80">{actionState.detail}</div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Receptions ouvertes" value={(overview?.receptions_open ?? receptions.length).toString()} icon={ClipboardList} tone="blue" isDark={isDark} />
          <MetricCard label="Machines attendues" value={totalExpected.toString()} icon={Boxes} tone="slate" isDark={isDark} />
          <MetricCard label="Machines scannees" value={`${totalScanned}/${totalExpected}`} icon={ScanLine} tone="emerald" isDark={isDark} />
          <MetricCard label="Sorties a preparer" value={openShipments.toString()} icon={Truck} tone="amber" isDark={isDark} />
        </section>

        <section className={`rounded-2xl border p-4 shadow-2xl ${panelClass}`}>
          <div className="grid gap-3 lg:grid-cols-5">
            {workflow.map((step, index) => (
              <div key={step.label} className={`flex min-h-24 items-center gap-3 rounded-xl border px-4 ${tileClass}`}>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                  <step.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-black ${titleClass}`}>{step.label}</p>
                  <p className={`truncate text-xs ${softMutedClass}`}>{step.detail}</p>
                </div>
                {index < workflow.length - 1 && <ArrowRight className="ml-auto hidden text-slate-600 xl:block" size={16} />}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {workspaceTiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => setWorkspace(tile.key)}
              className={`rounded-2xl border p-4 text-left transition ${
                workspace === tile.key
                  ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-950/20'
                  : `${tileClass} ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-white'}`
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`text-2xl font-black ${workspace === tile.key ? 'text-cyan-100' : titleClass}`}>{tile.value}</div>
                  <div className="mt-1 text-sm font-black">{tile.label}</div>
                  <div className={`mt-1 text-xs ${workspace === tile.key ? 'text-cyan-100/70' : softMutedClass}`}>{tile.detail}</div>
                </div>
                <tile.icon size={18} />
              </div>
            </button>
          ))}
        </section>

        <section className={`rounded-2xl border p-4 ${panelClass}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className={`text-sm font-black ${titleClass}`}>Guide rapide technicien</div>
              <div className={`mt-1 text-xs ${softMutedClass}`}>Etapes conseillees pour la tuile active.</div>
            </div>
            <div className="grid flex-1 gap-2 md:grid-cols-3">
              {guidance[workspace].map((step, index) => (
                <div key={step} className={`rounded-xl border px-3 py-2 text-sm font-bold ${tileClass}`}>
                  <span className="mr-2 text-cyan-300">{index + 1}.</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(24rem,0.85fr)]">
          <div className="space-y-6">
            {workspace === 'receptions' && <Panel className={panelClass}>
              <ModuleHeader
                title="Arrivages fournisseurs"
                subtitle="Les receptions viennent maintenant de la base ERP."
                action="Nouvelle reception"
                icon={FileSpreadsheet}
                isDark={isDark}
                onAction={() => createReception.mutate()}
                actionBusy={createReception.isPending}
              />
              <div className={`divide-y ${isDark ? 'divide-white/10' : 'divide-slate-200'}`}>
                {isLoading && <EmptyState text="Chargement des receptions..." isDark={isDark} />}
                {!isLoading && receptions.length === 0 && <EmptyState text="Aucune reception. Importez un fichier fournisseur ou creez une reception." isDark={isDark} />}
                {receptions.map((item) => (
                  <article key={item.id} className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-cyan-400">{item.reference}</span>
                          <StatusBadge label={receptionStatusLabel[item.status]} className={receptionStatusStyle[item.status]} />
                        </div>
                        <h3 className={`mt-2 truncate text-xl font-black ${titleClass}`}>{item.supplier_name}</h3>
                        <p className={`mt-1 text-sm ${mutedClass}`}>
                          {item.source_filename || 'Reception manuelle'} - {item.source_format || 'manuel'}
                        </p>
                        <div className={`mt-3 flex flex-wrap gap-2 text-xs ${mutedClass}`}>
                          <InfoPill icon={MapPin} label={item.location || 'Zone non definie'} isDark={isDark} />
                          <InfoPill icon={Boxes} label={`${item.pallet_count} palettes`} isDark={isDark} />
                          <InfoPill icon={PackageCheck} label={item.notes || 'Pret pour scan atelier'} isDark={isDark} />
                        </div>
                        <div className="mt-3 max-w-xs">
                          <select
                            className={inputClass}
                            value={item.status}
                            onChange={(event) => updateReception.mutate({ id: item.id, payload: { status: event.target.value as ReceptionStatus } })}
                          >
                            <option value="import_pending">Import</option>
                            <option value="receiving">Reception</option>
                            <option value="scanning">Scan en cours</option>
                            <option value="quality_control">Controle</option>
                            <option value="closed">Cloturee</option>
                          </select>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ActionButton
                            icon={PackagePlus}
                            label="Ajouter palette"
                            busy={createPallet.isPending}
                            onClick={() => createPallet.mutate({ receptionId: item.id, reference: `${item.reference}-PAL-${item.pallet_count + 1}` })}
                            isDark={isDark}
                          />
                          <ActionButton
                            icon={Download}
                            label="Supprimer"
                            busy={deleteReception.isPending}
                            onClick={() => deleteReception.mutate(item.id)}
                            isDark={isDark}
                          />
                          <ActionButton
                            icon={PackageCheck}
                            label="Cloturer"
                            busy={updateReception.isPending}
                            onClick={() => updateReception.mutate({ id: item.id, payload: { status: 'closed' } })}
                            isDark={isDark}
                          />
                        </div>
                      </div>
                      <ProgressBlock current={item.scanned_items} total={Math.max(item.expected_items, 1)} isDark={isDark} />
                    </div>
                  </article>
                ))}
              </div>
            </Panel>}

            {workspace === 'shipments' && <Panel className={panelClass}>
              <ModuleHeader
                title="Sorties client et palettes"
                subtitle="BL et etiquettes palette sont generes par le backend en PDF."
                action="Creer sortie"
                icon={Truck}
                isDark={isDark}
                onAction={() => createShipment.mutate()}
                actionBusy={createShipment.isPending}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className={`border-b text-xs uppercase tracking-[0.16em] ${isDark ? 'border-white/10 bg-white/[0.035] text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <tr>
                      <th className="px-5 py-3">Sortie</th>
                      <th className="px-5 py-3">Client</th>
                      <th className="px-5 py-3">Machines</th>
                      <th className="px-5 py-3">Transport</th>
                      <th className="px-5 py-3">Statut</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-white/10' : 'divide-slate-200'}`}>
                    {shipments.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <EmptyState text="Aucune sortie client. Creez une sortie pour generer BL et etiquettes." isDark={isDark} />
                        </td>
                      </tr>
                    )}
                    {shipments.map((item) => (
                      <tr key={item.id} className={`align-top transition ${isDark ? 'hover:bg-white/[0.035]' : 'hover:bg-slate-50'}`}>
                        <td className="px-5 py-4 font-mono font-bold text-cyan-400">{item.reference}</td>
                        <td className="px-5 py-4">
                          <input
                            className={inputClass}
                            defaultValue={item.client_name}
                            onBlur={(event) => {
                              const value = event.target.value.trim()
                              if (value && value !== item.client_name) updateShipment.mutate({ id: item.id, payload: { client_name: value } })
                            }}
                          />
                          <div className={`text-xs ${softMutedClass}`}>{item.notes || 'Sortie atelier'}</div>
                        </td>
                        <td className={`px-5 py-4 ${mutedClass}`}>
                          {item.expected_items} machines / {item.pallet_count} palettes
                        </td>
                        <td className={`px-5 py-4 ${mutedClass}`}>
                          <input
                            className={inputClass}
                            defaultValue={item.carrier || ''}
                            placeholder="Transporteur"
                            onBlur={(event) => {
                              const value = event.target.value.trim()
                              if (value !== (item.carrier || '')) updateShipment.mutate({ id: item.id, payload: { carrier: value || null } })
                            }}
                          />
                        </td>
                        <td className="px-5 py-4">
                          <select
                            className={inputClass}
                            value={item.status}
                            onChange={(event) => updateShipment.mutate({ id: item.id, payload: { status: event.target.value as ShipmentStatus } })}
                          >
                            <option value="draft">Brouillon</option>
                            <option value="picking">Preparation</option>
                            <option value="quality_control">Controle final</option>
                            <option value="ready_for_carrier">Pret transport</option>
                            <option value="shipped">Expedie</option>
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <ActionButton icon={Download} label="Generer BL" busy={busyAction === `bl-${item.id}`} onClick={() => void handleDownloadBl(item)} isDark={isDark} />
                            <ActionButton icon={FileSpreadsheet} label="Colisage" busy={busyAction === `packing-${item.id}`} onClick={() => void handleDownloadPackingList(item)} isDark={isDark} />
                            <ActionButton icon={Printer} label="Imprimer etiquette" busy={busyAction === `label-${item.id}`} onClick={() => void handlePrintLabel(item)} isDark={isDark} />
                            <ActionButton icon={PackagePlus} label="Ajouter palette" busy={createPallet.isPending} onClick={() => createPallet.mutate({ shipmentId: item.id, reference: `${item.reference}-PAL-${item.pallet_count + 1}` })} isDark={isDark} />
                            <ActionButton icon={PackageCheck} label="Expedier" busy={updateShipment.isPending} onClick={() => updateShipment.mutate({ id: item.id, payload: { status: 'shipped' } })} isDark={isDark} />
                            <ActionButton icon={Download} label="Supprimer" busy={deleteShipment.isPending} onClick={() => deleteShipment.mutate(item.id)} isDark={isDark} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>}
          </div>

          <aside className="space-y-6">
            {workspace === 'pallets' && <Panel className={panelClass}>
              <ModuleHeader title="Palettes" subtitle="Controle rapide des palettes reception/sortie." icon={PackagePlus} isDark={isDark} />
              <div className="space-y-3 p-5 pt-0">
                {pallets.length === 0 && <EmptyState text="Aucune palette creee pour le moment." isDark={isDark} />}
                {pallets.slice(0, 8).map((pallet) => (
                  <div key={pallet.id} className={`rounded-xl border p-3 ${tileClass}`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                        <div className={`truncate font-mono text-sm font-black ${titleClass}`}>{pallet.reference}</div>
                        <div className={`text-xs ${softMutedClass}`}>
                          {pallet.expected_items} attendu(s), {pallet.scanned_items} scanne(s) - {pallet.location || 'sans zone'}
                        </div>
                        </div>
                        <StatusBadge label={pallet.status} className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100" />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <input
                          className={inputClass}
                          defaultValue={pallet.location || ''}
                          placeholder="Zone"
                          onBlur={(event) => {
                            const value = event.target.value.trim()
                            if (value !== (pallet.location || '')) updatePallet.mutate({ id: pallet.id, payload: { location: value || null } })
                          }}
                        />
                        <input
                          className={inputClass}
                          defaultValue={pallet.expected_items}
                          type="number"
                          min={0}
                          placeholder="Attendu"
                          onBlur={(event) => {
                            const value = Number(event.target.value || 0)
                            if (value !== pallet.expected_items) updatePallet.mutate({ id: pallet.id, payload: { expected_items: value } })
                          }}
                        />
                        <input
                          className={inputClass}
                          defaultValue={pallet.scanned_items}
                          type="number"
                          min={0}
                          placeholder="Scanne"
                          onBlur={(event) => {
                            const value = Number(event.target.value || 0)
                            if (value !== pallet.scanned_items) updatePallet.mutate({ id: pallet.id, payload: { scanned_items: value } })
                          }}
                        />
                        <select
                          className={inputClass}
                          value={pallet.status}
                          onChange={(event) => updatePallet.mutate({ id: pallet.id, payload: { status: event.target.value as PalletStatus } })}
                        >
                          <option value="expected">Attendue</option>
                          <option value="in_progress">En cours</option>
                          <option value="complete">Complete</option>
                          <option value="blocked">Bloquee</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton icon={Printer} label="Imprimer" busy={busyAction === `pallet-label-${pallet.id}`} onClick={() => void handlePrintPalletLabel(pallet)} isDark={isDark} />
                        <ActionButton icon={PackageCheck} label="Complete" busy={updatePallet.isPending} onClick={() => updatePallet.mutate({ id: pallet.id, payload: { status: 'complete' } })} isDark={isDark} />
                        <ActionButton icon={Download} label="Supprimer" busy={deletePallet.isPending} onClick={() => deletePallet.mutate(pallet.id)} isDark={isDark} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>}

            {workspace === 'documents' && <Panel className={panelClass}>
              <ModuleHeader title="Documents" subtitle="Historique des BL, etiquettes et rapports generes." icon={Download} isDark={isDark} />
              <div className="space-y-3 p-5 pt-0">
                <div className="flex flex-wrap gap-2">
                  {documentFilters.map((filter) => {
                    const count = filter.value === 'all' ? documents.length : documents.filter((document) => document.document_type === filter.value).length
                    return (
                      <button
                        key={filter.value}
                        type="button"
                        onClick={() => setDocumentFilter(filter.value)}
                        className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                          documentFilter === filter.value
                            ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                            : isDark ? 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {filter.label} ({count})
                      </button>
                    )
                  })}
                </div>
                {filteredDocuments.length === 0 && <EmptyState text="Aucun document pour ce filtre." isDark={isDark} />}
                {filteredDocuments.slice(0, 10).map((document) => (
                  <div key={document.id} className={`rounded-xl border p-3 ${tileClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`truncate text-sm font-black ${titleClass}`}>{document.title}</div>
                        <div className={`mt-1 text-xs ${softMutedClass}`}>
                          {document.document_type} - {new Date(document.created_at).toLocaleString()}
                        </div>
                      </div>
                      <StatusBadge label={document.document_type} className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100" />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>}

            {workspace === 'scan' && <Panel className={panelClass}>
              <ModuleHeader title="Scan atelier" subtitle="Champ compatible douchette : scannez puis Entree." icon={ScanLine} isDark={isDark} />
              <div className="space-y-4 p-5 pt-0">
                <div className={`rounded-xl border p-3 ${tileClass}`}>
                  <div className={`text-xs font-bold uppercase tracking-[0.18em] ${softMutedClass}`}>Session active</div>
                  <div className={`mt-1 text-sm font-black ${titleClass}`}>
                    {activeSession ? `${activeSession.scanned_count} scan(s), ${activeSession.anomaly_count} anomalie(s)` : 'Aucune session ouverte'}
                  </div>
                  {activeSession && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton
                        icon={PackageCheck}
                        label={activeSession.status === 'paused' ? 'Reprendre' : 'Pause'}
                        busy={updateScanSession.isPending}
                        onClick={() => updateScanSession.mutate({ id: activeSession.id, status: activeSession.status === 'paused' ? 'open' : 'paused' })}
                        isDark={isDark}
                      />
                      <ActionButton
                        icon={PackageCheck}
                        label="Cloturer session"
                        busy={updateScanSession.isPending}
                        onClick={() => updateScanSession.mutate({ id: activeSession.id, status: 'closed' })}
                        isDark={isDark}
                      />
                    </div>
                  )}
                </div>
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const code = scanCode.trim()
                    if (code) submitScanCode.mutate(code)
                  }}
                >
                  <input
                    value={scanCode}
                    onChange={(event) => setScanCode(event.target.value)}
                    placeholder="Scanner numero de serie, QR ou code-barres"
                    className={`w-full rounded-xl border px-3 py-3 text-sm font-bold outline-none transition ${isDark ? 'border-white/10 bg-black/20 text-white placeholder:text-slate-600 focus:border-cyan-300/40' : 'border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 focus:border-cyan-400'}`}
                  />
                  <button
                    type="submit"
                    disabled={submitScanCode.isPending || !scanCode.trim()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-50"
                  >
                    <ScanLine size={16} />
                    {submitScanCode.isPending ? 'Scan...' : 'Valider scan'}
                  </button>
                </form>
                {lastLookup && (
                  <div className={`rounded-xl border p-3 ${lastLookup.found ? 'border-emerald-300/20 bg-emerald-300/10' : 'border-amber-300/20 bg-amber-300/10'}`}>
                    <div className={`text-sm font-black ${lastLookup.found ? 'text-emerald-100' : 'text-amber-100'}`}>
                      {lastLookup.found ? 'Machine trouvee' : 'Code inconnu'}
                    </div>
                    <div className="mt-1 text-xs text-slate-300">
                      {[lastLookup.brand, lastLookup.model, lastLookup.serial_number].filter(Boolean).join(' - ') || lastLookup.code}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {(scanEventsQuery.data ?? []).filter((event) => event.event_type !== 'found').length > 0 && (
                    <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3">
                      <div className="text-sm font-black text-amber-100">
                        {(scanEventsQuery.data ?? []).filter((event) => event.event_type !== 'found').length} anomalie(s) a traiter
                      </div>
                      <div className="mt-1 text-xs text-amber-100/70">
                        Codes inconnus, doublons ou mauvais lots detectes pendant le scan.
                      </div>
                    </div>
                  )}
                  {(scanEventsQuery.data ?? []).slice(0, 5).map((event) => (
                    <div key={event.id} className={`rounded-lg border px-3 py-2 text-xs ${tileClass}`}>
                      <div className={`font-mono font-black ${titleClass}`}>{event.code}</div>
                      <div className={softMutedClass}>{event.event_type} - {event.message || 'scan enregistre'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>}

            {workspace === 'inventory' && <Panel className={panelClass}>
              <ModuleHeader title="Inventaire machines" subtitle="Machines vues pendant le scan et retours audit/stock." icon={ShieldCheck} isDark={isDark} />
              <div className="space-y-3 p-5 pt-0">
                {machineLookups.length === 0 && <EmptyState text="Aucune machine en memoire. Scannez un code pour alimenter l'inventaire." isDark={isDark} />}
                {machineLookups.map((machine) => (
                  <div key={machine.code} className={`rounded-xl border p-4 ${tileClass}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            label={machine.found ? 'Trouvee' : 'Inconnue'}
                            className={machine.found ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/20 bg-amber-300/10 text-amber-100'}
                          />
                          <span className={`font-mono text-xs font-black ${softMutedClass}`}>{machine.source}</span>
                        </div>
                        <div className={`mt-2 text-lg font-black ${titleClass}`}>
                          {[machine.brand, machine.model].filter(Boolean).join(' ') || machine.code}
                        </div>
                        <div className={`mt-1 text-sm ${mutedClass}`}>
                          SN {machine.serial_number || machine.code} - Grade {machine.grade || '-'} - {machine.status || 'statut non defini'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton
                          icon={Printer}
                          label="Etiquette"
                          busy={false}
                          onClick={() => setMessage('Etiquette machine depuis ERP : a lier au moteur etiquette audit existant.')}
                          isDark={isDark}
                        />
                        <ActionButton
                          icon={Download}
                          label="Exporter"
                          busy={false}
                          onClick={() => exportRows(`atelieros-machine-${machine.code}.csv`, [{
                            code: machine.code,
                            trouve: machine.found ? 'oui' : 'non',
                            source: machine.source,
                            serie: machine.serial_number || '',
                            marque: machine.brand || '',
                            modele: machine.model || '',
                            grade: machine.grade || '',
                            statut: machine.status || '',
                          }])}
                          isDark={isDark}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>}

            {workspace === 'receptions' && <Panel className={panelClass}>
              <ModuleHeader title="Import intelligent" subtitle="Dernieres correspondances detectees par fichier fournisseur." icon={FileSpreadsheet} isDark={isDark} />
              <div className="space-y-3 p-5 pt-0">
                {lastImportPreview && (
                  <div className={`rounded-xl border p-3 ${isDark ? 'border-cyan-300/20 bg-cyan-300/10' : 'border-cyan-200 bg-cyan-50'}`}>
                    <div className={`text-sm font-black ${isDark ? 'text-cyan-100' : 'text-cyan-900'}`}>{lastImportPreview.filename}</div>
                    <div className={`mt-1 text-xs font-semibold ${isDark ? 'text-cyan-100/75' : 'text-cyan-800'}`}>
                      {lastImportPreview.row_count} ligne(s), {lastImportPreview.detected_columns.length} colonne(s), format {lastImportPreview.file_format}
                    </div>
                    {lastImportPreview.warnings.length > 0 && (
                      <div className="mt-2 text-xs font-semibold text-amber-200">
                        {lastImportPreview.warnings.join(' ')}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton
                        icon={PackageCheck}
                        label="Valider import"
                        busy={busyAction === 'commit-import'}
                        onClick={() => void commitSupplierPreview()}
                        isDark={isDark}
                      />
                      <ActionButton
                        icon={Download}
                        label="Annuler apercu"
                        busy={false}
                        onClick={() => {
                          setLastImportPreview(null)
                          setPendingImportFileName(null)
                          setMessage('Apercu import annule.')
                        }}
                        isDark={isDark}
                      />
                    </div>
                  </div>
                )}
                {latestFieldMapping.map(([source, target, confidence]) => (
                  <div key={`${source}-${target}`} className={`rounded-xl border p-3 ${tileClass}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`truncate text-sm font-bold ${titleClass}`}>{source}</span>
                      <ArrowRight className="shrink-0 text-slate-600" size={15} />
                      <span className={`truncate text-sm font-bold ${isDark ? 'text-cyan-100' : 'text-cyan-800'}`}>{target}</span>
                    </div>
                    <p className={`mt-2 text-xs ${softMutedClass}`}>{confidence}</p>
                  </div>
                ))}
              </div>
            </Panel>}

            {workspace === 'scan' && <Panel className={panelClass}>
              <ModuleHeader title="Terminaux atelier" subtitle="PDA, tablettes et scanners prevus pour les techniciens." icon={Smartphone} isDark={isDark} />
              <div className="space-y-3 p-5 pt-0">
                {terminals.map((terminal) => (
                  <div key={terminal.name} className={`flex items-center gap-3 rounded-xl border p-3 ${tileClass}`}>
                    <div className={`grid h-10 w-10 place-items-center rounded-xl border ${subtleTileClass} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      <terminal.icon size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-black ${titleClass}`}>{terminal.name}</p>
                      <p className={`truncate text-xs ${softMutedClass}`}>{terminal.type}</p>
                    </div>
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-bold text-emerald-100">
                      {terminal.state}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>}

            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-amber-200" size={20} />
                <div>
                  <h2 className="font-black text-amber-50">Connecte au backend</h2>
                  <p className="mt-2 text-sm leading-6 text-amber-50/75">
                    Les donnees de demonstration sont supprimees. La prochaine couche sera l edition detaillee des clients, palettes et statuts.
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
  isDark,
}: {
  label: string
  value: string
  icon: typeof ClipboardList
  tone: 'blue' | 'slate' | 'emerald' | 'amber'
  isDark: boolean
}) {
  const tones = {
    blue: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
    slate: 'border-slate-300/20 bg-white/[0.055] text-slate-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-white/10 bg-white/[0.045] shadow-black/30' : 'border-slate-200 bg-white shadow-slate-200/80'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className={`mt-2 text-3xl font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{value}</p>
        </div>
        <div className={`rounded-xl border p-2 ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function Panel({ children, className }: { children: ReactNode; className: string }) {
  return <div className={`overflow-hidden rounded-2xl border shadow-2xl ${className}`}>{children}</div>
}

function ModuleHeader({
  title,
  subtitle,
  action,
  icon: Icon,
  isDark,
  onAction,
  actionBusy = false,
}: {
  title: string
  subtitle: string
  action?: string
  icon: typeof ClipboardList
  isDark: boolean
  onAction?: () => void
  actionBusy?: boolean
}) {
  return (
    <div className={`flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <Icon size={19} />
        </div>
        <div>
          <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          disabled={actionBusy}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/[0.07]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {actionBusy ? 'Creation...' : action}
        </button>
      )}
    </div>
  )
}

function ProgressBlock({ current, total, isDark }: { current: number; total: number; isDark: boolean }) {
  const percent = Math.min(100, Math.round((current / total) * 100))

  return (
    <div className="w-full shrink-0 lg:w-72">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Scan</span>
        <span className={`font-mono font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{percent}%</span>
      </div>
      <div className={`mt-2 h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
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

function InfoPill({ icon: Icon, label, isDark }: { icon: typeof MapPin; label: string; isDark: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 ${isDark ? 'border-white/10 bg-white/[0.055]' : 'border-slate-200 bg-slate-50'}`}>
      <Icon size={13} />
      {label}
    </span>
  )
}

function ActionButton({
  icon: Icon,
  label,
  busy,
  onClick,
  isDark,
}: {
  icon: typeof Download
  label: string
  busy: boolean
  onClick: () => void
  isDark: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition disabled:opacity-50 ${isDark ? 'border-white/10 bg-white/[0.055] text-slate-100 hover:bg-white/[0.08]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
    >
      <Icon size={14} />
      {busy ? '...' : label}
    </button>
  )
}

function EmptyState({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <div className={`p-6 text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
      {text}
    </div>
  )
}
