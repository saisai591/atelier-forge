import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import {
  Activity,
  BookOpen,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Copy,
  Cpu,
  Database,
  ClipboardCheck,
  Download,
  FileText,
  Gauge,
  HardDrive,
  Layers3,
  Menu,
  Network,
  RadioTower,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Smartphone,
  Printer,
  TestTube2,
  Terminal,
  Trash2,
  X,
  Zap,
} from 'lucide-react'

type DeploymentStatus = 'waiting' | 'pxe' | 'transfer' | 'finalizing' | 'success' | 'failed'
type NavigationSection = 'dashboard' | 'deployments' | 'audit' | 'boot' | 'images' | 'drivers' | 'tools' | 'guide' | 'logs' | 'settings'
type InterfaceMode = 'beginner' | 'expert'

interface GlobalSearchResult {
  id: string
  title: string
  subtitle: string
  section: NavigationSection
  badge: string
  keywords: string
}

interface DashboardMetric {
  id: string
  label: string
  value: string
  detail: string
  trend: string
  tone: 'cyan' | 'emerald' | 'amber' | 'rose'
}

interface ActiveDeployment {
  id: string
  hostname: string
  macAddress: string
  ipAddress: string
  bootMode: 'UEFI x64' | 'UEFI IA32' | 'Legacy BIOS'
  imageName: string
  status: DeploymentStatus
  progress: number
  throughputMbps: number
  lastEvent: string
}

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'success' | 'warn' | 'error'
  source: string
  message: string
}

interface AOSDeployDashboardProps {
  metrics?: DashboardMetric[]
  deployments?: ActiveDeployment[]
  logs?: LogEntry[]
  isLoading?: boolean
  onRefresh?: () => void
}

interface ForgePxeAsset {
  key: string
  label: string
  status: string
  detail: string
  url: string | null
}

interface ForgePxeClient {
  id: string
  hostname: string | null
  ip: string | null
  mac: string | null
  serial_number: string | null
  brand: string | null
  model: string | null
  state: string
  boot_mode: string | null
  current_task: string | null
  progress: number | null
  last_seen: string | null
  capabilities: string[]
}

interface ForgePxeServiceCheck {
  key: string
  label: string
  status: 'online' | 'offline' | string
  detail: string
  endpoint: string
}

interface ForgePxeStatus {
  server_ip: string
  server_url: string
  smb_share: string
  mode: string
  diagnostic: string
  assets: ForgePxeAsset[]
  services: ForgePxeServiceCheck[]
  clients: ForgePxeClient[]
}

interface ForgePxeConfig {
  server_ip: string
  server_url: string
  smb_share: string
  mode: 'proxy DHCP' | 'standalone DHCP' | 'DHCP principal atelier'
  tftp_port: number
  http_port: number
  dhcp_proxy_port: number
  winpe_ready: boolean
}

interface ForgePxeAuditDisk {
  text: string | null
  model: string | null
  serial_number: string | null
  size_gb: number | null
  type: string | null
  smart: string | null
}

interface ForgePxeAuditBattery {
  name: string | null
  status: string | null
  health_percent: number | null
  wear_percent: number | null
  cycle_count: string | null
  label: string | null
}

interface ForgePxeAuditSummary {
  id: string
  filename: string
  created_at: string | null
  updated_at: string
  serial_number: string | null
  hostname: string | null
  brand: string | null
  model: string | null
  cpu: string | null
  ram: string | null
  ram_mb: number | null
  main_disk: string | null
  battery_status: string | null
  grade_proposed: string | null
  ip: string | null
  mac: string | null
  usb_ports_detected: number | null
  disks: ForgePxeAuditDisk[]
  battery: ForgePxeAuditBattery[]
  label_lines: string[]
  raw: Record<string, unknown>
}

interface ForgePxeAuditPruneResponse {
  dry_run: boolean
  keep_latest: number
  candidates: number
  deleted_files: string[]
  message: string
}

interface ForgeWimRecipe {
  id: string
  name: string
  windows_iso_path: string
  work_dir: string
  output_wim_path: string
  image_index: number
  driver_path: string
  include_drivers: boolean
  enable_dotnet35: boolean
  enable_powershell: boolean
  cleanup_image: boolean
  created_at: string
}

interface ForgeWimImage {
  id: string
  name: string
  version: string
  architecture: string
  path: string
  size_gb: number | null
  source: string
  notes: string | null
  status: string
  is_default: boolean
  created_at: string
}

interface ForgeDriverPack {
  id: string
  name: string
  vendor: string
  model_family: string
  category: 'storage' | 'network' | 'chipset' | 'graphics' | 'other'
  path: string
  architecture: string
  windows_version: string
  critical: boolean
  notes: string | null
  source_audit_id: string | null
  status: string
  created_at: string
}

interface ForgeRemoteActionResponse {
  accepted: boolean
  client_id: string
  action: string
  delivery: string
  message: string
}

interface ForgeUnattendProfile {
  id: string
  name: string
  locale: string
  keyboard: string
  timezone: string
  computer_name: string
  admin_username: string
  admin_password: string
  organization: string
  product_key: string | null
  deployment_mode: 'standard' | 'marketplace' | string
  accept_eula: boolean
  skip_oobe: boolean
  enable_rdp: boolean
  auto_logon: boolean
  create_local_account: boolean
  include_drivers: boolean
  run_first_logon_command: string | null
  is_default: boolean
  created_at: string
}

interface ForgeDeploymentProfile {
  id: string
  name: string
  description: string | null
  image_id: string
  image_name: string | null
  unattend_profile_id: string | null
  unattend_name: string | null
  driver_pack_ids: string[]
  driver_pack_names: string[]
  deployment_mode: 'standard' | 'marketplace' | 'custom' | string
  enabled: boolean
  is_default: boolean
  created_at: string
}

interface ForgeDriverPrepareResponse {
  pack: ForgeDriverPack
  created: boolean
  driver_store_path: string
  smb_path: string
  message: string
}

interface ForgeDriverExtractResponse {
  pack: ForgeDriverPack
  extracted_path: string
  inf_count: number
  message: string
}

interface ForgeMediaUploadResponse {
  kind: 'iso' | 'image' | string
  filename: string
  size: number
  path: string
  smb_path: string
  image: ForgeWimImage | null
  message: string
}

interface ForgeMediaStatusResponse {
  filename: string
  kind: 'iso' | 'image' | string
  destination: string
  exists: boolean
  size: number | null
  modified_at: string | null
  message: string
}

interface ForgeServerMediaFile {
  filename: string
  kind: 'iso' | 'image' | 'incoming' | string
  folder: string
  server_path: string
  smb_path: string
  size: number
  size_gb: number
  modified_at: string
}

interface ForgeServerMediaListResponse {
  files: ForgeServerMediaFile[]
  total: number
  message: string
}

interface ForgeExternalMediaSource {
  id: string
  label: string
  source_type: string
  host: string | null
  path: string
  filename: string | null
  size: number | null
  size_gb: number | null
  modified_at: string | null
  copy_hint: string
  message: string
}

interface ForgeExternalMediaSourceListResponse {
  sources: ForgeExternalMediaSource[]
  total: number
  message: string
}

interface ForgeExternalMediaImportResponse {
  imported: boolean
  source: ForgeExternalMediaSource
  destination: string | null
  smb_path: string | null
  command: string | null
  message: string
}

interface ForgeServerMediaDeleteResponse {
  deleted: boolean
  filename: string
  kind: string
  folder: string
  message: string
}

interface ForgeServerMediaChecksumResponse {
  filename: string
  kind: string
  folder: string
  size: number
  sha256: string
  message: string
}

interface ForgeApplianceBackup {
  filename: string
  path: string
  size: number
  size_mb: number
  created_at: string
}

interface ForgeApplianceBackupResponse {
  backup: ForgeApplianceBackup
  included: string[]
  message: string
}

interface ForgeApplianceBackupListResponse {
  backups: ForgeApplianceBackup[]
  total: number
  message: string
}

interface ForgeApplianceBackupDeleteResponse {
  deleted: boolean
  filename: string
  message: string
}

interface ForgeApplianceRestoreResponse {
  backup: ForgeApplianceBackup
  dry_run: boolean
  restored: string[]
  skipped: string[]
  message: string
}

interface ForgeWimBuildResponse {
  id: string
  reference: string
  version: string
  source_image: ForgeWimImage | null
  source_path: string
  server_path: string
  smb_path: string
  output_wim: string
  output_smb_path: string
  manifest_path: string
  script_path: string
  status: string
  progress: number
  log_path: string
  message: string
}

interface ForgeWimBuildSummary {
  id: string
  reference: string
  version: string
  source_name: string
  server_path: string
  smb_path: string
  status: string
  progress: number
  log_path: string
  output_smb_path: string
  manifest_path: string
  script_path: string
  created_at: string
}

interface ForgeWimBuildListResponse {
  builds: ForgeWimBuildSummary[]
  total: number
  message: string
}

interface ForgeWimIndex {
  index: number
  name: string
  description: string | null
  architecture: string | null
}

interface ForgeWimIndexListResponse {
  source_path: string
  source_type: string
  indexes: ForgeWimIndex[]
  message: string
}

interface ForgeNetworkResyncResponse {
  server_ip: string
  server_url: string
  smb_share: string
  restarted_services: string[]
  message: string
}

interface ForgeNetworkDiagnosticResponse {
  configured_ip: string
  detected_ip: string
  ip_matches: boolean
  dhcp_mode: string
  dhcp_mode_detail: string
  server_url: string
  smb_share: string
  deploy_dirs: Record<string, boolean>
  services: ForgePxeServiceCheck[]
  recommendation: string
  message: string
}

interface ForgeSystemReportResponse {
  generated_at: string
  pxe_config: ForgePxeConfig
  network: ForgeNetworkDiagnosticResponse
  reliability_score: number
  readiness_level: string
  checks: ForgePxeServiceCheck[]
  storage_total_gb: number
  storage_free_gb: number
  storage_used_percent: number
  media_total: number
  wim_images_total: number
  wim_recipes_total: number
  wim_builds_total: number
  driver_packs_total: number
  unattend_profiles_total: number
  audits_total_visible: number
  backups_total: number
  recommendations: string[]
  message: string
}

interface ForgeUsbKitResponse {
  filename: string
  profile: string
  path: string
  smb_path: string
  size: number
  size_mb: number
  included: string[]
  message: string
}

interface ForgeUsbKitListResponse {
  kits: ForgeUsbKitResponse[]
  total: number
  message: string
}

interface ForgeUsbKitDeleteResponse {
  deleted: boolean
  filename: string
  message: string
}

interface HealthStatus {
  status: string
  app: string
}

const defaultMetrics: DashboardMetric[] = [
  {
    id: 'servers',
    label: 'Services reseau',
    value: '--',
    detail: 'Connexion API en attente',
    trend: 'non synchronise',
    tone: 'amber',
  },
  {
    id: 'assets',
    label: 'Assets PXE',
    value: '--',
    detail: 'Lecture serveur requise',
    trend: 'non synchronise',
    tone: 'amber',
  },
  {
    id: 'clients',
    label: 'Machines connues',
    value: '00',
    detail: 'Aucune donnee locale',
    trend: 'attente PXE',
    tone: 'cyan',
  },
  {
    id: 'alerts',
    label: 'Alertes',
    value: '00',
    detail: 'Aucune alerte locale',
    trend: 'attente API',
    tone: 'amber',
  },
]

const defaultDeployments: ActiveDeployment[] = []

const defaultLogs: LogEntry[] = []

const DEMO_CREDENTIALS = {
  email: 'demo@forge.fr',
  password: 'Demo1234!',
}

function resolveApiBase() {
  if (typeof window === 'undefined') return '/api'
  const viteApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
  if (viteApiUrl) return `${viteApiUrl}/api`
  if (window.location.port !== '5173') return '/api'
  return `http://${window.location.hostname}:8000/api`
}

function resolveUploadApiBase() {
  if (typeof window === 'undefined') return '/api'
  const viteApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
  if (viteApiUrl) return `${viteApiUrl}/api`
  return `http://${window.location.hostname}:8000/api`
}

function describeUploadFailure(xhr: XMLHttpRequest) {
  const status = `${xhr.status || 'reseau'} ${xhr.statusText || ''}`.trim()
  const raw = xhr.responseText?.trim()
  if (!raw) return `${status}: aucune reponse du serveur`
  if (raw.startsWith('<!DOCTYPE') || raw.startsWith('<html')) {
    return `${status}: le dashboard a repondu a la place de l API. Recharge la page puis relance l upload.`
  }
  try {
    const parsed = JSON.parse(raw) as { detail?: string; message?: string }
    return `${status}: ${parsed.detail || parsed.message || raw.slice(0, 500)}`
  } catch {
    return `${status}: ${raw.slice(0, 500)}`
  }
}

async function requestJson<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

async function requestText(path: string, token?: string): Promise<string> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.text()
}

async function requestMediaStatus(
  filename: string,
  kind: 'iso' | 'image' | string | null,
  token: string,
): Promise<ForgeMediaStatusResponse> {
  const query = new URLSearchParams({ filename })
  if (kind) {
    query.set('kind', kind)
  }
  return requestJson<ForgeMediaStatusResponse>(`/forge/pxe/media/status?${query.toString()}`, token)
}

async function getDemoToken() {
  const data = await requestJson<{ access_token: string }>('/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify(DEMO_CREDENTIALS),
  })
  return data.access_token
}

function clientName(client: ForgePxeClient) {
  const model = [client.brand, client.model].filter(Boolean).join(' ').trim()
  return model || client.hostname || client.serial_number || client.mac || client.id
}

function statusFromClient(client: ForgePxeClient): DeploymentStatus {
  const state = `${client.state} ${client.current_task ?? ''}`.toLowerCase()
  if (state.includes('erreur') || state.includes('failed')) return 'failed'
  if (state.includes('effacement') || state.includes('certifi')) return 'success'
  if (state.includes('final')) return 'finalizing'
  if (state.includes('boot') || state.includes('pxe')) return 'pxe'
  if (state.includes('transfer') || state.includes('image')) return 'transfer'
  if ((client.progress ?? 0) >= 100) return 'success'
  return 'waiting'
}

function mapClientToDeployment(client: ForgePxeClient): ActiveDeployment {
  const status = statusFromClient(client)
  return {
    id: client.id,
    hostname: clientName(client),
    macAddress: client.mac || 'MAC inconnue',
    ipAddress: client.ip || 'IP inconnue',
    bootMode: client.boot_mode?.includes('Legacy') ? 'Legacy BIOS' : 'UEFI x64',
    imageName: client.current_task || 'Pipeline PXE / Windows',
    status,
    progress: client.progress ?? (status === 'success' ? 100 : 0),
    throughputMbps: status === 'transfer' ? 640 : status === 'pxe' ? 120 : 0,
    lastEvent: client.state || 'En attente agent',
  }
}

function metricsFromStatus(status: ForgePxeStatus | null, health: HealthStatus | null): DashboardMetric[] {
  if (!status) return defaultMetrics
  const readyAssets = status.assets.filter((asset) => asset.status === 'ready').length
  const missingAssets = status.assets.filter((asset) => asset.status !== 'ready').length
  const serviceChecks = status.services ?? []
  const onlineServices = serviceChecks.filter((service) => service.status === 'online').length
  const offlineServices = serviceChecks.length - onlineServices
  const completed = status.clients.filter((client) => statusFromClient(client) === 'success').length
  const successRate = status.clients.length ? Math.round((completed / status.clients.length) * 100) : 100
  return [
    {
      id: 'servers',
      label: 'Services reseau',
      value: serviceChecks.length ? `${onlineServices}/${serviceChecks.length}` : health?.status === 'ok' ? 'OK' : 'KO',
      detail: health?.app || 'API AOS',
      trend: status.mode,
      tone: offlineServices ? 'rose' : 'emerald',
    },
    {
      id: 'assets',
      label: 'Assets PXE',
      value: `${readyAssets}/${status.assets.length}`,
      detail: status.diagnostic,
      trend: missingAssets ? `${missingAssets} manquant` : 'pret',
      tone: missingAssets ? 'amber' : 'emerald',
    },
    {
      id: 'clients',
      label: 'Machines connues',
      value: String(status.clients.length).padStart(2, '0'),
      detail: status.smb_share,
      trend: status.server_ip,
      tone: 'cyan',
    },
    {
      id: 'success',
      label: 'Taux de succes',
      value: `${successRate}%`,
      detail: 'clients termines ou certifies',
      trend: `${completed}/${status.clients.length || 0}`,
      tone: 'emerald',
    },
  ]
}

function logsFromStatus(status: ForgePxeStatus | null, apiError: string | null): LogEntry[] {
  const now = new Date().toLocaleTimeString('fr-FR', { hour12: false })
  if (apiError) {
    return [{ id: 'api-error', timestamp: now, level: 'error', source: 'frontend', message: apiError }]
  }
  if (!status) return defaultLogs
  return [
    { id: 'health', timestamp: now, level: 'success', source: 'api', message: `PXE status recu depuis ${status.server_ip}` },
    ...(status.services ?? []).map((service) => ({
      id: `service-${service.key}`,
      timestamp: now,
      level: service.status === 'online' ? 'success' as const : 'error' as const,
      source: 'service',
      message: `${service.label}: ${service.status} (${service.endpoint})`,
    })),
    ...status.assets.map((asset, index) => ({
      id: `asset-${asset.key}`,
      timestamp: now,
      level: asset.status === 'ready' ? 'success' as const : 'warn' as const,
      source: 'asset',
      message: `${index + 1}. ${asset.label}: ${asset.detail}`,
    })),
    ...status.clients.slice(0, 8).map((client) => ({
      id: `client-${client.id}`,
      timestamp: client.last_seen?.slice(11, 19) || now,
      level: statusFromClient(client) === 'failed' ? 'error' as const : 'info' as const,
      source: 'client',
      message: `${clientName(client)} - ${client.ip || 'IP inconnue'} - ${client.state}`,
    })),
  ]
}

const navigation: Array<{ id: NavigationSection; label: string; icon: typeof Gauge }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'deployments', label: 'Deploiements', icon: Layers3 },
  { id: 'audit', label: 'Audit', icon: ClipboardCheck },
  { id: 'boot', label: 'Boot UEFI', icon: Cpu },
  { id: 'images', label: 'Images WIM', icon: Database },
  { id: 'drivers', label: 'Pilotes', icon: HardDrive },
  { id: 'tools', label: 'Outils', icon: TestTube2 },
  { id: 'guide', label: 'Guide', icon: BookOpen },
  { id: 'logs', label: 'Logs', icon: Terminal },
  { id: 'settings', label: 'Parametres', icon: Settings },
]

const beginnerSections: NavigationSection[] = ['dashboard', 'audit', 'images', 'drivers', 'deployments', 'tools', 'guide']

function navigationForMode(mode: InterfaceMode) {
  return mode === 'expert' ? navigation : navigation.filter((item) => beginnerSections.includes(item.id))
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function downloadCsvFile(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function systemReportSupportText(report: ForgeSystemReportResponse) {
  const generatedAt = new Date(report.generated_at).toLocaleString('fr-FR')
  const services = report.network.services
    .map((service) => `${service.label}: ${service.status}`)
    .join(', ')
  const checks = report.checks
    .map((check) => `${check.label}: ${check.status} - ${check.detail}`)
    .join('\n')
  return [
    `AtelierOS - rapport support (${generatedAt})`,
    `Score fiabilite: ${report.reliability_score}% (${report.readiness_level})`,
    `Mode PXE: ${report.pxe_config.mode}`,
    `IP configuree: ${report.network.configured_ip || 'non definie'}`,
    `IP detectee: ${report.network.detected_ip || 'non detectee'}`,
    `Services: ${services || 'aucun service remonte'}`,
    `Stockage: ${report.storage_free_gb} GB libres / ${report.storage_total_gb} GB (${report.storage_used_percent}% utilise)`,
    `Medias: ${report.media_total} | Images: ${report.wim_images_total} | WIM procedures: ${report.wim_builds_total}`,
    `Pilotes: ${report.driver_packs_total} | Audits visibles: ${report.audits_total_visible} | Sauvegardes: ${report.backups_total}`,
    `Recommandations: ${report.recommendations.join(' / ') || 'aucune'}`,
    '',
    'Controles detailles:',
    checks || 'aucun controle detaille',
  ].join('\n')
}

const statusLabels: Record<DeploymentStatus, string> = {
  waiting: 'En attente',
  pxe: 'Boot PXE',
  transfer: "Transfert d'image",
  finalizing: 'Finalisation',
  success: 'Reussi',
  failed: 'Erreur',
}

const statusStyles: Record<DeploymentStatus, string> = {
  waiting: 'border-amber-300/30 bg-amber-400/10 text-amber-200 shadow-amber-500/10',
  pxe: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-200 shadow-cyan-500/10',
  transfer: 'border-blue-300/30 bg-blue-400/10 text-blue-200 shadow-blue-500/10',
  finalizing: 'border-violet-300/30 bg-violet-400/10 text-violet-200 shadow-violet-500/10',
  success: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200 shadow-emerald-500/10',
  failed: 'border-rose-300/30 bg-rose-400/10 text-rose-200 shadow-rose-500/10',
}

const metricGlow: Record<DashboardMetric['tone'], string> = {
  cyan: 'from-cyan-400/25 to-blue-500/5 text-cyan-200',
  emerald: 'from-emerald-400/25 to-teal-500/5 text-emerald-200',
  amber: 'from-amber-400/25 to-orange-500/5 text-amber-200',
  rose: 'from-rose-400/25 to-red-500/5 text-rose-200',
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function Sidebar({
  activeSection,
  onNavigate,
  items,
  status,
  open = true,
  onClose,
}: {
  activeSection: NavigationSection
  onNavigate: (sectionId: NavigationSection) => void
  items: Array<{ id: NavigationSection; label: string; icon: typeof Gauge }>
  status: ForgePxeStatus | null
  open?: boolean
  onClose?: () => void
}) {
  const serviceOnline = (needle: string) => {
    const service = status?.services.find((item) => `${item.key} ${item.label}`.toLowerCase().includes(needle))
    return service?.status === 'online'
  }
  const winpeReady = status?.assets.some((asset) => asset.key === 'winpe' && asset.status === 'ready') ?? false
  const clusterLights = [
    { label: 'API', online: serviceOnline('api') },
    { label: 'HTTP', online: serviceOnline('http') },
    { label: 'SMB', online: serviceOnline('smb') || serviceOnline('partage') },
    { label: 'WinPE', online: winpeReady },
  ]
  const allClusterOnline = clusterLights.every((item) => item.online)

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex min-h-screen w-[min(18rem,86vw)] shrink-0 flex-col border-r border-white/10 bg-[#07090d]/98 px-4 py-5 shadow-2xl shadow-black/40 transition-transform duration-300 lg:sticky lg:top-0 lg:z-20 lg:w-72 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-gradient-to-br from-slate-700 via-slate-950 to-cyan-950 shadow-lg shadow-cyan-500/15">
            <Zap className="h-5 w-5 text-cyan-200" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 sm:text-sm">AtelierOS</div>
            <div className="text-lg font-bold tracking-tight text-white">AtelierOS</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-300 lg:hidden"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 overflow-y-auto pr-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onNavigate(item.id)
                  onClose?.()
                }}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition duration-200',
                  isActive
                    ? 'border-cyan-300/20 bg-cyan-300/10 text-white shadow-lg shadow-cyan-500/10'
                    : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.045] hover:text-slate-100',
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.045] text-slate-300 transition group-hover:bg-cyan-300/10 group-hover:text-cyan-200">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight className="ml-auto h-4 w-4 text-cyan-200" />}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl sm:block">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Services actifs</span>
            <span className={cn('h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]', allClusterOnline ? 'bg-emerald-300 text-emerald-300' : 'bg-amber-300 text-amber-300')} />
          </div>
          <div className="text-sm font-semibold text-white">{status?.server_ip || 'Serveur non synchronise'}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-cyan-200">{status?.smb_share || '\\\\serveur\\deploy'}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {clusterLights.map((light) => (
              <div key={light.label} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                <span className={cn('h-2 w-2 shrink-0 rounded-full shadow-[0_0_12px_currentColor]', light.online ? 'bg-emerald-300 text-emerald-300' : 'bg-rose-300 text-rose-300')} />
                <span className="text-[11px] font-semibold text-slate-300">{light.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs leading-5 text-slate-400">
            {allClusterOnline ? 'Serveur pret pour audit, drivers et WinPE.' : 'Verifier les voyants rouges avant de lancer un deploiement.'}
          </div>
        </div>
      </aside>
    </>
  )
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/25 backdrop-blur-xl">
      <div className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r via-white/40', metricGlow[metric.tone])} />
      <div className={cn('absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br blur-3xl', metricGlow[metric.tone])} />
      <div className="relative">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{metric.label}</div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="text-3xl font-semibold tracking-tight text-white">{metric.value}</div>
          <div className={cn('rounded-full border border-current/20 px-2.5 py-1 text-xs font-semibold', metricGlow[metric.tone])}>
            {metric.trend}
          </div>
        </div>
        <div className="mt-3 text-sm text-slate-400">{metric.detail}</div>
      </div>
    </section>
  )
}

function PageTitle({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: typeof Gauge
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-lg shadow-cyan-500/10">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  )
}

function ApiErrorBanner({
  message,
  isLoading,
  onRetry,
}: {
  message: string
  isLoading: boolean
  onRetry: () => void
}) {
  const apiBase = resolveApiBase()
  const isLocalDev = typeof window !== 'undefined' && window.location.port === '5173'
  const isLocalApi = isLocalDev && apiBase.includes('localhost:8000')
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="font-semibold text-amber-50">API momentanement indisponible ou session invalide</div>
          <div className="mt-1 text-amber-100/85">{message}. Les donnees affichees peuvent etre incompletes.</div>
          <div className="mt-2 font-mono text-xs text-amber-100/75">{apiBase}</div>
          {isLocalApi ? (
            <div className="mt-3 rounded-xl border border-amber-200/20 bg-black/20 p-3 text-xs leading-5 text-amber-50/90">
              <div className="font-semibold">Mode local detecte: le frontend cherche une API sur ce PC.</div>
              <div>Si l'appliance Proxmox repond sur 192.168.1.57, relancer Vite avec:</div>
              <div className="mt-1 font-mono text-amber-100">$env:VITE_API_URL='http://192.168.1.57:8000'; npm run dev -- --host 0.0.0.0</div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={isLoading}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-200/25 bg-black/20 px-4 py-2.5 text-xs font-semibold text-amber-50 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Resynchroniser
        </button>
      </div>
    </div>
  )
}

function WorkspaceModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <section className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#070a11] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-cyan-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
      </section>
    </div>
  )
}

function ActionTile({
  title,
  detail,
  value,
  icon: Icon,
  tone = 'cyan',
  onClick,
}: {
  title: string
  detail: string
  value: string
  icon: typeof Gauge
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose'
  onClick: () => void
}) {
  const toneClass = {
    cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-cyan-500/10',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200 shadow-emerald-500/10',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-200 shadow-amber-500/10',
    rose: 'border-rose-300/20 bg-rose-300/10 text-rose-200 shadow-rose-500/10',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-[118px] rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-slate-900/90"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={cn('grid h-11 w-11 place-items-center rounded-xl border shadow-lg', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 font-mono text-xs text-slate-300">{value}</span>
      </div>
      <div className="mt-4 text-base font-semibold text-white">{title}</div>
      <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-400">{detail}</div>
    </button>
  )
}

function DashboardCounter({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'cyan' | 'emerald' | 'amber' | 'rose'
}) {
  const toneClass = {
    cyan: 'text-cyan-100',
    emerald: 'text-emerald-100',
    amber: 'text-amber-100',
    rose: 'text-rose-100',
  }[tone]

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={cn('mt-1 font-mono text-xl font-semibold', toneClass)}>{value}</div>
    </div>
  )
}

function DashboardNotice({
  title,
  detail,
  tone,
}: {
  title: string
  detail: string
  tone: 'emerald' | 'amber' | 'rose'
}) {
  const dotClass = {
    emerald: 'bg-emerald-300 text-emerald-300',
    amber: 'bg-amber-300 text-amber-300',
    rose: 'bg-rose-300 text-rose-300',
  }[tone]

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full shadow-[0_0_12px_currentColor]', dotClass)} />
        <div className="truncate text-sm font-semibold text-white">{title}</div>
      </div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{detail}</div>
    </div>
  )
}

function DashboardModule({
  mode,
  status,
  systemReport,
  successRate,
  deployments,
  logs,
  isNetworkResyncing,
  networkMessage,
  onResyncNetwork,
  onNavigate,
}: {
  mode: InterfaceMode
  status: ForgePxeStatus | null
  systemReport: ForgeSystemReportResponse | null
  metrics: DashboardMetric[]
  successRate: number
  lastSync: string
  deployments: ActiveDeployment[]
  logs: LogEntry[]
  isNetworkResyncing: boolean
  networkMessage: string | null
  onResyncNetwork: () => Promise<void>
  onNavigate: (sectionId: NavigationSection) => void
}) {
  const beginnerMode = mode === 'beginner'
  const activeDeployments = deployments.filter((item) => !['success', 'failed'].includes(item.status)).length
  const failedDeployments = deployments.filter((item) => item.status === 'failed').length
  const warningLogs = logs.filter((log) => ['warn', 'error'].includes(log.level)).slice(0, 3)
  const offlineServices = status?.services.filter((service) => service.status !== 'online') ?? []
  const offlineReportChecks = systemReport?.checks.filter((check) => check.status !== 'online') ?? []
  const defaultImageMissing = offlineReportChecks.some((check) => check.key === 'default-image')
  const firstBlockingCheck = offlineReportChecks[0]
  const reliabilityScore = systemReport?.reliability_score ?? null
  const readinessLevel = systemReport?.readiness_level ?? 'non calcule'
  const winpeAsset = status?.assets.find((asset) => asset.key === 'winpe')
  const readyAssets = status?.assets.filter((asset) => asset.status === 'ready').length ?? 0
  const totalAssets = status?.assets.length ?? 0
  const lanEndpoint = status?.server_url || (status?.server_ip ? `http://${status.server_ip}/` : 'Non synchronise')
  const pxeEndpoint = status?.smb_share || '\\\\192.168.50.2\\deploy'
  const networkBlocked = !status?.server_ip || offlineServices.length > 0
  const winpeBlocked = Boolean(winpeAsset && winpeAsset.status !== 'ready')
  const globalState = networkBlocked || failedDeployments || winpeBlocked || defaultImageMissing
    ? { label: 'Bloque', detail: 'Une action est necessaire avant production.', tone: 'amber' as const }
    : activeDeployments
      ? { label: 'En cours', detail: 'Des machines travaillent deja.', tone: 'cyan' as const }
      : { label: 'Pret atelier', detail: 'Serveur pret pour audit ou deploiement.', tone: 'emerald' as const }
  const nextAction = (() => {
    if (!status) return { title: 'Synchroniser le serveur', detail: 'Le dashboard attend les informations de la VM AOS.', target: 'settings' as NavigationSection, tone: 'amber' as const }
    if (offlineServices.length) return { title: 'Corriger les services', detail: `${offlineServices[0].label} est a verifier avant un test PXE fiable.`, target: 'settings' as NavigationSection, tone: 'amber' as const }
    if (defaultImageMissing) return { title: 'Importer Windows', detail: 'Aucune image Windows par defaut. Depose une ISO/WIM puis declare-la dans Images WIM.', target: 'images' as NavigationSection, tone: 'amber' as const }
    if (winpeAsset && winpeAsset.status !== 'ready') return { title: 'Preparer WinPE', detail: 'WinPE manque ou n est pas pret pour les tests et deploiements.', target: 'images' as NavigationSection, tone: 'amber' as const }
    if (failedDeployments) return { title: 'Traiter les erreurs', detail: 'Ouvre les deploiements pour relancer ou diagnostiquer les machines en echec.', target: 'deployments' as NavigationSection, tone: 'rose' as const }
    if (activeDeployments) return { title: 'Suivre les deploiements', detail: 'Des machines travaillent deja. Surveille la progression avant de relancer.', target: 'deployments' as NavigationSection, tone: 'cyan' as const }
    return { title: 'Lancer un audit', detail: 'Base saine. Demarre un PC en PXE puis lance Audit rapide.', target: 'audit' as NavigationSection, tone: 'emerald' as const }
  })()
  const readiness = [
    { label: 'Services', value: `${Math.max(0, (status?.services.length ?? 0) - offlineServices.length)}/${status?.services.length ?? 0}`, ok: Boolean(status?.services.length) && offlineServices.length === 0 },
    { label: 'Assets PXE', value: `${readyAssets}/${totalAssets || 0}`, ok: totalAssets > 0 && readyAssets >= Math.max(1, totalAssets - 1) },
    { label: 'WinPE', value: winpeAsset?.status === 'ready' ? 'Pret' : 'A faire', ok: winpeAsset?.status === 'ready' },
    { label: 'Image', value: defaultImageMissing ? 'A importer' : 'OK', ok: !defaultImageMissing },
    { label: 'Reseau', value: status?.server_ip || 'Non detecte', ok: Boolean(status?.server_ip) },
  ]
  const compactChecks = [
    { label: 'Reseau', detail: status?.server_ip ? `IP ${status.server_ip}` : 'IP non detectee', ok: Boolean(status?.server_ip), action: 'Reparer reseau' },
    { label: 'PXE/SMB', detail: offlineServices.length ? `${offlineServices.length} service(s) a verifier` : 'Services verts', ok: offlineServices.length === 0 && Boolean(status?.services.length), action: 'Voir services' },
    { label: 'Image', detail: defaultImageMissing ? 'Importer ISO/WIM' : 'Image par defaut OK', ok: !defaultImageMissing, action: 'Ouvrir Images' },
    { label: 'Retours', detail: warningLogs.length ? `${warningLogs.length} alerte(s) log` : 'Logs stables', ok: warningLogs.length === 0, action: 'Voir logs' },
  ]
  const primaryActions = [
    {
      title: 'Auditer',
      detail: 'Retour machine, tests atelier et etiquette.',
      value: 'Audit',
      icon: ClipboardCheck,
      tone: 'emerald' as const,
      target: 'audit' as const,
    },
    {
      title: 'Deployer',
      detail: 'Suivre les machines PXE en cours.',
      value: `${activeDeployments} actifs`,
      icon: Layers3,
      tone: 'cyan' as const,
      target: 'deployments' as const,
    },
    {
      title: 'Images',
      detail: 'Importer ISO/WIM et preparer Windows.',
      value: 'WIM',
      icon: Database,
      tone: 'emerald' as const,
      target: 'images' as const,
    },
    {
      title: 'Pilotes',
      detail: 'Packs modele pour deploiement propre.',
      value: 'Drivers',
      icon: HardDrive,
      tone: 'amber' as const,
      target: 'drivers' as const,
    },
  ]
  const beginnerSteps = [
    {
      title: '1. Verifier serveur',
      detail: reliabilityScore !== null ? `Score fiabilite ${reliabilityScore}% - ${readinessLevel}.` : 'Services, reseau, partage et WinPE doivent etre verts avant le test client.',
      action: readiness.every((item) => item.ok) ? 'Pret' : 'Voir diagnostic',
      target: 'settings' as NavigationSection,
      ok: readiness.every((item) => item.ok),
      repair: false,
    },
    {
      title: '2. Importer Windows',
      detail: defaultImageMissing ? 'Blocage actuel: aucune image Windows par defaut. Depose ISO/WIM puis prepare l image.' : 'Image Windows detectee. Verifie le profil complet avant deploiement.',
      action: 'Ouvrir Images',
      target: 'images' as NavigationSection,
      ok: !defaultImageMissing,
      repair: false,
    },
    {
      title: '3. Booter un PC PXE',
      detail: 'Demarre un PC sur le reseau et choisis Audit rapide.',
      action: 'Voir Audit',
      target: 'audit' as NavigationSection,
      ok: deployments.length > 0,
      repair: false,
    },
    {
      title: '4. Controler audit',
      detail: 'Verifie CPU, RAM, disque, batterie, tests atelier et etiquette.',
      action: 'Controler',
      target: 'audit' as NavigationSection,
      ok: false,
      repair: false,
    },
    {
      title: '5. Deployer',
      detail: 'Quand image, drivers et Unattend sont prets, lance le deploiement.',
      action: 'Deployer',
      target: 'deployments' as NavigationSection,
      ok: activeDeployments > 0,
      repair: false,
    },
  ]

  return (
    <div className="space-y-5">
      <PageTitle title="Dashboard" description="Decision rapide pour technicien : pret, bloque, action a faire." icon={Gauge} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className={cn('mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', globalState.tone === 'amber' ? 'border-amber-300/25 bg-amber-300/10 text-amber-200' : globalState.tone === 'cyan' ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200')}>
                <span className={cn('h-2 w-2 rounded-full shadow-[0_0_12px_currentColor]', globalState.tone === 'amber' ? 'bg-amber-300 text-amber-300' : globalState.tone === 'cyan' ? 'bg-cyan-300 text-cyan-300' : 'bg-emerald-300 text-emerald-300')} />
                {globalState.label}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">AtelierOS</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{globalState.detail}</p>
              <div className="mt-2 grid gap-2 text-sm text-slate-400 md:grid-cols-2">
                <span className="truncate">LAN: <span className="font-mono text-cyan-100">{lanEndpoint}</span></span>
                <span className="truncate">Depot: <span className="font-mono text-emerald-100">{pxeEndpoint}</span></span>
              </div>
            </div>
            <div className="grid gap-2 lg:min-w-[360px]">
              <button
                type="button"
                onClick={() => onNavigate(nextAction.target)}
                className={cn(
                  'rounded-xl border p-3 text-left transition hover:bg-white/[0.06]',
                  nextAction.tone === 'emerald' ? 'border-emerald-300/20 bg-emerald-300/10' : nextAction.tone === 'cyan' ? 'border-cyan-300/20 bg-cyan-300/10' : nextAction.tone === 'rose' ? 'border-rose-300/25 bg-rose-300/10' : 'border-amber-300/25 bg-amber-300/10',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Action a faire</span>
                  <ChevronRight className="h-4 w-4 text-cyan-200" />
                </div>
                <div className="mt-2 text-base font-semibold text-white">{nextAction.title}</div>
                <div className="mt-1 line-clamp-2 text-sm text-slate-300">{nextAction.detail}</div>
              </button>
              <div className="grid grid-cols-3 gap-2">
                <DashboardCounter label="Actifs" value={activeDeployments} tone="cyan" />
                <DashboardCounter label="Erreurs" value={failedDeployments + offlineServices.length} tone={failedDeployments || offlineServices.length ? 'amber' : 'emerald'} />
                <DashboardCounter label="Succes" value={`${successRate}%`} tone="emerald" />
              </div>
              <button
                type="button"
                onClick={() => void onResyncNetwork()}
                disabled={isNetworkResyncing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={cn('h-4 w-4', isNetworkResyncing && 'animate-spin')} />
                {isNetworkResyncing ? 'Resynchronisation...' : 'Reparer / resynchroniser reseau'}
              </button>
            </div>
          </div>
          {networkMessage ? (
            <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
              {networkMessage}
            </div>
          ) : null}
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {compactChecks.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => item.label === 'Reseau' ? void onResyncNetwork() : onNavigate(item.label === 'Image' ? 'images' : item.label === 'Retours' ? 'logs' : 'settings')}
                className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                  <span className={cn('h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]', item.ok ? 'bg-emerald-300 text-emerald-300' : 'bg-amber-300 text-amber-300')} />
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">{item.detail}</div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">{item.action}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-5">
            {readiness.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
                  <div className="mt-0.5 truncate font-mono text-xs text-slate-300">{item.value}</div>
                </div>
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_12px_currentColor]', item.ok ? 'bg-emerald-300 text-emerald-300' : 'bg-amber-300 text-amber-300')} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-5 shadow-xl shadow-black/20">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">A traiter</h2>
            <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', warningLogs.length || offlineServices.length ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200')}>
              {warningLogs.length || offlineServices.length ? 'action' : 'RAS'}
            </span>
          </div>
          <div className="space-y-2">
            {offlineServices.slice(0, 2).map((service) => (
              <DashboardNotice key={service.key} title={service.label} detail={service.detail} tone="amber" />
            ))}
            {offlineReportChecks.slice(0, 2).map((check) => (
              <DashboardNotice key={check.key} title={check.label} detail={check.detail} tone="amber" />
            ))}
            {warningLogs.slice(0, 2).map((log) => (
              <DashboardNotice key={log.id} title={log.source} detail={log.message} tone={log.level === 'error' ? 'rose' : 'amber'} />
            ))}
            {!offlineServices.length && !warningLogs.length ? <DashboardNotice title="Base prete" detail="Services OK. Tu peux auditer ou deployer." tone="emerald" /> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {primaryActions.map((action) => (
          <ActionTile key={action.title} title={action.title} detail={action.detail} value={action.value} icon={action.icon} tone={action.tone} onClick={() => onNavigate(action.target)} />
        ))}
      </section>

      {beginnerMode ? (
        <section className="rounded-2xl border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/20">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Premier demarrage client</h2>
              <p className="mt-1 text-sm text-slate-400">Parcours court pour installer et tester l appliance sans connaissance PXE.</p>
            </div>
            <span className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              reliabilityScore === null ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100' : reliabilityScore >= 90 ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/20 bg-amber-300/10 text-amber-100',
            )}>
              {reliabilityScore === null ? 'Mode debutant' : `${reliabilityScore}% - ${readinessLevel}`}
            </span>
          </div>
          {firstBlockingCheck ? (
            <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-amber-50">Premier blocage: {firstBlockingCheck.label}</div>
                  <div className="mt-1 text-sm leading-6 text-amber-100/85">{firstBlockingCheck.detail}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(firstBlockingCheck.key === 'default-image' ? 'images' : firstBlockingCheck.key === 'unattend' ? 'images' : firstBlockingCheck.key === 'backup' ? 'guide' : 'settings')}
                  className="rounded-lg border border-amber-200/25 bg-black/20 px-3 py-2 text-xs font-semibold text-amber-50 transition hover:bg-black/30"
                >
                  Corriger
                </button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-5">
            {beginnerSteps.map((step) => (
              <button
                key={step.title}
                type="button"
                onClick={() => step.repair ? void onResyncNetwork() : onNavigate(step.target)}
                className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.06]"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]', step.ok ? 'bg-emerald-300 text-emerald-300' : 'bg-amber-300 text-amber-300')} />
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
                <div className="text-sm font-semibold text-white">{step.title}</div>
                <div className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{step.detail}</div>
                <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                  {step.action}
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Machines recentes</h2>
              <p className="text-sm text-slate-400">Apercu compact, detail dans l'onglet Deploiements.</p>
            </div>
            <button type="button" onClick={() => onNavigate('deployments')} className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
              Ouvrir
            </button>
          </div>
          <div className="space-y-3">
            {deployments.slice(0, 5).map((deployment) => (
              <div key={deployment.id} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 md:grid-cols-[minmax(0,1fr)_150px_120px] md:items-center">
                <div>
                  <div className="font-semibold text-white">{deployment.hostname}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{deployment.ipAddress} - {deployment.macAddress}</div>
                </div>
                <ProgressBar value={deployment.progress} status={deployment.status} />
                <StatusBadge status={deployment.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-5 shadow-xl shadow-black/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Services</h2>
              <p className="text-sm text-slate-400">Voyants essentiels.</p>
            </div>
            <button type="button" onClick={() => onNavigate('settings')} className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
              Reglages
            </button>
          </div>
          <div className="space-y-2">
            {(status?.services ?? []).slice(0, 6).map((service) => {
              const online = service.status === 'online'
              return (
                <div key={service.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{service.label}</div>
                    <div className="truncate font-mono text-xs text-slate-500">{service.endpoint}</div>
                  </div>
                  <span className={cn('h-3 w-3 shrink-0 rounded-full shadow-[0_0_14px_currentColor]', online ? 'bg-emerald-300 text-emerald-300' : 'bg-rose-300 text-rose-300')} />
                </div>
              )
            })}
            {!status?.services.length ? <DashboardNotice title="Services inconnus" detail="Backend non synchronise." tone="amber" /> : null}
          </div>
        </div>
      </section>
    </div>
  )
}

function DeploymentsModule({ deployments }: { deployments: ActiveDeployment[] }) {
  return (
    <div className="space-y-6">
      <PageTitle title="Deploiements" description="Pilotage des machines cibles, progression image et statut WinPE." icon={Layers3} />
      <ActiveDeployments deployments={deployments} />
    </div>
  )
}

function AuditModule({
  audits,
  clients,
  driverPacks,
  isPreparingDrivers,
  isSendingAction,
  actionMessage,
  onPrepareDrivers,
  onSendAction,
  onDeleteAudit,
  onPruneAudits,
}: {
  audits: ForgePxeAuditSummary[]
  clients: ForgePxeClient[]
  driverPacks: ForgeDriverPack[]
  isPreparingDrivers: boolean
  isSendingAction: boolean
  actionMessage: string | null
  onPrepareDrivers: (auditId: string) => Promise<void>
  onSendAction: (clientId: string, action: string) => Promise<void>
  onDeleteAudit: (auditId: string) => Promise<void>
  onPruneAudits: (keepLatest: number, dryRun: boolean) => Promise<ForgePxeAuditPruneResponse | null>
}) {
  const latest = audits[0]
  const batteryWarnings = audits.filter((audit) => audit.battery.some((item) => (item.wear_percent ?? 0) >= 30)).length
  const diskWarnings = audits.filter((audit) => audit.disks.some((disk) => disk.smart && disk.smart !== 'passed')).length
  const completeLabels = audits.filter((audit) => auditHardwareComplete(audit)).length
  const testedMachines = audits.filter((audit) => hasWorkshopTests(audit)).length
  const ticketCounts = audits.reduce<Record<string, number>>((counts, audit) => {
    const status = auditTicketStatus(audit, driverPackForAudit(audit, driverPacks)).label
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})

  return (
    <div className="space-y-6">
      <PageTitle title="Audit" description="Retour automatique des audits rapides PXE et donnees pretes pour etiquette." icon={ClipboardCheck} />

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
        <MetricCard metric={{ id: 'audit-count', label: 'Audits recus', value: String(audits.length).padStart(2, '0'), detail: latest ? `${latest.brand ?? ''} ${latest.model ?? ''}`.trim() || 'Derniere machine' : 'Aucun retour PXE', trend: latest ? 'synchro active' : 'en attente', tone: audits.length ? 'emerald' : 'amber' }} />
        <MetricCard metric={{ id: 'audit-labels', label: 'Etiquettes completes', value: `${completeLabels}/${Math.max(audits.length, 1)}`, detail: 'marque, modele, CPU, RAM, disque', trend: completeLabels === audits.length && audits.length ? 'pret' : 'a verifier', tone: completeLabels === audits.length && audits.length ? 'emerald' : 'amber' }} />
        <MetricCard metric={{ id: 'audit-battery', label: 'Batteries a surveiller', value: String(batteryWarnings).padStart(2, '0'), detail: 'usure batterie >= 30%', trend: batteryWarnings ? 'controle' : 'RAS', tone: batteryWarnings ? 'rose' : 'emerald' }} />
        <MetricCard metric={{ id: 'audit-disk', label: 'Disques alerte', value: String(diskWarnings).padStart(2, '0'), detail: 'SMART different de passed', trend: diskWarnings ? 'remplacer' : 'OK', tone: diskWarnings ? 'rose' : 'emerald' }} />
        <MetricCard metric={{ id: 'audit-tests', label: 'Tests atelier', value: `${testedMachines}/${Math.max(audits.length, 1)}`, detail: 'pixels, clavier, USB, audio, micro, camera', trend: testedMachines ? 'controle fait' : 'a faire', tone: testedMachines ? 'emerald' : 'amber' }} />
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Pret vente', 'emerald'],
          ['Drivers manquants', 'amber'],
          ['Tests a terminer', 'amber'],
          ['Batterie a controler', 'amber'],
          ['Disque a controler', 'rose'],
          ['Audit incomplet', 'amber'],
        ].map(([label, tone]) => (
          <div key={label} className={cn('rounded-xl border px-3 py-2', tone === 'emerald' ? 'border-emerald-300/20 bg-emerald-300/10' : tone === 'rose' ? 'border-rose-300/20 bg-rose-300/10' : 'border-amber-300/20 bg-amber-300/10')}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
            <div className={cn('mt-1 font-mono text-xl font-semibold', tone === 'emerald' ? 'text-emerald-100' : tone === 'rose' ? 'text-rose-100' : 'text-amber-100')}>
              {ticketCounts[label] || 0}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <AuditModeCard
          title="1. Audit rapide texte"
          tone="emerald"
          detail="A utiliser en premier pour etiquette et inventaire fiable."
          checks={['Marque / modele / numero de serie', 'CPU / RAM / disque / batterie', 'Creation ou mise a jour du retour machine']}
        />
        <AuditModeCard
          title="2. Audit rapide graphique"
          tone="cyan"
          detail="A utiliser ensuite pour les tests atelier visibles."
          checks={['Clavier visuel, pixels, USB', 'Camera, micro, audio', 'Fusionne les tests sans ecraser l audit materiel']}
        />
      </section>

      <AuditReturnPanel
        audits={audits}
        clients={clients}
        driverPacks={driverPacks}
        isPreparingDrivers={isPreparingDrivers}
        isSendingAction={isSendingAction}
        actionMessage={actionMessage}
        onPrepareDrivers={onPrepareDrivers}
        onSendAction={onSendAction}
        onDeleteAudit={onDeleteAudit}
        onPruneAudits={onPruneAudits}
      />
    </div>
  )
}

function AuditModeCard({ title, detail, checks, tone }: { title: string; detail: string; checks: string[]; tone: 'cyan' | 'emerald' }) {
  return (
    <div className={cn('rounded-2xl border p-4 shadow-xl shadow-black/20', tone === 'cyan' ? 'border-cyan-300/15 bg-cyan-300/[0.055]' : 'border-emerald-300/15 bg-emerald-300/[0.055]')}>
      <div className="flex items-start gap-3">
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border', tone === 'cyan' ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100')}>
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {checks.map((check) => (
          <div key={check} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold leading-5 text-slate-200">
            {check}
          </div>
        ))}
      </div>
    </div>
  )
}

function AuditTileRow({ label, value, mono, warn }: { label: string; value: ReactNode; mono?: boolean; warn?: boolean }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cn('min-w-0 break-words text-right text-slate-200', mono && 'font-mono text-cyan-100', warn && 'text-amber-200')}>
        {value}
      </span>
    </div>
  )
}

function AuditReturnPanel({
  audits,
  clients,
  driverPacks,
  isPreparingDrivers,
  isSendingAction,
  actionMessage,
  onPrepareDrivers,
  onSendAction,
  onDeleteAudit,
  onPruneAudits,
}: {
  audits: ForgePxeAuditSummary[]
  clients: ForgePxeClient[]
  driverPacks: ForgeDriverPack[]
  isPreparingDrivers: boolean
  isSendingAction: boolean
  actionMessage: string | null
  onPrepareDrivers: (auditId: string) => Promise<void>
  onSendAction: (clientId: string, action: string) => Promise<void>
  onDeleteAudit: (auditId: string) => Promise<void>
  onPruneAudits: (keepLatest: number, dryRun: boolean) => Promise<ForgePxeAuditPruneResponse | null>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [labelEditorOpen, setLabelEditorOpen] = useState(false)
  const [auditPageSize, setAuditPageSize] = useState<number>(25)
  const [auditPageIndex, setAuditPageIndex] = useState(0)
  const [pruneKeepLatest, setPruneKeepLatest] = useState(50)
  const [prunePreview, setPrunePreview] = useState<ForgePxeAuditPruneResponse | null>(null)
  const selected = audits.find((audit) => audit.id === selectedId) ?? audits[0]
  const safePageSize = auditPageSize < 1 ? audits.length : auditPageSize
  const totalPages = audits.length ? Math.max(1, Math.ceil(audits.length / safePageSize)) : 1
  const clampedPageIndex = Math.min(auditPageIndex, totalPages - 1)
  const pagedAudits = audits.slice(clampedPageIndex * safePageSize, clampedPageIndex * safePageSize + safePageSize)
  const updatedAt = selected?.updated_at
    ? new Date(selected.updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })
    : 'En attente'
  const labelLines = selected ? buildAuditLabelLines(selected) : []
  const auditUrl = selected ? `/audit/${selected.filename}` : null
  const selectedDriverPack = selected ? driverPackForAudit(selected, driverPacks) : null
  const selectedLiveClient = selected ? liveClientForAudit(selected, clients) : null
  const commandClientId = selectedLiveClient?.id || selected?.mac || selected?.serial_number || selected?.id || ''
  const selectedWorkshopSummary = selected ? workshopTestSummary(selected) : null
  const selectedCompletion = selected ? auditCompletionSummary(selected) : null
  const selectedHistory = selected
    ? audits.filter((audit) => (
      normalizeKey(audit.serial_number) && normalizeKey(audit.serial_number) === normalizeKey(selected.serial_number)
    ) || (
      normalizeKey(audit.mac) && normalizeKey(audit.mac) === normalizeKey(selected.mac)
    ))
    : []

  useEffect(() => {
    if (audits.length && !audits.some((audit) => audit.id === selectedId)) {
      setSelectedId(audits[0].id)
    }
  }, [audits, selectedId])

  useEffect(() => {
    setAuditPageIndex(0)
  }, [auditPageSize, audits.length])

  async function copyLabel() {
    if (!labelLines.length || !navigator.clipboard) return
    await navigator.clipboard.writeText(labelLines.join('\n'))
  }

  async function deleteSelectedAudit() {
    if (!selected) return
    const confirmed = window.confirm(`Supprimer l'audit ${machineName(selected)} ?\n\nCette action supprime le retour PXE et le JSON associe.`)
    if (!confirmed) return
    await onDeleteAudit(selected.id)
  }

  async function deleteAuditTile(audit: ForgePxeAuditSummary) {
    const confirmed = window.confirm(`Supprimer le retour ${machineName(audit)} ?`)
    if (!confirmed) return
    await onDeleteAudit(audit.id)
  }

  async function deleteCurrentPage() {
    if (!pagedAudits.length) return
    const confirmed = window.confirm(`Supprimer les ${pagedAudits.length} retours affichés sur cette page ?`)
    if (!confirmed) return
    await Promise.all(pagedAudits.map((audit) => onDeleteAudit(audit.id)))
  }

  async function pruneOldAudits() {
    const keepLatest = pruneKeepLatest
    if (audits.length <= keepLatest) {
      const preview = await onPruneAudits(keepLatest, true)
      setPrunePreview(preview)
      return
    }
    const confirmed = window.confirm(`Nettoyer les anciens retours en gardant les ${keepLatest} plus recents ?\n\nUne simulation sera faite avant suppression definitive.`)
    if (!confirmed) return
    const preview = await onPruneAudits(keepLatest, true)
    setPrunePreview(preview)
    if (!preview?.candidates) return
    const apply = window.confirm(`Simulation terminee: ${preview.candidates} fichier(s) candidat(s).\n\nAppliquer vraiment le nettoyage des anciens audits ?`)
    if (!apply) return
    const applied = await onPruneAudits(keepLatest, false)
    setPrunePreview(applied)
  }

  function exportAuditCsv() {
    const rows = [
      ['date', 'marque', 'modele', 'serie', 'hostname', 'ip', 'mac', 'cpu', 'ram', 'disque', 'batterie', 'grade', 'tests_ok', 'tests_total', 'fichier'],
      ...audits.map((audit) => {
        const tests = workshopTestSummary(audit)
        return [
          audit.updated_at || audit.created_at || '',
          audit.brand || '',
          audit.model || '',
          audit.serial_number || '',
          audit.hostname || '',
          audit.ip || '',
          audit.mac || '',
          audit.cpu || '',
          audit.ram || (audit.ram_mb ? `${audit.ram_mb} MB` : ''),
          audit.main_disk || '',
          audit.battery_status || '',
          audit.grade_proposed || '',
          tests.ok,
          tests.total,
          audit.filename,
        ]
      }),
    ]
    downloadCsvFile(`aos-audits-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  function exportSelectedHistoryCsv() {
    if (!selected || !selectedHistory.length) return
    const rows = [
      ['date', 'marque', 'modele', 'serie', 'hostname', 'ip', 'mac', 'cpu', 'ram', 'disque', 'batterie', 'grade', 'tests_ok', 'tests_total', 'fichier'],
      ...selectedHistory.map((audit) => {
        const tests = workshopTestSummary(audit)
        return [
          audit.updated_at || audit.created_at || '',
          audit.brand || '',
          audit.model || '',
          audit.serial_number || '',
          audit.hostname || '',
          audit.ip || '',
          audit.mac || '',
          audit.cpu || '',
          audit.ram || (audit.ram_mb ? `${audit.ram_mb} MB` : ''),
          audit.main_disk || '',
          audit.battery_status || '',
          audit.grade_proposed || '',
          tests.ok,
          tests.total,
          audit.filename,
        ]
      }),
    ]
    const reference = (selected.serial_number || selected.mac || selected.hostname || selected.id || 'machine')
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
    downloadCsvFile(`atelieros-historique-${reference}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/20">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Retours machines pour etiquettes</h2>
          <p className="text-sm text-slate-400">Chaque tuile correspond a un PC audite en PXE, pret a etre etiquete.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', selected ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-200')}>
            <RefreshCw className="h-3.5 w-3.5" />
            {selected ? `${audits.length} retour(s)` : 'aucun retour'}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.045] p-1">
              <button type="button" onClick={() => setAuditPageSize(10)} className={cn('rounded-lg px-3 py-1 text-[11px] font-semibold', auditPageSize === 10 ? 'bg-cyan-300/20 text-white' : 'text-slate-300')}>
                10
              </button>
              <button type="button" onClick={() => setAuditPageSize(25)} className={cn('rounded-lg px-3 py-1 text-[11px] font-semibold', auditPageSize === 25 ? 'bg-cyan-300/20 text-white' : 'text-slate-300')}>
                25
              </button>
              <button type="button" onClick={() => setAuditPageSize(50)} className={cn('rounded-lg px-3 py-1 text-[11px] font-semibold', auditPageSize === 50 ? 'bg-cyan-300/20 text-white' : 'text-slate-300')}>
                50
              </button>
              <button
                type="button"
                onClick={() => setAuditPageSize(audits.length || 9999)}
                className={cn('rounded-lg px-3 py-1 text-[11px] font-semibold', (auditPageSize >= (audits.length || 9999)) ? 'bg-cyan-300/20 text-white' : 'text-slate-300')}
              >
                Tous
              </button>
            </div>
            <button
              type="button"
              onClick={deleteCurrentPage}
              disabled={!pagedAudits.length}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 px-2.5 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Vider page
            </button>
            <button
              type="button"
              onClick={pruneOldAudits}
              disabled={!audits.length}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-2.5 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Garder {pruneKeepLatest}
            </button>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.045] p-1">
              {[25, 50, 100].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setPruneKeepLatest(value)
                    setPrunePreview(null)
                  }}
                  className={cn('rounded-lg px-2.5 py-1 text-[11px] font-semibold', pruneKeepLatest === value ? 'bg-amber-300/20 text-amber-100' : 'text-slate-300')}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportAuditCsv}
              disabled={!audits.length}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-300/10 px-2.5 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
          {prunePreview ? (
            <div className="max-w-xl rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
              Nettoyage: garder {prunePreview.keep_latest}, {prunePreview.candidates} ancien(s) retour(s) candidat(s).
              {prunePreview.deleted_files.length ? ` Supprimes: ${prunePreview.deleted_files.length}.` : ' Aucun fichier supprime.'}
            </div>
          ) : null}
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] p-1">
          <button
            type="button"
            onClick={() => setAuditPageIndex(Math.max(0, clampedPageIndex - 1))}
            disabled={clampedPageIndex === 0}
            className="rounded-lg border border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-300/25 hover:text-cyan-100 disabled:opacity-40"
          >
            Prec.
          </button>
          <span className="px-3 text-xs font-semibold text-slate-300">
            Page {clampedPageIndex + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setAuditPageIndex(Math.min(totalPages - 1, clampedPageIndex + 1))}
            disabled={clampedPageIndex >= totalPages - 1}
            className="rounded-lg border border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-300/25 hover:text-cyan-100 disabled:opacity-40"
          >
            Suiv.
          </button>
        </div>
      ) : null}

      {selected ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="xl:col-span-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Machine selectionnee</div>
                <div className="mt-1 truncate text-lg font-semibold text-white">{machineName(selected)}</div>
                <div className="mt-1 truncate font-mono text-xs text-slate-400">{selected.serial_number || selected.filename}</div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
                <button type="button" onClick={() => setLabelEditorOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
                  <Printer className="h-4 w-4" />
                  Etiquette
                </button>
                <button type="button" onClick={() => printAuditReport(selected)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-300/10 px-3 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/15">
                  <FileText className="h-4 w-4" />
                  PDF audit
                </button>
                <button type="button" onClick={() => downloadAuditReport(selected)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]">
                  <Download className="h-4 w-4" />
                  Exporter
                </button>
                <button type="button" onClick={() => onPrepareDrivers(selected.id)} disabled={isPreparingDrivers || !selected.brand || !selected.model} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60">
                  <HardDrive className="h-4 w-4" />
                  Drivers
                </button>
                <button type="button" onClick={copyLabel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]">
                  <Copy className="h-4 w-4" />
                  Copier
                </button>
                <button type="button" onClick={deleteSelectedAudit} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/15">
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
          <div className="grid content-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {pagedAudits.map((audit) => {
              const active = audit.id === selected.id
              const batteryAlert = audit.battery.some((item) => (item.wear_percent ?? 0) >= 30)
              const tests = workshopTests(audit)
              const hardwareComplete = auditHardwareComplete(audit)
              const testSummary = workshopTestSummary(audit)
              const completion = auditCompletionSummary(audit)
              const action = auditNextAction(audit)
              const ticket = auditTicketStatus(audit, driverPackForAudit(audit, driverPacks))

              return (
                <button
                  type="button"
                  key={`${audit.filename}-${audit.updated_at}`}
                  onClick={() => setSelectedId(audit.id)}
                  className={cn(
                    'min-h-[250px] rounded-xl border p-4 text-left transition',
                    active
                      ? 'border-cyan-300/35 bg-cyan-300/[0.08] shadow-lg shadow-cyan-950/30'
                      : 'border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]',
                  )}
                >
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        deleteAuditTile(audit)
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-300/15"
                      aria-label={`Supprimer ${machineName(audit)}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">{machineName(audit)}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{audit.serial_number || audit.filename}</div>
                    </div>
                    <span className={cn('rounded-full border px-2 py-1 text-[11px] font-semibold', action.tone === 'ok' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : action.tone === 'warn' ? 'border-amber-300/25 bg-amber-300/10 text-amber-200' : 'border-rose-300/25 bg-rose-300/10 text-rose-200')}>
                      {action.label}
                    </span>
                  </div>

                  <div className={cn('mt-3 rounded-lg border px-2 py-1.5 text-xs font-semibold', ticket.tone === 'ok' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : ticket.tone === 'warn' ? 'border-amber-300/25 bg-amber-300/10 text-amber-200' : 'border-rose-300/25 bg-rose-300/10 text-rose-200')}>
                    Ticket: {ticket.label}
                  </div>

                  <div className="mt-4 grid gap-2 text-sm">
                    <AuditTileRow label="CPU" value={audit.cpu || '-'} />
                    <AuditTileRow label="RAM" value={audit.ram || (audit.ram_mb ? `${audit.ram_mb} MB` : '-')} mono />
                    <AuditTileRow label="Disque" value={audit.main_disk || '-'} />
                    <AuditTileRow label="Batterie" value={audit.battery_status || 'Aucune'} warn={batteryAlert} />
                  </div>

                  {tests.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tests.map((test) => (
                        <span key={test.key} className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase', test.value === 'ok' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/25 bg-amber-300/10 text-amber-200')}>
                          {test.short}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                    <span className={cn('rounded-md border px-2 py-1', hardwareComplete ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-rose-300/25 bg-rose-300/10 text-rose-200')}>
                      {hardwareComplete ? 'Materiel OK' : 'Materiel incomplet'}
                    </span>
                    <span className={cn('rounded-md border px-2 py-1', testSummary.complete ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : tests.length ? 'border-amber-300/25 bg-amber-300/10 text-amber-200' : 'border-rose-300/25 bg-rose-300/10 text-rose-200')}>
                      {testSummary.complete ? 'Tests complets' : tests.length ? `${testSummary.done}/${testSummary.total} tests` : 'Tests a faire'}
                    </span>
                  </div>
                  {!completion.complete ? (
                    <div className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1.5 text-[11px] leading-5 text-amber-100">
                      Manque: {completion.missing.slice(0, 3).join(', ')}
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 font-mono text-xs text-slate-500">
                    <span>{audit.ip || '-'}</span>
                    <span className="truncate">{audit.mac || '-'}</span>
                  </div>
                </button>
              )
            })}
          </div>

          <aside className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.055] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Etiquette prete</div>
                <div className="mt-3 text-xl font-semibold text-white">{machineName(selected)}</div>
                <div className="mt-2 font-mono text-xs text-slate-400">Maj: {updatedAt}</div>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                {selected.grade_proposed || 'Grade -'}
              </span>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3 font-mono text-[13px] leading-6 text-slate-100">
              {labelLines.map((line) => <div key={line}>{line}</div>)}
            </div>

            <div className={cn('mt-4 rounded-lg border p-3 text-sm leading-6', selectedCompletion?.complete ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/20 bg-amber-300/10 text-amber-100')}>
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">{selectedCompletion?.complete ? 'Audit complet' : 'Audit incomplet'}</div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-mono text-[11px] text-slate-200">
                  {selectedWorkshopSummary?.done ?? 0}/{selectedWorkshopSummary?.total ?? 0} tests
                </span>
              </div>
              <div className="mt-1 text-slate-300">
                {selectedCompletion?.complete ? 'Materiel et tests atelier valides.' : `A finaliser: ${selectedCompletion?.missing.join(', ') || 'controle atelier'}.`}
              </div>
            </div>

            <div className={cn('mt-4 rounded-lg border p-3 text-sm leading-6', auditNextAction(selected).tone === 'ok' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : auditNextAction(selected).tone === 'warn' ? 'border-amber-300/20 bg-amber-300/10 text-amber-100' : 'border-rose-300/20 bg-rose-300/10 text-rose-100')}>
              <div className="font-semibold">{auditNextAction(selected).label}</div>
              <div className="text-slate-300">{auditNextAction(selected).detail}</div>
            </div>

            <div className={cn('mt-4 rounded-lg border p-3 text-sm leading-6', auditTicketStatus(selected, selectedDriverPack).tone === 'ok' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : auditTicketStatus(selected, selectedDriverPack).tone === 'warn' ? 'border-amber-300/20 bg-amber-300/10 text-amber-100' : 'border-rose-300/20 bg-rose-300/10 text-rose-100')}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ticket atelier</div>
              <div className="mt-1 font-semibold">{auditTicketStatus(selected, selectedDriverPack).label}</div>
              <div className="text-slate-300">{auditTicketStatus(selected, selectedDriverPack).detail}</div>
            </div>

            <div className="mt-4 rounded-lg border border-violet-300/15 bg-violet-300/[0.055] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">Commandes PXE live</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {selectedLiveClient ? `Agent actif: ${selectedLiveClient.ip || selectedLiveClient.id}` : 'Agent non vu en live pour cette machine'}
                  </div>
                </div>
                <span className={cn('rounded-full border px-2 py-1 text-[11px] font-semibold', selectedLiveClient ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/25 bg-amber-300/10 text-amber-200')}>
                  {selectedLiveClient ? 'live' : 'attente'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RemoteActionButton label="Audit" action="diag_express" disabled={!commandClientId || isSendingAction} onClick={() => onSendAction(commandClientId, 'diag_express')} />
                <RemoteActionButton label="Tests" action="open_tests" disabled={!commandClientId || isSendingAction} onClick={() => onSendAction(commandClientId, 'open_tests')} />
                <RemoteActionButton label="SSH" action="start_ssh" disabled={!commandClientId || isSendingAction} onClick={() => onSendAction(commandClientId, 'start_ssh')} />
                <RemoteActionButton label="Reboot" action="reboot" danger disabled={!commandClientId || isSendingAction} onClick={() => onSendAction(commandClientId, 'reboot')} />
                <RemoteActionButton label="Eteindre" action="poweroff" danger disabled={!commandClientId || isSendingAction} onClick={() => onSendAction(commandClientId, 'poweroff')} />
              </div>
              {actionMessage ? <div className="mt-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-300">{actionMessage}</div> : null}
            </div>

            <div className="mt-4 grid gap-2 text-sm">
              <InfoRow label="USB detectes" value={selected.usb_ports_detected ?? '-'} />
              <InfoRow label="SMART" value={selected.disks[0]?.smart || 'inconnu'} tone={selected.disks[0]?.smart && selected.disks[0]?.smart !== 'passed' ? 'warn' : 'ok'} />
              <InfoRow label="Batterie" value={selected.battery_status || 'Aucune batterie'} tone={selected.battery.some((item) => (item.wear_percent ?? 0) >= 30) ? 'warn' : 'ok'} />
              <InfoRow label="Fichier" value={selected.filename} mono />
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Historique machine</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportSelectedHistoryCsv}
                    disabled={!selectedHistory.length}
                    className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Export
                  </button>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                    {selectedHistory.length}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {selectedHistory.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="grid w-full grid-cols-[1fr_auto] gap-3 rounded-md border border-white/10 bg-white/[0.035] px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
                  >
                    <span className="truncate text-xs text-slate-300">{item.updated_at ? new Date(item.updated_at).toLocaleString('fr-FR') : item.filename}</span>
                    <span className="text-[11px] font-semibold text-cyan-200">{auditCompletionSummary(item).complete ? 'OK' : 'A faire'}</span>
                  </button>
                ))}
                {!selectedHistory.length ? (
                  <div className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1.5 text-xs text-slate-500">
                    Aucun historique encore lie a ce numero de serie ou MAC.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tests atelier</div>
                <span className={cn('rounded-full border px-2 py-1 text-[11px] font-semibold', selectedWorkshopSummary?.complete ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/25 bg-amber-300/10 text-amber-200')}>
                  {selectedWorkshopSummary?.complete ? 'complet' : `${selectedWorkshopSummary?.missing.length ?? 0} manquant(s)`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {workshopRequiredTests.map((required) => {
                  const test = workshopTests(selected).find((item) => item.key === required.key)
                  const value = test?.value || 'manquant'
                  return (
                    <InfoRow key={required.key} label={required.label} value={value.toUpperCase()} tone={value === 'ok' ? 'ok' : 'warn'} />
                  )
                })}
              </div>
              {selectedWorkshopSummary?.missing.length ? (
                <div className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1.5 text-xs text-amber-100">
                  Tests a relancer: {selectedWorkshopSummary.missing.join(', ')}.
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-lg border border-cyan-300/10 bg-cyan-300/[0.045] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Pilotes modele</div>
              {selectedDriverPack ? (
                <div className="space-y-2 text-sm">
                  <InfoRow label="Pack" value={selectedDriverPack.name} />
                  <InfoRow label="Chemin" value={selectedDriverPack.path} mono />
                  <InfoRow label="Statut" value={selectedDriverPack.status} tone={selectedDriverPack.status === 'downloaded' || selectedDriverPack.status === 'prepared' || selectedDriverPack.status === 'registered' ? 'ok' : 'warn'} />
                </div>
              ) : (
                <div className="text-sm leading-6 text-slate-400">
                  Aucun pack pilote lie a ce modele. Lance le telechargement automatique depuis le serveur.
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={copyLabel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
                <Copy className="h-4 w-4" />
                Copier
              </button>
              <button type="button" onClick={() => setLabelEditorOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]">
                <FileText className="h-4 w-4" />
                Etiquette
              </button>
              <button
                type="button"
                onClick={() => onPrepareDrivers(selected.id)}
                disabled={isPreparingDrivers || !selected.brand || !selected.model}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <HardDrive className="h-4 w-4" />
                Telecharger drivers
              </button>
              <button
                type="button"
                onClick={() => printAuditReport(selected)}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-300/10 px-3 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/15"
              >
                <FileText className="h-4 w-4" />
                PDF audit machine
              </button>
              <button
                type="button"
                onClick={() => downloadAuditReport(selected)}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
              >
                <Download className="h-4 w-4" />
                Exporter rapport HTML
              </button>
              {auditUrl ? (
                <a href={auditUrl} target="_blank" rel="noreferrer" className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]">
                  JSON
                  <ChevronRight className="h-4 w-4" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={deleteSelectedAudit}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/15"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer audit
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm text-slate-400">
          Aucun fichier audit etiquette trouve pour le moment. Lance Audit rapide + etiquette sur un client PXE puis synchronise.
        </div>
      )}

      {selected && labelEditorOpen ? (
        <LabelEditorModal audit={selected} onClose={() => setLabelEditorOpen(false)} />
      ) : null}
    </section>
  )
}

function LabelEditorModal({ audit, onClose }: { audit: ForgePxeAuditSummary; onClose: () => void }) {
  const labelFormats = [
    { id: 'brother-29x90', name: 'Brother 29 x 90 mm', width: 90, height: 29, note: 'Rouleau predecoupe 29 x 90, impression paysage.' },
    { id: 'brother-62x100', name: 'Brother 62 mm continu', width: 62, height: 100, note: 'Rouleau 62 mm, longueur 100 mm.' },
  ] as const
  const initial = useMemo(() => ({
    title: cleanLabelField(dedupeMachineTitle(audit.brand, audit.model)),
    brand: cleanLabelField(audit.brand || ''),
    model: cleanLabelField(audit.model || ''),
    serial: audit.serial_number || '',
    cpu: cleanLabelField(audit.cpu || ''),
    ram: cleanLabelField(labelRamSummary(audit)),
    disk: cleanLabelField(labelDiskSummary(audit)),
    battery: cleanLabelField(labelBatterySummary(audit)),
    hostname: cleanLabelField(audit.hostname || ''),
    ip: cleanLabelField(audit.ip || ''),
    grade: audit.grade_proposed || 'A',
    price: '',
    note: 'ATELIEROS',
  }), [audit])
  const [label, setLabel] = useState(initial)
  const [formatId, setFormatId] = useState<string>(labelFormats[0].id)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('')
  const format = labelFormats.find((item) => item.id === formatId) ?? labelFormats[0]
  const pageWidth = format.width
  const pageHeight = format.height
  const slimLabel = format.id === 'brother-29x90'
  const showNetworkOnLabel = !slimLabel
  const printLabel = {
    title: compactMachineTitle(label.title, slimLabel ? 34 : 52),
    brand: fitLabelText(label.brand, slimLabel ? 18 : 30),
    model: fitLabelText(label.model, slimLabel ? 22 : 36),
    cpu: compactCpuLabel(label.cpu, slimLabel ? 26 : 42),
    ram: compactRamLabel(label.ram, slimLabel ? 22 : 30),
    disk: compactDiskLabel(label.disk, slimLabel ? 24 : 34),
    battery: compactBatteryLabel(label.battery, slimLabel ? 34 : 48),
    hostname: fitLabelText(label.hostname, slimLabel ? 0 : 24),
    ip: fitLabelText(label.ip, slimLabel ? 0 : 24),
    serial: fitLabelText(label.serial, slimLabel ? 22 : 34),
    note: fitLabelText(label.note, slimLabel ? 18 : 32),
  }
  const barcodeText = cleanBarcodeValue(label.serial || audit.id || '')
  const barcodeValue = barcodeText || `AOS-${audit.id}`.slice(0, 32)
  const qrText = [
    'AOS',
    `S=${barcodeValue}`,
    `M=${compactMachineTitle(label.title, 32)}`,
    `G=${label.grade || '-'}`,
  ].filter(Boolean).join(';')
  const qualityChecks = [
    { label: 'Format', ok: true, detail: `${pageWidth} x ${pageHeight} mm, marge 0, echelle 100%.` },
    { label: 'QR', ok: Boolean(qrDataUrl) && qrText.length <= 110, detail: qrText.length > 110 ? 'QR trop charge, reduire titre ou serie.' : 'QR haute correction active.' },
    { label: 'Code-barres', ok: Boolean(barcodeDataUrl) && barcodeValue.length >= 3, detail: barcodeDataUrl ? 'CODE128 propre, sans texte parasite.' : 'Generation en cours.' },
    { label: 'Texte', ok: !Object.values(printLabel).some((value) => value.includes('...')), detail: 'Aucune valeur tronquee en points.' },
  ]
  const qualityOk = qualityChecks.every((check) => check.ok)

  useEffect(() => {
    let active = true
    QRCode.toDataURL(qrText, { margin: 3, width: 420, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => { if (active) setQrDataUrl(url) })
      .catch(() => { if (active) setQrDataUrl('') })
    return () => { active = false }
  }, [qrText])

  useEffect(() => {
    const barcodeTextForRender = cleanBarcodeValue(label.serial || audit.id || `AOS-${audit.id}`.slice(0, 32))
    if (!barcodeTextForRender) {
      setBarcodeDataUrl('')
      return
    }
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      JsBarcode(svg, barcodeTextForRender || 'AOS-LABEL', {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        width: slimLabel ? 1.15 : 1.45,
        height: slimLabel ? 26 : 42,
        lineColor: '#000000',
        background: '#ffffff',
      })
      const encoded = window.btoa(unescape(encodeURIComponent(svg.outerHTML)))
      setBarcodeDataUrl(`data:image/svg+xml;base64,${encoded}`)
    } catch {
      setBarcodeDataUrl('')
    }
  }, [audit.id, label.serial, slimLabel])

  function update(key: keyof typeof label, value: string) {
    setLabel((current) => ({ ...current, [key]: cleanLabelField(value) }))
  }

  function optimizeLabel() {
    setLabel((current) => ({
      ...current,
      title: compactMachineTitle(current.title, slimLabel ? 34 : 52),
      cpu: compactCpuLabel(current.cpu, slimLabel ? 26 : 42),
      ram: compactRamLabel(current.ram, slimLabel ? 22 : 30),
      disk: compactDiskLabel(current.disk, slimLabel ? 24 : 34),
      battery: compactBatteryLabel(current.battery, slimLabel ? 34 : 48),
      serial: cleanBarcodeValue(current.serial || audit.id),
      note: fitLabelText(current.note || 'ATELIEROS', 28),
    }))
  }

  function printPdf() {
    const popup = window.open('', '_blank', 'width=900,height=700')
    if (!popup) return
    const barcodeTextForRender = cleanBarcodeValue(label.serial || audit.id || `AOS-${audit.id}`.slice(0, 32))
    const qrSizeMm = slimLabel ? 13.2 : 24
    const barcodeWidthMm = slimLabel ? 27 : 45
    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiquette ${escapeHtml(label.serial || audit.id)}</title>
  <style>
    @page { size: ${pageWidth}mm ${pageHeight}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: ${pageWidth}mm; height: ${pageHeight}mm; margin: 0; padding: 0; background: white; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .label { width: ${pageWidth}mm; height: ${pageHeight}mm; padding: ${slimLabel ? '0' : '3.4mm 4mm'}; background: white; display: ${slimLabel ? 'block' : 'grid'}; grid-template-rows: auto 1fr auto; gap: ${slimLabel ? '0' : '1.8mm'}; overflow: hidden; break-inside: avoid; page-break-inside: avoid; position: relative; }
    .label * { color: #000; font-weight: 900; letter-spacing: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .top { display: grid; grid-template-columns: minmax(0,1fr) ${qrSizeMm}mm; gap: ${slimLabel ? '1.6mm' : '2.4mm'}; align-items: start; min-width: 0; ${slimLabel ? 'position:absolute;left:4mm;top:1.7mm;width:82mm;height:11.2mm;' : ''} }
    .brand { font-size: ${slimLabel ? '4.6pt' : '8.3pt'}; text-transform: uppercase; text-align: center; white-space: nowrap; overflow: hidden; margin-bottom: ${slimLabel ? '.35mm' : '1mm'}; }
    .titleline { display: grid; grid-template-columns: 1fr ${slimLabel ? '0' : '11mm'}; gap: ${slimLabel ? '0' : '1.5mm'}; align-items: start; min-width: 0; }
    h1 { margin: 0; font-size: ${slimLabel ? '8.7pt' : '17pt'}; line-height: .98; white-space: nowrap; overflow: hidden; }
    .grade { width: ${slimLabel ? '0' : '11mm'}; height: ${slimLabel ? '0' : '11mm'}; display: ${slimLabel ? 'none' : 'grid'}; place-items: center; border: .35mm solid #000; font-size: ${slimLabel ? '0' : '16pt'}; line-height: 1; }
    .qrbox { width: ${qrSizeMm}mm; height: ${qrSizeMm}mm; padding: .6mm; background: #fff; display: grid; place-items: center; }
    .qr { width: 100%; height: 100%; border: 0; padding: 0; object-fit: contain; image-rendering: pixelated; }
    .body { min-height: 0; overflow: hidden; display: grid; gap: ${slimLabel ? '.18mm' : '1.1mm'}; align-content: center; ${slimLabel ? 'position:absolute;left:4mm;top:12.6mm;width:53mm;height:9.2mm;' : ''} }
    .line { display: grid; grid-template-columns: ${slimLabel ? '7.2mm minmax(0,1fr)' : '14mm minmax(0,1fr)'}; gap: ${slimLabel ? '.75mm' : '1.3mm'}; min-width: 0; align-items: baseline; overflow: hidden; }
    .key { font-size: ${slimLabel ? '3.9pt' : '7pt'}; text-transform: uppercase; opacity: .68; white-space: nowrap; text-align: right; }
    .value { font-size: ${slimLabel ? '5pt' : '8.6pt'}; line-height: 1.02; min-width: 0; white-space: nowrap; overflow: hidden; text-align: left; }
    .bottom { display: grid; grid-template-columns: 1fr ${barcodeWidthMm}mm; gap: ${slimLabel ? '1mm' : '2.2mm'}; align-items: end; min-width: 0; ${slimLabel ? 'position:absolute;left:4mm;top:21.5mm;width:82mm;height:6.2mm;' : ''} }
    .serial { font-family: Consolas, Arial, sans-serif; font-size: ${slimLabel ? '5.2pt' : '9pt'}; white-space: nowrap; overflow: hidden; line-height: 1.02; }
    .note { margin-top: .2mm; font-size: ${slimLabel ? '3.9pt' : '7.2pt'}; text-transform: uppercase; white-space: nowrap; overflow: hidden; }
    .barcode-zone { display: grid; align-content: end; gap: .25mm; }
    .barcode { width: 100%; height: ${slimLabel ? '5.1mm' : '12mm'}; object-fit: fill; image-rendering: crisp-edges; }
    .barcode-label { font-size: ${slimLabel ? '3.2pt' : '5.2pt'}; white-space: nowrap; overflow: hidden; text-align: center; }
    .print-toolbar { position: fixed; left: 12px; top: 12px; z-index: 20; display: flex; gap: 8px; align-items: center; padding: 8px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; box-shadow: 0 12px 30px rgba(0,0,0,.18); font-family: Arial, Helvetica, sans-serif; }
    .print-toolbar button { border: 0; border-radius: 6px; background: #111827; color: #fff; font-weight: 800; padding: 7px 12px; cursor: pointer; }
    .print-toolbar span { color: #111827; font-size: 11px; font-weight: 800; }
    @media print { html, body { background: white; } .print-toolbar { display: none !important; } }
  </style>
</head>
<body>
      <div class="print-toolbar">
        <button type="button" onclick="fitText(); window.focus(); window.print();">Imprimer</button>
        <span>${pageWidth} x ${pageHeight} mm - echelle 100%</span>
      </div>
      <section class="label">
        <div class="top">
          <div><div class="brand fit" data-min="${slimLabel ? '3.3' : '6'}">AOS DEPLOY - CERTIFIED DEVICE</div><div class="titleline"><h1 class="fit" data-min="${slimLabel ? '5.8' : '10'}">${escapeHtml(printLabel.title)}</h1><div class="grade">${escapeHtml(label.grade)}</div></div></div>
      ${qrDataUrl ? `<div class="qrbox"><img class="qr" src="${qrDataUrl}" alt="QR" /></div>` : ''}
        </div>
        <div class="body">
      <div class="line"><div class="key">CPU</div><div class="value fit" data-min="${slimLabel ? '3.9' : '6.3'}">${escapeHtml(printLabel.cpu || '-')}</div></div>
      <div class="line"><div class="key">RAM</div><div class="value fit" data-min="${slimLabel ? '3.9' : '6.3'}">${escapeHtml(printLabel.ram || '-')}</div></div>
      <div class="line"><div class="key">SSD</div><div class="value fit" data-min="${slimLabel ? '3.9' : '6.3'}">${escapeHtml(printLabel.disk || '-')}</div></div>
      <div class="line"><div class="key">BAT</div><div class="value fit" data-min="${slimLabel ? '3.9' : '6.3'}">${escapeHtml(printLabel.battery || '-')}</div></div>
      ${showNetworkOnLabel ? `<div class="line"><div class="key">HOST</div><div class="value fit" data-min="6.3">${escapeHtml(printLabel.hostname || '-')}</div></div>
      <div class="line"><div class="key">IP</div><div class="value fit" data-min="6.3">${escapeHtml(printLabel.ip || '-')}</div></div>` : ''}
    </div>
      <div class="bottom">
        <div>
          <div class="serial fit" data-min="${slimLabel ? '3.8' : '6.5'}">SN: ${escapeHtml(printLabel.serial || '-')}</div>
          <div class="note fit" data-min="${slimLabel ? '3' : '5.2'}">${escapeHtml(printLabel.note)}</div>
        </div>
        <div class="barcode-zone">
          <div class="barcode-label fit" data-min="${slimLabel ? '2.5' : '4'}">${escapeHtml(barcodeTextForRender || '-')}</div>
          ${barcodeDataUrl ? `<img class="barcode" src="${barcodeDataUrl}" alt="Code-barres" />` : '<div class="barcode-label">generation impossible</div>'}
        </div>
      </div>
  </section>
  <script>
    function fitText() {
      const nodes = Array.from(document.querySelectorAll('.fit'));
      for (const node of nodes) {
        const style = window.getComputedStyle(node);
        let size = parseFloat(style.fontSize);
        const min = parseFloat(node.dataset.min || '4');
        while ((node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight) && size > min) {
          size -= 0.2;
          node.style.fontSize = size + 'px';
        }
      }
    }
    function waitImages() {
      const images = Array.from(document.images);
      return Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      })));
    }
    window.onload = async () => {
      await waitImages();
      fitText();
      requestAnimationFrame(() => {
        fitText();
      });
    };
  </script>
</body>
</html>`)
    popup.document.close()
  }

  function printBrotherTest() {
    const popup = window.open('', '_blank', 'width=760,height=520')
    if (!popup) return
    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Test Brother ${pageWidth}x${pageHeight}</title>
  <style>
    @page { size: ${pageWidth}mm ${pageHeight}mm; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: white; color: #000; font-family: Arial, Helvetica, sans-serif; }
    .label { width: ${pageWidth}mm; height: ${pageHeight}mm; padding: ${slimLabel ? '1.2mm' : '2mm'}; display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; border: 0; }
    .title { text-align: center; font-weight: 900; font-size: ${slimLabel ? '7pt' : '12pt'}; line-height: 1; }
    .sub { text-align: center; font-weight: 800; font-size: ${slimLabel ? '4pt' : '7pt'}; margin-top: .5mm; }
    .box { margin: ${slimLabel ? '1mm 0' : '2mm 0'}; border: .45mm solid #000; display: grid; place-items: center; font-weight: 900; font-size: ${slimLabel ? '8pt' : '16pt'}; }
    .bottom { display: flex; align-items: end; justify-content: space-between; gap: 2mm; font-size: ${slimLabel ? '4pt' : '7pt'}; font-weight: 800; }
    .bars { width: 38%; height: ${slimLabel ? '4mm' : '8mm'}; background: repeating-linear-gradient(90deg,#000 0,#000 1px,#fff 1px,#fff 2px); }
  </style>
</head>
<body>
  <section class="label">
    <div>
      <div class="title">TEST BROTHER AOS</div>
      <div class="sub">${pageWidth} x ${pageHeight} mm - ECHELLE 100%</div>
    </div>
    <div class="box">ROULEAU OK</div>
    <div class="bottom">
      <span>Sans ajuster a la page</span>
      <div class="bars"></div>
    </div>
  </section>
  <script>
    function fitText() {
      const nodes = Array.from(document.querySelectorAll('.fit'));
      for (const node of nodes) {
        const style = window.getComputedStyle(node);
        let size = parseFloat(style.fontSize);
        const min = parseFloat(node.dataset.min || '4');
        while ((node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight) && size > min) {
          size -= 0.25;
          node.style.fontSize = size + 'px';
        }
      }
    }
    window.onload = () => {
      fitText();
      setTimeout(() => window.print(), 80);
    };
  </script>
</body>
</html>`)
    popup.document.close()
  }

  return (
    <WorkspaceModal title="Editeur etiquette" description="Ajuste le rendu avant impression ou sauvegarde PDF." onClose={onClose}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-3 md:grid-cols-2">
          <div className={cn('md:col-span-2 rounded-xl border p-4', qualityOk ? 'border-emerald-300/20 bg-emerald-300/10' : 'border-amber-300/20 bg-amber-300/10')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className={cn('text-sm font-semibold', qualityOk ? 'text-emerald-100' : 'text-amber-100')}>
                  {qualityOk ? 'Etiquette lisible' : 'Ajustement conseille'}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-300">
                  Verification automatique: titre, QR, code-barres et format Brother.
                </div>
              </div>
              <button
                type="button"
                onClick={() => optimizeLabel()}
                className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
              >
                Optimiser automatiquement
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {qualityChecks.map((check) => (
                <div key={check.label} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]', check.ok ? 'bg-emerald-300 text-emerald-300' : 'bg-amber-300 text-amber-300')} />
                    <span className="text-xs font-semibold text-white">{check.label}</span>
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-slate-400">{check.detail}</div>
                </div>
              ))}
            </div>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:col-span-2">
            Format Brother
            <select
              value={formatId}
              onChange={(event) => setFormatId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/30"
            >
              {labelFormats.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <span className="mt-2 block text-[11px] normal-case leading-5 tracking-normal text-slate-400">{format.note}</span>
          </label>
          <div className="md:col-span-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100">
            Impression Brother: choisir le même rouleau dans Windows, désactiver "adapter à la page", échelle 100%. Le rendu ci-dessous et la page imprimée utilisent exactement {pageWidth} x {pageHeight} mm.
          </div>
          <LabelInput label="Titre" value={label.title} onChange={(value) => update('title', value)} />
          <LabelInput label="Numero de serie" value={label.serial} onChange={(value) => update('serial', value)} />
          <LabelInput label="Marque" value={label.brand} onChange={(value) => update('brand', value)} />
          <LabelInput label="Modele" value={label.model} onChange={(value) => update('model', value)} />
          <LabelInput label="CPU" value={label.cpu} onChange={(value) => update('cpu', value)} />
          <LabelInput label="RAM" value={label.ram} onChange={(value) => update('ram', value)} />
          <LabelInput label="Disque" value={label.disk} onChange={(value) => update('disk', value)} />
          <LabelInput label="Batterie" value={label.battery} onChange={(value) => update('battery', value)} />
          <LabelInput label="Hostname" value={label.hostname} onChange={(value) => update('hostname', value)} />
          <LabelInput label="Adresse IP" value={label.ip} onChange={(value) => update('ip', value)} />
          <LabelInput label="Grade" value={label.grade} onChange={(value) => update('grade', value)} />
          <LabelInput label="Prix" value={label.price} onChange={(value) => update('price', value)} />
          <div className="md:col-span-2">
            <LabelInput label="Note" value={label.note} onChange={(value) => update('note', value)} />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={printPdf} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
              <Printer className="h-4 w-4" />
              PDF / Imprimer
            </button>
            <button type="button" onClick={printBrotherTest} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/15">
              <TestTube2 className="h-4 w-4" />
              Test rouleau
            </button>
            <button type="button" onClick={() => navigator.clipboard?.writeText(Object.values(label).filter(Boolean).join('\n'))} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]">
              <Copy className="h-4 w-4" />
              Copier texte
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Apercu Brother {pageWidth} x {pageHeight} mm</div>
          <div className="mb-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs leading-5 text-emerald-100">
            Sortie propre: texte gras, QR large, CODE128 noir, aucun point de troncature.
          </div>
          <div
            className={cn(
              'grid rounded-xl bg-white text-black shadow-2xl shadow-black/40 font-bold',
              slimLabel ? 'gap-1 px-7 py-2' : 'gap-2 px-5 py-4',
            )}
            style={{ aspectRatio: `${pageWidth} / ${pageHeight}`, gridTemplateRows: 'auto 1fr auto' }}
          >
            <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-start', slimLabel ? 'gap-2 pb-0.5' : 'gap-2 pb-2')}>
              <div className="min-w-0">
                <div className={cn('text-center font-black uppercase tracking-[0.12em]', slimLabel ? 'text-[6px]' : 'mb-1 text-[9px]')}>AtelierOS - Certified Device</div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
                  <div className={cn('truncate text-center font-black leading-tight', slimLabel ? 'text-[14px]' : 'text-xl')}>{printLabel.title}</div>
                  <div className={cn('grid shrink-0 place-items-center border border-black font-black', slimLabel ? 'h-5 w-5 text-xs' : 'h-9 w-9 text-xl')}>{label.grade}</div>
                </div>
              </div>
              {qrDataUrl ? <img src={qrDataUrl} alt="QR" className={cn('shrink-0 bg-white p-0.5', slimLabel ? 'h-12 w-12' : 'h-20 w-20')} /> : null}
            </div>
            <div className={cn('grid content-start', slimLabel ? 'gap-0.5' : 'gap-1')}>
            <LabelPreviewLine label="CPU" value={printLabel.cpu || '-'} slim={slimLabel} />
            <LabelPreviewLine label="RAM" value={printLabel.ram || '-'} slim={slimLabel} />
            <LabelPreviewLine label="SSD" value={printLabel.disk || '-'} slim={slimLabel} />
            <LabelPreviewLine label="BAT" value={printLabel.battery || '-'} slim={slimLabel} />
            {showNetworkOnLabel ? (
              <>
                <LabelPreviewLine label="HOST" value={printLabel.hostname || '-'} slim={slimLabel} />
                <LabelPreviewLine label="IP" value={printLabel.ip || '-'} slim={slimLabel} />
              </>
            ) : null}
          </div>
            <div className={cn('grid grid-cols-[minmax(0,1fr)_120px] items-end gap-2', slimLabel ? 'pt-0.5' : 'pt-1.5')}>
              <div className="min-w-0">
                <div className={cn('break-words font-mono font-black', slimLabel ? 'text-[8px]' : 'text-xs')}>SN: {printLabel.serial || '-'}</div>
                <div className={cn('truncate font-black uppercase text-black/70', slimLabel ? 'text-[6px]' : 'text-[10px]')}>{printLabel.note}</div>
              </div>
          <div className={cn('grid gap-1 font-bold', slimLabel ? 'text-[8px]' : 'text-[10px]')}>
                <div className="font-bold uppercase text-black/70">Code-barres</div>
                {barcodeDataUrl ? (
                  <img src={barcodeDataUrl} alt="Code-barres" className={cn('w-full object-fill', slimLabel ? 'h-7' : 'h-10')} />
                ) : <div className="rounded bg-amber-50 px-1 py-0.5 text-[9px] text-amber-900">Generation en cours...</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceModal>
  )
}

function LabelInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/30 focus:bg-white/[0.07]"
      />
    </label>
  )
}

function LabelPreviewLine({ label, value, slim, small }: { label: string; value: string; slim?: boolean; small?: boolean }) {
  return (
    <div className={cn('grid min-w-0 grid-cols-[30px_minmax(0,1fr)] items-center', slim ? 'h-4 gap-1' : 'h-7 gap-2')}>
      <div className={cn('truncate font-black uppercase text-black/60', slim ? 'text-[7px]' : 'text-[10px]')}>{label}</div>
      <div className={cn('truncate font-black leading-none', slim ? 'text-[8.5px]' : 'text-xs', small ? 'text-[8px] font-extrabold' : '')}>{value}</div>
    </div>
  )
}

function cleanLabelField(value: string | null | undefined) {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/["“”]/g, '"')
    .replace(/[’']/g, "'")
    .trim()
}

function compactLabelText(value: string, limit: number) {
  const normalized = cleanLabelField(value)
  if (normalized.length <= limit) return normalized
  return normalized.slice(0, Math.max(0, limit)).trim()
}

function fitLabelText(value: string, limit: number) {
  if (limit <= 0) return ''
  return compactLabelText(value, limit)
}

function cleanBarcodeValue(value: string | null | undefined) {
  return cleanLabelField(value)
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 36)
}

function labelRamSummary(audit: ForgePxeAuditSummary) {
  if (audit.ram) return audit.ram
  if (audit.ram_mb) {
    const gb = audit.ram_mb / 1024
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} Go`
  }
  return ''
}

function labelDiskSummary(audit: ForgePxeAuditSummary) {
  if (audit.main_disk) return audit.main_disk
  const disk = audit.disks.find((item) => item.size_gb || item.model || item.text)
  if (!disk) return ''
  const size = disk.size_gb ? `${disk.size_gb >= 1000 ? `${(disk.size_gb / 1000).toFixed(1)} To` : `${Math.round(disk.size_gb)} Go`}` : ''
  const type = disk.type ? disk.type.toUpperCase() : ''
  const model = disk.model || disk.text || ''
  return [size, type, model].filter(Boolean).join(' ')
}

function labelBatterySummary(audit: ForgePxeAuditSummary) {
  const battery = audit.battery.find((item) => item.health_percent != null || item.wear_percent != null || item.cycle_count)
  if (!battery) return audit.battery_status || 'Aucune batterie'
  const parts = []
  if (battery.health_percent != null) parts.push(`Sante ${Math.round(battery.health_percent)}%`)
  if (battery.wear_percent != null) parts.push(`Usure ${Math.round(battery.wear_percent)}%`)
  if (battery.cycle_count) parts.push(`${battery.cycle_count} cycles`)
  return parts.join(' ') || audit.battery_status || 'Batterie detectee'
}

function dedupeMachineTitle(brand?: string | null, model?: string | null) {
  const cleanBrand = cleanLabelField(brand)
  const cleanModel = cleanLabelField(model)
  if (!cleanBrand && !cleanModel) return 'Machine inconnue'
  if (!cleanBrand) return cleanModel
  if (!cleanModel) return cleanBrand
  const brandKey = cleanBrand.toLowerCase()
  const modelKey = cleanModel.toLowerCase()
  if (modelKey === brandKey || modelKey.startsWith(`${brandKey} `)) return cleanModel
  return `${cleanBrand} ${cleanModel}`
}

function dedupeAdjacentWords(value: string) {
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  return words.filter((word, index) => index === 0 || word.toLowerCase() !== words[index - 1].toLowerCase()).join(' ')
}

function compactMachineTitle(value: string, limit: number) {
  return compactLabelText(dedupeAdjacentWords(value), limit)
}

function compactCpuLabel(value: string, limit = 36) {
  return compactLabelText(
    value
      .replace(/\(R\)|\(TM\)/g, '')
      .replace(/\bCPU\b/gi, '')
      .replace(/\s*@\s*/g, ' @ ')
      .replace(/\s+/g, ' ')
      .trim(),
    limit,
  )
}

function compactRamLabel(value: string, limit = 10) {
  return compactLabelText(
    value
      .replace(/\bMemory\b/gi, '')
      .replace(/\bRAM\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim(),
    limit,
  )
}

function compactDiskLabel(value: string, limit = 30) {
  return compactLabelText(
    value
      .replace(/\bNVMe\b/gi, 'NVMe')
      .replace(/\bKINGSTON\b/gi, 'Kingston')
      .replace(/\s+/g, ' ')
      .trim(),
    limit,
  )
}

function compactBatteryLabel(value: string, limit = 34) {
  return compactLabelText(
    value
      .replace(/\bSante\b/gi, 'Sante')
      .replace(/\bUsure\b/gi, 'Usure')
      .replace(/\s+/g, ' ')
      .trim(),
    limit,
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function RemoteActionButton({
  label,
  action,
  danger,
  disabled,
  onClick,
}: {
  label: string
  action: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={action}
      className={cn(
        'rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        danger
          ? 'border-rose-300/20 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15'
          : 'border-violet-300/20 bg-violet-300/10 text-violet-100 hover:bg-violet-300/15',
      )}
    >
      {label}
    </button>
  )
}

function liveClientForAudit(audit: ForgePxeAuditSummary, clients: ForgePxeClient[]) {
  const mac = normalizeKey(audit.mac)
  const serial = normalizeKey(audit.serial_number)
  const ip = normalizeKey(audit.ip)
  return clients.find((client) => (
    normalizeKey(client.mac) === mac ||
    normalizeKey(client.serial_number) === serial ||
    normalizeKey(client.ip) === ip
  )) ?? null
}

function normalizeKey(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function driverPackForAudit(audit: ForgePxeAuditSummary, packs: ForgeDriverPack[]) {
  const brand = (audit.brand || '').trim().toLowerCase()
  const model = (audit.model || '').trim().toLowerCase()
  return packs.find((pack) => (
    pack.source_audit_id === audit.id ||
    (brand && model && pack.vendor.trim().toLowerCase() === brand && pack.model_family.trim().toLowerCase() === model)
  )) ?? null
}

function machineName(audit: ForgePxeAuditSummary) {
  return dedupeMachineTitle(audit.brand, audit.model)
}

function buildAuditLabelLines(audit: ForgePxeAuditSummary) {
  return [
    machineName(audit),
    `HOST: ${audit.hostname || '-'}`,
    `IP: ${audit.ip || '-'}`,
    `SN: ${audit.serial_number || '-'}`,
    `CPU: ${audit.cpu || '-'}`,
    `RAM: ${audit.ram || (audit.ram_mb ? `${audit.ram_mb} MB` : '-')}`,
    `DISQUE: ${audit.main_disk || '-'}`,
    `BAT: ${audit.battery_status || 'Aucune batterie'}`,
  ]
}

function auditHardwareComplete(audit: ForgePxeAuditSummary) {
  return Boolean(audit.brand && audit.model && audit.cpu && (audit.ram || audit.ram_mb) && audit.main_disk)
}

const workshopRequiredTests = [
  { key: 'pixel', label: 'Pixels', short: 'LCD' },
  { key: 'keyboard', label: 'Clavier', short: 'KB' },
  { key: 'usb', label: 'USB', short: 'USB' },
  { key: 'audio', label: 'Audio', short: 'AUD' },
  { key: 'microphone', label: 'Micro', short: 'MIC' },
  { key: 'camera', label: 'Camera', short: 'CAM' },
] as const

function workshopTestSummary(audit: ForgePxeAuditSummary) {
  const tests = workshopTests(audit)
  const byKey = new Map(tests.map((test) => [test.key, test]))
  const missing = workshopRequiredTests.filter((required) => !byKey.has(required.key)).map((item) => item.label)
  const failed = tests.filter((test) => test.value !== 'ok').map((test) => test.label)
  const ok = tests.filter((test) => test.value === 'ok').length
  return {
    total: workshopRequiredTests.length,
    done: tests.length,
    ok,
    missing,
    failed,
    complete: missing.length === 0 && failed.length === 0,
  }
}

function auditCompletionSummary(audit: ForgePxeAuditSummary) {
  const missing: string[] = []
  if (!audit.brand || !audit.model) missing.push('marque/modele')
  if (!audit.cpu) missing.push('processeur')
  if (!audit.ram && !audit.ram_mb) missing.push('RAM')
  if (!audit.main_disk) missing.push('disque')
  const tests = workshopTestSummary(audit)
  if (tests.missing.length) missing.push(`tests: ${tests.missing.join(', ')}`)
  if (tests.failed.length) missing.push(`NOK: ${tests.failed.join(', ')}`)
  return {
    missing,
    complete: missing.length === 0,
  }
}

function auditNextAction(audit: ForgePxeAuditSummary) {
  const hardwareComplete = auditHardwareComplete(audit)
  const tests = workshopTestSummary(audit)
  const batteryAlert = audit.battery.some((item) => (item.wear_percent ?? 0) >= 30)
  const diskAlert = audit.disks.some((disk) => disk.smart && disk.smart !== 'passed')

  if (!hardwareComplete) {
    return {
      label: 'Infos manquantes',
      detail: 'Relance Audit rapide texte pour recuperer CPU, RAM, disque et batterie avant etiquette.',
      tone: 'bad' as const,
    }
  }
  if (batteryAlert || diskAlert) {
    return {
      label: 'A verifier',
      detail: 'Le materiel est identifie, mais batterie ou disque demande un controle avant vente.',
      tone: 'warn' as const,
    }
  }
  if (!tests.done) {
    return {
      label: 'Tests a faire',
      detail: 'Relance Audit rapide graphique pour clavier, pixels, USB, camera, micro et audio.',
      tone: 'warn' as const,
    }
  }
  if (!tests.complete) {
    return {
      label: 'Tests incomplets',
      detail: `A finir: ${[...tests.missing, ...tests.failed].join(', ')}.`,
      tone: 'warn' as const,
    }
  }
  return {
    label: 'Pret etiquette',
    detail: 'Audit materiel complet et tests atelier valides. La machine peut etre etiquetee.',
    tone: 'ok' as const,
  }
}

function auditTicketStatus(audit: ForgePxeAuditSummary, driverPack: ForgeDriverPack | null) {
  const completion = auditCompletionSummary(audit)
  const tests = workshopTestSummary(audit)
  const batteryAlert = audit.battery.some((item) => (item.wear_percent ?? 0) >= 30)
  const diskAlert = audit.disks.some((disk) => disk.smart && disk.smart !== 'passed')

  if (diskAlert) {
    return {
      label: 'Disque a controler',
      detail: 'SMART different de passed. Controle ou remplacement disque avant vente.',
      tone: 'bad' as const,
    }
  }
  if (batteryAlert) {
    return {
      label: 'Batterie a controler',
      detail: 'Usure batterie elevee. Prevoir remplacement ou mention atelier.',
      tone: 'warn' as const,
    }
  }
  if (!tests.complete) {
    return {
      label: 'Tests a terminer',
      detail: tests.missing.length ? `Manque: ${tests.missing.join(', ')}` : 'Tests presents mais pas tous OK.',
      tone: 'warn' as const,
    }
  }
  if (!completion.complete) {
    return {
      label: 'Audit incomplet',
      detail: `Champs manquants: ${completion.missing.join(', ')}`,
      tone: 'warn' as const,
    }
  }
  if (!driverPack) {
    return {
      label: 'Drivers manquants',
      detail: 'Aucun pack pilote lie au modele. Preparer le pack avant deploiement en serie.',
      tone: 'warn' as const,
    }
  }
  return {
    label: 'Pret vente',
    detail: 'Audit complet, tests OK et pack pilote associe.',
    tone: 'ok' as const,
  }
}

function hasWorkshopTests(audit: ForgePxeAuditSummary) {
  return workshopTests(audit).length > 0
}

function workshopTests(audit: ForgePxeAuditSummary) {
  const rawTests = audit.raw?.workshop_tests
  if (!rawTests || typeof rawTests !== 'object') return []
  const tests = rawTests as Record<string, unknown>
  return workshopRequiredTests
    .map((item) => ({ ...item, value: tests[item.key] }))
    .map((item) => ({ ...item, value: typeof item.value === 'string' ? item.value : 'not_run' }))
    .filter((item) => item.value !== 'not_run')
}

function htmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildAuditReportHtml(audit: ForgePxeAuditSummary, autoPrint = false) {
  const tests = workshopTestSummary(audit)
  const completion = auditCompletionSummary(audit)
  const rows = [
    ['Marque / modele', machineName(audit)],
    ['Serie', audit.serial_number || '-'],
    ['CPU', audit.cpu || '-'],
    ['RAM', labelRamSummary(audit) || '-'],
    ['Disque', labelDiskSummary(audit) || '-'],
    ['Batterie', labelBatterySummary(audit)],
    ['Grade propose', audit.grade_proposed || '-'],
    ['IP / MAC', `${audit.ip || '-'} / ${audit.mac || '-'}`],
    ['Fichier audit', audit.filename],
  ]
  const testRows = workshopRequiredTests.map((required) => {
    const test = workshopTests(audit).find((item) => item.key === required.key)
    return [required.label, (test?.value || 'manquant').toUpperCase()]
  })
  const diskRows = audit.disks.length
    ? audit.disks.map((disk, index) => [`Disque ${index + 1}`, `${disk.model || disk.text || '-'} ${disk.size_gb ? `${disk.size_gb} GB` : ''} SMART: ${disk.smart || 'inconnu'}`])
    : [['Disques detailles', 'Non remontes']]
  const batteryRows = audit.battery.length
    ? audit.battery.map((battery, index) => [`Batterie ${index + 1}`, `${battery.name || battery.label || '-'} usure ${battery.wear_percent ?? '-'}% sante ${battery.health_percent ?? '-'}% cycles ${battery.cycle_count || '-'}`])
    : [['Batterie detaillee', 'Non remontee']]

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Audit ${htmlEscape(machineName(audit))}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
    header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 12px; }
    h1 { margin: 0; font-size: 24px; }
    h2 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .12em; color: #334155; }
    .status { border: 1px solid ${completion.complete ? '#10b981' : '#f59e0b'}; background: ${completion.complete ? '#ecfdf5' : '#fffbeb'}; color: #111827; border-radius: 8px; padding: 10px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
    td { border: 1px solid #d1d5db; padding: 7px 8px; font-size: 12px; vertical-align: top; }
    td:first-child { width: 34%; background: #f8fafc; color: #475569; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .ok { color: #047857; font-weight: 700; }
    .warn { color: #b45309; font-weight: 700; }
    footer { margin-top: 18px; color: #64748b; font-size: 11px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${htmlEscape(machineName(audit))}</h1>
  <div>Rapport audit atelier AtelierOS</div>
    </div>
    <div class="status">${completion.complete ? 'AUDIT COMPLET' : `AUDIT INCOMPLET - ${htmlEscape(completion.missing.join(', '))}`}</div>
  </header>
  <h2>Identification</h2>
  <table>${rows.map(([label, value]) => `<tr><td>${htmlEscape(label)}</td><td>${htmlEscape(value)}</td></tr>`).join('')}</table>
  <div class="grid">
    <div>
      <h2>Tests atelier (${tests.ok}/${tests.total} OK)</h2>
      <table>${testRows.map(([label, value]) => `<tr><td>${htmlEscape(label)}</td><td class="${value === 'OK' ? 'ok' : 'warn'}">${htmlEscape(value)}</td></tr>`).join('')}</table>
    </div>
    <div>
      <h2>Stockage / batterie</h2>
      <table>${[...diskRows, ...batteryRows].map(([label, value]) => `<tr><td>${htmlEscape(label)}</td><td>${htmlEscape(value)}</td></tr>`).join('')}</table>
    </div>
  </div>
  <footer>Genere depuis AtelierOS le ${htmlEscape(new Date().toLocaleString('fr-FR'))}. Fichier source: ${htmlEscape(audit.filename)}</footer>
  ${autoPrint ? "<script>window.addEventListener('load', () => window.print())</script>" : ''}
</body>
</html>`
}

function printAuditReport(audit: ForgePxeAuditSummary) {
  const html = buildAuditReportHtml(audit, true)
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=920,height=1100')
  if (!popup) return
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
}

function downloadAuditReport(audit: ForgePxeAuditSummary) {
  const reference = [audit.brand, audit.model, audit.serial_number || audit.hostname || audit.mac || audit.id]
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'audit-machine'
  downloadTextFile(`atelieros-${reference}-${new Date().toISOString().slice(0, 10)}.html`, buildAuditReportHtml(audit, false))
}

function InfoRow({ label, value, mono, tone }: { label: string; value: ReactNode; mono?: boolean; tone?: 'ok' | 'warn' }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className={cn('min-w-0 break-words text-right text-slate-200', mono && 'font-mono text-xs', tone === 'ok' && 'text-emerald-100', tone === 'warn' && 'text-amber-200')}>
        {value}
      </span>
    </div>
  )
}
function BootModule() {
  return (
    <div className="space-y-6">
      <PageTitle title="Boot UEFI" description="Controle du DHCP proxy, du TFTP, de wimboot et de la chaine iPXE." icon={Cpu} />
      <TopologyPanel />
    </div>
  )
}

function ImagesModule({
  assets,
  images,
  builds,
  recipes,
  unattendProfiles,
  deploymentProfiles,
  driverPacks,
  generatedScript,
  generatedUnattendXml,
  isCreating,
  onCreateImage,
  onBuildWim,
  onUploadMedia,
  onCheckMedia,
  serverMediaFiles,
  externalMediaSources,
  onRefreshMediaFiles,
  onImportExternalMediaSource,
  onDeleteMediaFile,
  onChecksumMediaFile,
  onCreateImageFromMedia,
  onPrepareIsoMedia,
  onInspectWimIndexes,
  checkStatusMessage,
  uploadMessage,
  onClearMessages,
  onSetDefaultImage,
  onDeleteImage,
  onCreateRecipe,
  onLoadScript,
  onCreateUnattendProfile,
  onSetDefaultUnattendProfile,
  onDeleteUnattendProfile,
  onLoadUnattendXml,
  onCreateDeploymentProfile,
  onSetDefaultDeploymentProfile,
  onDeleteDeploymentProfile,
}: {
  assets: ForgePxeAsset[]
  images: ForgeWimImage[]
  builds: ForgeWimBuildSummary[]
  recipes: ForgeWimRecipe[]
  unattendProfiles: ForgeUnattendProfile[]
  deploymentProfiles: ForgeDeploymentProfile[]
  driverPacks: ForgeDriverPack[]
  generatedScript: string | null
  generatedUnattendXml: string | null
  isCreating: boolean
  onCreateImage: (image: Omit<ForgeWimImage, 'id' | 'status' | 'is_default' | 'created_at'>) => Promise<void>
  onBuildWim: (imageId: string, payload: { reference?: string; version?: string; notes?: string; image_index?: number }) => Promise<ForgeWimBuildResponse | null>
  onUploadMedia: (
    file: File,
    kind: 'iso' | 'image',
    name: string,
    version: string,
    architecture: string,
    overwrite: boolean,
    onProgress: (percent: number | null) => void,
  ) => Promise<void>
  onCheckMedia: (file: File, kind: 'iso' | 'image') => Promise<ForgeMediaStatusResponse | null>
  serverMediaFiles: ForgeServerMediaFile[]
  externalMediaSources: ForgeExternalMediaSource[]
  onRefreshMediaFiles: () => Promise<void>
  onImportExternalMediaSource: (source: ForgeExternalMediaSource) => Promise<ForgeExternalMediaImportResponse | null>
  onDeleteMediaFile: (file: ForgeServerMediaFile) => Promise<void>
  onChecksumMediaFile: (file: ForgeServerMediaFile) => Promise<ForgeServerMediaChecksumResponse | null>
  onCreateImageFromMedia: (file: ForgeServerMediaFile) => Promise<void>
  onPrepareIsoMedia: (file: ForgeServerMediaFile, imageIndex?: number) => Promise<void>
  onInspectWimIndexes: (sourcePath: string) => Promise<ForgeWimIndex[]>
  checkStatusMessage: string
  uploadMessage: string | null
  onClearMessages: () => void
  onSetDefaultImage: (imageId: string) => Promise<void>
  onDeleteImage: (imageId: string) => Promise<void>
  onCreateRecipe: (recipe: Omit<ForgeWimRecipe, 'id' | 'created_at'>) => Promise<void>
  onLoadScript: (recipeId: string) => Promise<void>
  onCreateUnattendProfile: (profile: Omit<ForgeUnattendProfile, 'id' | 'is_default' | 'created_at'>) => Promise<void>
  onSetDefaultUnattendProfile: (profileId: string) => Promise<void>
  onDeleteUnattendProfile: (profileId: string) => Promise<void>
  onLoadUnattendXml: (profileId: string) => Promise<void>
  onCreateDeploymentProfile: (profile: Omit<ForgeDeploymentProfile, 'id' | 'image_name' | 'unattend_name' | 'driver_pack_names' | 'is_default' | 'created_at'>) => Promise<void>
  onSetDefaultDeploymentProfile: (profileId: string) => Promise<void>
  onDeleteDeploymentProfile: (profileId: string) => Promise<void>
}) {
  const [activeTool, setActiveTool] = useState<'assets' | 'images' | 'browse' | 'wim' | 'unattend' | 'profiles' | null>('browse')
  const defaultImage = images.find((image) => image.is_default)
  const readyImages = images.filter((image) => image.status === 'ready').length
  const defaultImageReady = Boolean(defaultImage && defaultImage.status === 'ready')
  const readyAssets = assets.filter((asset) => asset.status === 'ready').length
  const missingAssets = assets.filter((asset) => asset.status !== 'ready').length
  const defaultUnattend = unattendProfiles.find((profile) => profile.is_default)
  const defaultDeploymentProfile = deploymentProfiles.find((profile) => profile.is_default)
  const serverIsoCount = serverMediaFiles.filter((file) => file.kind === 'iso').length
  const serverImageCount = serverMediaFiles.filter((file) => file.kind === 'image').length
  const deployReadiness = [
    { label: 'Image WIM declaree', ok: images.length > 0, detail: images.length ? `${images.length} image(s)` : 'Importer ou declarer un WIM/ESD' },
    { label: 'Image par defaut', ok: defaultImageReady, detail: defaultImage?.name ?? 'Definir une image par defaut' },
    { label: 'Unattend par defaut', ok: Boolean(defaultUnattend), detail: defaultUnattend?.name ?? 'Creer/choisir un profil Unattend' },
    { label: 'Profil complet', ok: Boolean(defaultDeploymentProfile), detail: defaultDeploymentProfile?.name ?? 'Image + Unattend + drivers' },
  ]
  const deployReady = deployReadiness.every((item) => item.ok)
  const nextWimAction = (() => {
    if (!serverIsoCount && !serverImageCount && !images.length) return { label: 'Importer une ISO', tool: 'browse' as const, tone: 'cyan' as const }
    if (serverIsoCount && !builds.length && !images.length) return { label: 'Creer le WIM', tool: 'browse' as const, tone: 'emerald' as const }
    if (images.length && !defaultImageReady) return { label: 'Definir image par defaut', tool: 'images' as const, tone: 'amber' as const }
    if (!defaultUnattend) return { label: 'Creer Unattend', tool: 'unattend' as const, tone: 'amber' as const }
    if (!defaultDeploymentProfile) return { label: 'Creer profil complet', tool: 'profiles' as const, tone: 'cyan' as const }
    return { label: 'Pret a deployer', tool: 'profiles' as const, tone: 'emerald' as const }
  })()
  const workspaceRef = useRef<HTMLElement | null>(null)
  const activeToolLabel = {
    assets: 'Assets PXE',
    images: 'Image PXE',
    browse: 'Importer ISO/WIM',
    wim: 'Creer WIM',
    unattend: 'Unattend',
    profiles: 'Profil complet',
  }[activeTool ?? 'browse']
  const openTool = (tool: NonNullable<typeof activeTool>) => {
    setActiveTool(tool)
    window.requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const exportDeploymentChecklist = () => {
    const lines = [
      'AtelierOS - Checklist deploiement Windows PXE',
      `Genere le ${new Date().toLocaleString('fr-FR')}`,
      '',
      'Etat global',
      `- Statut: ${deployReady ? 'PRET A DEPLOYER' : 'A COMPLETER'}`,
      `- Prochaine action: ${nextWimAction.label}`,
      '',
      'Controles obligatoires',
      ...deployReadiness.map((item) => `- [${item.ok ? 'OK' : 'A FAIRE'}] ${item.label}: ${item.detail}`),
      '',
      'Image par defaut',
      `- Nom: ${defaultImage?.name ?? 'Aucune'}`,
      `- Version: ${defaultImage?.version ?? '-'}`,
      `- Architecture: ${defaultImage?.architecture ?? '-'}`,
      `- Chemin: ${defaultImage?.path ?? '-'}`,
      '',
      'Profil Unattend',
      `- Profil par defaut: ${defaultUnattend?.name ?? 'Aucun'}`,
      `- Mode: ${defaultUnattend?.deployment_mode ?? '-'}`,
      '',
      'Profil complet',
      `- Profil par defaut: ${defaultDeploymentProfile?.name ?? 'Aucun'}`,
      `- Drivers associes: ${defaultDeploymentProfile?.driver_pack_names.join(', ') || '-'}`,
      '',
      'Stockage serveur',
      `- ISO detectes: ${serverIsoCount}`,
      `- WIM/ESD detectes: ${serverImageCount}`,
      `- Packs drivers: ${driverPacks.length}`,
      `- Assets PXE prets: ${readyAssets}/${Math.max(assets.length, 1)}`,
      '',
      'Procedure',
      '1. Importer ou verifier le fichier ISO/WIM/ESD.',
      '2. Preparer le WIM si la source est une ISO.',
      '3. Declarer l image Windows et la definir par defaut.',
      '4. Definir le profil Unattend par defaut.',
      '5. Associer drivers et image dans un profil complet.',
      '6. Lancer un PC test en PXE avant production.',
      '',
    ].join('\n')
    downloadTextFile(`atelieros-checklist-wim-${new Date().toISOString().slice(0, 10)}.txt`, lines)
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Images WIM" description="Parcours court : ISO/WIM vers image Windows prete pour PXE." icon={Database} />

      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4 shadow-xl shadow-black/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Assistant rapide</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Le technicien suit une seule ligne : envoyer l'ISO ou le WIM, preparer l'image, choisir le profil, puis deploiement PXE.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openTool(nextWimAction.tool)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition',
              nextWimAction.tone === 'emerald'
                ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15'
                : nextWimAction.tone === 'amber'
                  ? 'border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15'
                  : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15',
            )}
          >
            {nextWimAction.label}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          {[
            { id: 'browse' as const, label: '1. Importer', detail: 'ISO, WIM ou ESD', tone: 'cyan' },
            { id: 'wim' as const, label: '2. Creer WIM', detail: 'Preparation DISM', tone: 'emerald' },
            { id: 'images' as const, label: '3. Image PXE', detail: 'Defaut serveur', tone: 'amber' },
            { id: 'unattend' as const, label: '4. Unattend', detail: 'Standard ou marketplace', tone: 'cyan' },
            { id: 'profiles' as const, label: '5. Profil pret', detail: 'Image + drivers', tone: 'emerald' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openTool(item.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                activeTool === item.id
                  ? 'border-cyan-300/35 bg-cyan-300/12 shadow-lg shadow-cyan-500/10'
                  : 'border-white/10 bg-black/20 hover:border-cyan-300/25 hover:bg-white/[0.05]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                {activeTool === item.id ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : null}
              </div>
              <div className="mt-1 text-xs text-slate-400">{item.detail}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard metric={{ id: 'wim-images', label: 'Images pretes', value: `${readyImages}/${images.length}`, detail: defaultImage?.name ?? 'Aucune image par defaut', trend: defaultImageReady ? 'prête' : 'image manquante', tone: readyImages ? 'emerald' : 'amber' }} />
        <MetricCard metric={{ id: 'deploy-profiles', label: 'Profils complets', value: String(deploymentProfiles.length), detail: defaultDeploymentProfile?.name ?? 'image + unattend + drivers', trend: defaultDeploymentProfile ? 'défaut actif' : 'à créer', tone: defaultDeploymentProfile ? 'emerald' : 'amber' }} />
        <MetricCard metric={{ id: 'unattend', label: 'Unattend', value: String(unattendProfiles.length), detail: 'installations automatisées', trend: unattendProfiles.some((profile) => profile.is_default) ? 'défaut actif' : 'à configurer', tone: unattendProfiles.length ? 'emerald' : 'amber' }} />
        <MetricCard metric={{ id: 'assets', label: 'Assets PXE', value: `${readyAssets}/${Math.max(assets.length, 1)}`, detail: `${missingAssets} ressource(s) à préparer`, trend: missingAssets ? 'attention' : 'prêt', tone: missingAssets ? 'amber' : 'emerald' }} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5 shadow-xl shadow-black/20">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Validation avant PXE</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">Lecture rapide avant de booter une machine : image, Unattend, profil et assets doivent etre verts.</p>
          </div>
          <button
            type="button"
            onClick={exportDeploymentChecklist}
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
          >
            Export checklist
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Etat deploiement Windows</h3>
              <p className="mt-1 text-xs text-slate-500">Lecture rapide avant de lancer un PC en PXE.</p>
            </div>
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', deployReady ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/25 bg-amber-300/10 text-amber-200')}>
              {deployReady ? 'Pret a deployer' : 'A completer'}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            {deployReadiness.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]', item.ok ? 'bg-emerald-300 text-emerald-300' : 'bg-amber-300 text-amber-300')} />
                  <div className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
                </div>
                <div className="mt-2 truncate text-sm font-semibold text-white">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Serveur: {serverIsoCount} ISO, {serverImageCount} WIM/ESD detecte(s). Si le fichier vient d'etre envoye, utiliser Rafraichir dans Importer.
          </div>
        </div>
      </section>

      <section ref={workspaceRef} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5 scroll-mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Espace de travail</h2>
            <p className="text-sm text-slate-400">{activeTool ? `Module actif : ${activeToolLabel}` : 'Choisis une action pour afficher le module d’édition.'}</p>
          </div>
          {activeTool && (
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Fermer
            </button>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
          {!activeTool && (
            <div className="text-sm text-slate-400">Aucun module actif. Choisis une des 3 étapes au-dessus.</div>
          )}

          {activeTool === 'assets' && <AssetPanel assets={assets} />}
          {activeTool === 'images' && (
            <WimImageInventory images={images} isSaving={isCreating} onCreateImage={onCreateImage} onBuildWim={onBuildWim} onSetDefaultImage={onSetDefaultImage} onDeleteImage={onDeleteImage} />
          )}
          {activeTool === 'browse' && (
            <MediaUploadPanel
              images={images}
              isSaving={isCreating}
              onUploadMedia={onUploadMedia}
              onCheckMedia={onCheckMedia}
              serverMediaFiles={serverMediaFiles}
              externalMediaSources={externalMediaSources}
              onRefreshMediaFiles={onRefreshMediaFiles}
              onImportExternalMediaSource={onImportExternalMediaSource}
              onDeleteMediaFile={onDeleteMediaFile}
              onChecksumMediaFile={onChecksumMediaFile}
              onCreateImageFromMedia={onCreateImageFromMedia}
              onPrepareIsoMedia={onPrepareIsoMedia}
              onInspectWimIndexes={onInspectWimIndexes}
              checkStatusMessage={checkStatusMessage}
              uploadMessage={uploadMessage}
              onClearMessages={onClearMessages}
            />
          )}
          {activeTool === 'wim' && (
            <WimCreatorPanel recipes={recipes} generatedScript={generatedScript} isCreating={isCreating} onCreateRecipe={onCreateRecipe} onLoadScript={onLoadScript} />
          )}
          {activeTool === 'unattend' && (
            <UnattendPanel
              profiles={unattendProfiles}
              generatedXml={generatedUnattendXml}
              isSaving={isCreating}
              onCreateProfile={onCreateUnattendProfile}
              onSetDefaultProfile={onSetDefaultUnattendProfile}
              onDeleteProfile={onDeleteUnattendProfile}
              onLoadXml={onLoadUnattendXml}
            />
          )}
          {activeTool === 'profiles' && (
            <DeploymentProfilesPanel
              profiles={deploymentProfiles}
              images={images}
              unattendProfiles={unattendProfiles}
              driverPacks={driverPacks}
              isSaving={isCreating}
              onCreateProfile={onCreateDeploymentProfile}
              onSetDefaultProfile={onSetDefaultDeploymentProfile}
              onDeleteProfile={onDeleteDeploymentProfile}
            />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5 shadow-xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Etat de publication</h2>
            <p className="mt-1 text-sm text-slate-400">Résumé court. Les options secondaires restent disponibles sans gêner le flux principal.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openTool('unattend')} className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/15">Unattend</button>
            <button type="button" onClick={() => openTool('profiles')} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15">Profil complet</button>
            <button type="button" onClick={() => openTool('assets')} className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15">Assets PXE</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Image par defaut</div>
            <div className="mt-2 text-sm font-semibold text-white">{defaultImage?.name ?? 'Non definie'}</div>
            <div className={cn('mt-1 text-xs', defaultImageReady ? 'text-emerald-300' : 'text-amber-300')}>{defaultImageReady ? 'Prete pour PXE' : 'En attente'}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Derniere image</div>
            <div className="mt-2 text-sm font-semibold text-white">{images[0]?.name ?? recipes[0]?.name ?? 'Aucune'}</div>
            <div className="mt-1 text-xs text-slate-400">Statut : {images[0]?.status ?? 'N/A'}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Unattend actif</div>
            <div className="mt-2 text-sm font-semibold text-white">{unattendProfiles.find((profile) => profile.is_default)?.name ?? 'Aucun defini'}</div>
            <div className="mt-1 text-xs text-slate-400">Profil complet : {defaultDeploymentProfile?.name ?? 'Non defini'}</div>
          </div>
        </div>
        {builds.length ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Procedures WIM preparees</div>
                <div className="mt-1 text-xs text-slate-500">Dossiers generes avec manifest, README et script PowerShell.</div>
              </div>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">{builds.length}</span>
            </div>
            <div className="max-h-80 overflow-auto grid gap-2 xl:grid-cols-2">
              {builds.map((build) => (
                <div key={build.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-white">{build.reference} {build.version}</div>
                    <span className="text-[11px] text-slate-500">{new Date(build.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-400">Source: {build.source_name}</div>
                  <div className="mt-1 text-xs text-slate-300">
                    Statut: <span className={build.status === 'completed' ? 'text-emerald-300' : build.status === 'failed' ? 'text-red-300' : 'text-amber-300'}>{build.status}</span>
                    {typeof build.progress === 'number' ? ` (${build.progress}%)` : ''}
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, build.progress))}%` }}
                    />
                  </div>
                  <div className="mt-2 truncate font-mono text-xs text-cyan-200">{build.smb_path}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {activeTool === null && (
        <section className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5">
          <div className="grid gap-3 text-sm text-slate-400 md:grid-cols-[180px_1fr]">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Chemin conseille</div>
              <div className="mt-2 text-white">Importer, creer, definir</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => openTool('browse')} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-left text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15">1. Importer ISO/WIM</button>
              <button type="button" onClick={() => openTool('wim')} className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-left text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15">2. Creer WIM</button>
              <button type="button" onClick={() => openTool('images')} className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-left text-xs font-semibold text-amber-100 transition hover:bg-amber-300/15">3. Image par defaut</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function DriversModule({
  driverPacks,
  audits,
  isSaving,
  onCreateDriverPack,
  onExtractDriverPack,
  onDeleteDriverPack,
}: {
  driverPacks: ForgeDriverPack[]
  audits: ForgePxeAuditSummary[]
  isSaving: boolean
  onCreateDriverPack: (pack: Omit<ForgeDriverPack, 'id' | 'status' | 'created_at'>) => Promise<void>
  onExtractDriverPack: (packId: string) => Promise<void>
  onDeleteDriverPack: (packId: string) => Promise<void>
}) {
  return (
    <div className="space-y-6">
      <PageTitle title="Pilotes" description="Catalogue driver-store pour boot WinPE et post-install Windows." icon={HardDrive} />
      <DriversPanel
        driverPacks={driverPacks}
        audits={audits}
        isSaving={isSaving}
        onCreateDriverPack={onCreateDriverPack}
        onExtractDriverPack={onExtractDriverPack}
        onDeleteDriverPack={onDeleteDriverPack}
      />
    </div>
  )
}

function LogsModule({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="space-y-6">
      <PageTitle title="Logs" description="Console technique temps reel pour deploy-api, dnsmasq, WinPE et TFTP." icon={Terminal} />
      <LogConsole logs={logs} />
    </div>
  )
}

function GuideModule({
  status,
  config,
  backups,
  systemReport,
  isSaving,
  backupMessage,
  onCreateBackup,
  onRefreshBackups,
  onDeleteBackup,
  onDownloadBackup,
  onRestoreBackup,
  onLoadSystemReport,
}: {
  status: ForgePxeStatus | null
  config: ForgePxeConfig | null
  backups: ForgeApplianceBackup[]
  systemReport: ForgeSystemReportResponse | null
  isSaving: boolean
  backupMessage: string | null
  onCreateBackup: () => Promise<void>
  onRefreshBackups: () => Promise<void>
  onDeleteBackup: (filename: string) => Promise<void>
  onDownloadBackup: (filename: string) => Promise<void>
  onRestoreBackup: (filename: string, dryRun: boolean) => Promise<void>
  onLoadSystemReport: () => Promise<void>
}) {
  const host = typeof window === 'undefined' ? 'serveur' : window.location.hostname
  const dashboardUrl = `http://${host}/`
  const mobileUrl = `http://${host}/mobile`
  const mobileConfigUrl = `aosdeploy://configure?url=${encodeURIComponent(mobileUrl)}`
  const apiUrl = `http://${host}:8000/api`
  const pxeUrl = status?.server_url || config?.server_url || `http://${host}:1950`
  const share = status?.smb_share || config?.smb_share || `\\\\${host}\\deploy`
  const services = status?.services ?? []
  const [mobileQr, setMobileQr] = useState('')
  const [guideTab, setGuideTab] = useState<'install' | 'diagnostic' | 'faq' | 'backup'>('install')
  const serviceOk = (needle: string) => services.some((service) => `${service.key} ${service.label}`.toLowerCase().includes(needle) && service.status === 'online')
  const offlineServices = services.filter((service) => service.status !== 'online')
  const steps = [
    { title: '1. Brancher le serveur', detail: 'Verifier que le serveur AtelierOS est sur le meme reseau que les PC atelier.', ok: Boolean(status), action: dashboardUrl },
    { title: '2. Controler les services', detail: 'API, HTTP PXE et partage reseau doivent etre verts avant production.', ok: serviceOk('api') && serviceOk('http') },
    { title: '3. Ouvrir le stockage', detail: `Deposer ISO, WIM et drivers dans ${share}.`, ok: Boolean(share), action: share },
    { title: '4. Tester un client PXE', detail: 'Demarrer un PC en boot reseau, lancer Audit rapide, attendre le retour dans Audit.', ok: Boolean(status?.clients?.length || status?.assets?.length) },
    { title: '5. Installer le terminal EA520', detail: `Ouvrir ${mobileUrl}, puis scanner les etiquettes machine.`, ok: true, action: mobileUrl },
    { title: '6. Imprimer une etiquette', detail: 'Depuis Audit, ouvrir Editeur etiquette puis imprimer en format Brother adapte.', ok: true },
  ]
  const exportGuide = () => {
    const generatedAt = new Date().toLocaleString('fr-FR')
    const serviceLines = services.length
      ? services.map((service) => `- ${service.label || service.key}: ${service.status.toUpperCase()} ${service.endpoint ? `(${service.endpoint})` : ''}`)
      : ['- Aucun service remonte pour le moment. Ouvrir le dashboard puis cliquer Synchroniser.']
    const guide = [
      'AtelierOS - Guide client installation et premier demarrage',
      `Genere le ${generatedAt}`,
      '',
      'Adresses importantes',
      `- Dashboard: ${dashboardUrl}`,
      `- API: ${apiUrl}`,
      `- PXE/tests: ${pxeUrl}`,
      `- Partage reseau: ${share}`,
      `- Mobile / terminal EA520: ${mobileUrl}`,
      '',
      'Checklist premier demarrage',
      ...steps.map((step) => `- [${step.ok ? 'OK' : 'A FAIRE'}] ${step.title}: ${step.detail}`),
      '',
      'Etat des services',
      ...serviceLines,
      '',
      'Procedure rapide',
      '1. Brancher le serveur au reseau atelier ou au switch.',
      '2. Ouvrir le dashboard AtelierOS depuis un poste Windows.',
      '3. Verifier les voyants API, SMB, PXE HTTP et DNS/DHCP.',
      '4. Ouvrir le partage reseau et deposer ISO/WIM/drivers si besoin.',
      '5. Importer ou declarer une image Windows dans Images WIM.',
      '6. Definir image par defaut, profil Unattend et drivers.',
      '7. Demarrer un PC en PXE et lancer Audit rapide.',
      '8. Verifier le retour dans Audit puis imprimer une etiquette.',
      '',
      'Actions de depannage',
      '- Apres changement de switch ou IP: Parametres > Regenerer reseau.',
      '- Si le PC ne boote pas: verifier cable, UEFI PXE, Secure Boot, puis logs PXE.',
      '- Si audit absent: verifier que le PC client joint l API sur le port 8000.',
      '- Avant livraison client: Guide > Sauvegarde > Creer sauvegarde.',
      '',
    ].join('\n')
    downloadTextFile(`atelieros-guide-client-${new Date().toISOString().slice(0, 10)}.txt`, guide)
  }

  useEffect(() => {
    let active = true
    QRCode.toDataURL(mobileConfigUrl, { margin: 1, width: 180, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => { if (active) setMobileQr(url) })
      .catch(() => { if (active) setMobileQr('') })
    return () => { active = false }
  }, [mobileConfigUrl])

  return (
    <div className="space-y-6">
      <PageTitle title="Guide" description="Installation client, premier demarrage et checklist atelier." icon={BookOpen} />
      <section className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 shadow-xl shadow-black/20 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Centre client AtelierOS</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">Parcours integre pour installer, diagnostiquer et maintenir l'appliance sans documentation externe.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportGuide}
              className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
            >
              Export guide client
            </button>
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', offlineServices.length ? 'border-amber-300/25 bg-amber-300/10 text-amber-200' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200')}>
              {offlineServices.length ? `${offlineServices.length} service(s) a verifier` : 'services OK'}
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            { id: 'install', label: 'Installation', icon: BookOpen },
            { id: 'diagnostic', label: 'Diagnostic', icon: Gauge },
            { id: 'faq', label: 'FAQ', icon: Search },
            { id: 'backup', label: 'Sauvegarde', icon: HardDrive },
          ].map((item) => {
            const Icon = item.icon
            const selected = guideTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setGuideTab(item.id as typeof guideTab)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                  selected ? 'border-cyan-300/30 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.06]',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>
        <GuideClientPanel
          tab={guideTab}
          dashboardUrl={dashboardUrl}
          mobileUrl={mobileUrl}
          apiUrl={apiUrl}
          pxeUrl={pxeUrl}
          share={share}
          services={services}
          offlineServices={offlineServices}
          backups={backups}
          systemReport={systemReport}
          isSaving={isSaving}
          backupMessage={backupMessage}
          onCreateBackup={onCreateBackup}
          onRefreshBackups={onRefreshBackups}
          onDeleteBackup={onDeleteBackup}
          onDownloadBackup={onDownloadBackup}
          onRestoreBackup={onRestoreBackup}
          onLoadSystemReport={onLoadSystemReport}
        />
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/65 shadow-xl shadow-black/20 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Assistant premier demarrage</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">Cette checklist doit devenir le parcours client final quand le logiciel sera vendu.</p>
            </div>
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', steps.every((step) => step.ok) ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/30 bg-amber-300/10 text-amber-200')}>{steps.every((step) => step.ok) ? 'pret' : 'a completer'}</span>
          </div>
          <div className="mt-5 grid gap-3">
            {steps.map((step) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start gap-3">
                  <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border', step.ok ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/30 bg-amber-300/10 text-amber-200')}>
                    {step.ok ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white">{step.title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">{step.detail}</div>
                    {step.action ? <div className="mt-2 truncate font-mono text-xs text-cyan-200">{step.action}</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 shadow-xl shadow-black/20 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Adresses utiles</h3>
            <div className="mt-4 grid gap-2">
              <GuideCopyRow label="Dashboard" value={dashboardUrl} />
              <GuideCopyRow label="Mobile EA520" value={mobileUrl} />
              <GuideCopyRow label="API" value={apiUrl} />
              <GuideCopyRow label="PXE HTTP" value={pxeUrl} />
              <GuideCopyRow label="Partage" value={share} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 shadow-xl shadow-black/20 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Roadmap finalisation</h3>
            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <RoadmapItem status="en cours" title="Images WIM" detail="Upload, listing serveur, suppression, declaration WIM/ESD puis creation WIM depuis ISO." tone="cyan" />
              <RoadmapItem status="pret local" title="Sauvegarde" detail="Archive appliance ZIP preparee. Restauration automatique a finaliser ensuite." tone="emerald" />
              <RoadmapItem status="pret local" title="Reseau automatique" detail="Diagnostic IP, services, dossiers deploy et regeneration reseau depuis Parametres." tone="emerald" />
              <RoadmapItem status="a signer" title="Mobile EA520" detail="APK release client, configuration QR et parcours scanner atelier." tone="amber" />
              <RoadmapItem status="a stabiliser" title="PXE graphique" detail="Audit rapide + tests atelier avec retour machine complet." tone="rose" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 shadow-xl shadow-black/20 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200"><Smartphone className="h-4 w-4" /> EA520</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">Scanne ce QR avec le terminal pour configurer l'APK AtelierOS Mobile sur ce serveur.</p>
            {mobileQr ? (
              <div className="mt-4 grid place-items-center rounded-2xl border border-white/10 bg-white p-3">
                <img src={mobileQr} alt="QR AtelierOS Mobile" className="h-36 w-36" />
              </div>
            ) : null}
            <div className="mt-3 break-all rounded-xl border border-cyan-300/10 bg-cyan-300/[0.045] p-3 font-mono text-xs text-cyan-100">{mobileConfigUrl}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GuideCopyRow({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value)}
      className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-left transition hover:bg-white/[0.06]"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="truncate font-mono text-xs text-slate-200">{value}</span>
      <Copy className="h-4 w-4 text-cyan-200" />
    </button>
  )
}

function RoadmapItem({
  status,
  title,
  detail,
  tone,
}: {
  status: string
  title: string
  detail: string
  tone: 'cyan' | 'emerald' | 'amber' | 'rose'
}) {
  const toneClass = {
    cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    rose: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
  }[tone]
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{detail}</div>
        </div>
        <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em]', toneClass)}>{status}</span>
      </div>
    </div>
  )
}

function GuideClientPanel({
  tab,
  dashboardUrl,
  mobileUrl,
  apiUrl,
  pxeUrl,
  share,
  services,
  offlineServices,
  backups,
  systemReport,
  isSaving,
  backupMessage,
  onCreateBackup,
  onRefreshBackups,
  onDeleteBackup,
  onDownloadBackup,
  onRestoreBackup,
  onLoadSystemReport,
}: {
  tab: 'install' | 'diagnostic' | 'faq' | 'backup'
  dashboardUrl: string
  mobileUrl: string
  apiUrl: string
  pxeUrl: string
  share: string
  services: ForgePxeServiceCheck[]
  offlineServices: ForgePxeServiceCheck[]
  backups: ForgeApplianceBackup[]
  systemReport: ForgeSystemReportResponse | null
  isSaving: boolean
  backupMessage: string | null
  onCreateBackup: () => Promise<void>
  onRefreshBackups: () => Promise<void>
  onDeleteBackup: (filename: string) => Promise<void>
  onDownloadBackup: (filename: string) => Promise<void>
  onRestoreBackup: (filename: string, dryRun: boolean) => Promise<void>
  onLoadSystemReport: () => Promise<void>
}) {
  const [faqSearch, setFaqSearch] = useState('')
  const [faqCategory, setFaqCategory] = useState('Tous')
  const faqSections = [
    {
      category: 'Installation',
      items: [
        {
          q: 'Quelle est la procedure normale apres installation de AtelierOS ?',
          a: 'Brancher le serveur au reseau atelier, ouvrir le dashboard, verifier les voyants API/SMB/PXE HTTP, ouvrir le partage deploy depuis Windows, importer une image Windows, definir une image par defaut, puis tester un PC en PXE.',
          steps: ['Ouvrir le dashboard.', 'Aller dans Guide > Diagnostic.', 'Verifier que les services sont verts.', 'Ouvrir le partage reseau.', 'Lancer un boot PXE sur un PC test.'],
          critical: true,
        },
        {
          q: 'Le client doit-il connaitre Linux ou Proxmox ?',
          a: 'Non. L objectif est que le client utilise le dashboard. Proxmox sert seulement a heberger la VM. Les actions courantes doivent passer par les onglets Guide, Parametres, Images WIM, Audit et Pilotes.',
          steps: ['Utiliser le dashboard en priorite.', 'Garder SSH/Proxmox pour support avance.', 'Faire une sauvegarde appliance avant intervention lourde.'],
        },
        {
          q: 'Que faire apres un changement de switch, routeur ou cable reseau ?',
          a: 'Aller dans Parametres. Lire le diagnostic lecture seule. Si IP detectee et IP configuree different, lancer Regenerer reseau. Tester ensuite le dashboard, le partage SMB et un boot PXE.',
          steps: ['Parametres > Diagnostic lecture seule.', 'Comparer IP configuree et detectee.', 'Cliquer Regenerer reseau si necessaire.', 'Tester un PC PXE.'],
          critical: true,
        },
      ],
    },
    {
      category: 'Reseau / PXE',
      items: [
        {
          q: 'Le menu PXE ne s affiche pas sur le PC client.',
          a: 'Verifier d abord le cable et le boot UEFI reseau. Ensuite verifier que le service HTTP PXE est vert, que le PC est sur le meme reseau, et que DHCP/proxyDHCP ne conflit pas avec le routeur.',
          steps: ['Tester un autre cable.', 'Choisir UEFI PXE dans le boot menu.', 'Verifier Parametres > Services reseau.', 'Regenerer reseau si IP changee.', 'Controler les logs PXE si necessaire.'],
          critical: true,
        },
        {
          q: 'Le PC boot mais reste bloque ou revient au BIOS.',
          a: 'Souvent le boot mode ne correspond pas, Secure Boot bloque, ou l asset WinPE/iPXE manque. Tester en UEFI, desactiver temporairement Secure Boot si besoin, puis verifier Assets PXE.',
          steps: ['Choisir UEFI Network Boot.', 'Tester Secure Boot off si le constructeur bloque.', 'Verifier Images WIM > Assets PXE.', 'Relancer un boot propre.'],
        },
        {
          q: 'Le mode direct serveur vers PC fonctionne-t-il sans switch ?',
          a: 'Oui, si la carte reseau serveur expose un DHCP/proxyDHCP coherent et que le PC client est branche sur le bon port. Le diagnostic reseau aide a valider l IP serveur, mais le test final reste un boot PXE reel.',
          steps: ['Brancher PC et serveur directement.', 'Verifier link LED sur les cartes.', 'Regenerer reseau si necessaire.', 'Demarrer le PC en PXE.'],
        },
        {
          q: 'Comment savoir si le serveur est visible sur le reseau ?',
          a: 'Le dashboard doit repondre, le partage SMB doit s ouvrir depuis Windows et le diagnostic reseau doit afficher API, SMB et HTTP PXE en ligne.',
          steps: ['Ouvrir le dashboard.', `Ouvrir ${share}.`, 'Guide > Diagnostic > Generer rapport support.'],
        },
      ],
    },
    {
      category: 'Audit / Tests',
      items: [
        {
          q: 'Audit rapide doit-il demander une commande au technicien ?',
          a: 'Non. La cible reste: choisir Audit rapide dans le menu PXE, puis laisser le client lancer automatiquement la collecte et la page de test graphique si ce mode est choisi.',
          steps: ['Boot PXE.', 'Choisir Audit rapide.', 'Attendre le retour dans l onglet Audit.', 'Ne pas taper startx manuellement.'],
          critical: true,
        },
        {
          q: 'Audit ne remonte pas dans l interface.',
          a: 'Verifier que le client peut joindre l API du serveur. Si le reseau vient de changer, regenerer le reseau. Controler ensuite le dossier audit et le bouton Synchroniser.',
          steps: ['Parametres > Diagnostic lecture seule.', 'Verifier API online.', 'Cliquer Synchroniser.', 'Relancer Audit rapide sur le PC.'],
          critical: true,
        },
        {
          q: 'Quelle difference entre audit rapide texte et audit graphique ?',
          a: 'Le mode texte est le plus leger et doit remonter les infos utiles pour etiquette: marque, modele, CPU, RAM, disque, batterie. Le mode graphique ajoute les tests atelier: clavier, pixels, USB, camera, micro et audio.',
          steps: ['Utiliser texte pour tri rapide.', 'Utiliser graphique pour validation revente.', 'Garder les deux modes disponibles.'],
        },
        {
          q: 'La page Audit devient trop longue avec beaucoup de PC.',
          a: 'Utiliser la pagination 10/25/50. Pour la maintenance, utiliser Nettoyer anciens: le systeme simule d abord, puis supprime uniquement apres confirmation en gardant les derniers retours.',
          steps: ['Choisir 25 ou 50 par page.', 'Supprimer une tuile si besoin.', 'Utiliser Nettoyer anciens.', 'Confirmer seulement apres simulation.'],
        },
      ],
    },
    {
      category: 'Images WIM',
      items: [
        {
          q: 'Quel est le flux simple pour deployer Windows ?',
          a: 'Importer une ISO ou un WIM/ESD, preparer le WIM si besoin, declarer l image, definir l image par defaut, associer Unattend et drivers, puis lancer le deploiement PXE.',
          steps: ['Images WIM > Importer.', 'Rafraichir fichiers serveur.', 'Preparer WIM pour ISO ou Declarer pour WIM/ESD.', 'Definir image par defaut.', 'Tester un PC.'],
          critical: true,
        },
        {
          q: 'Pourquoi mon ISO n apparait pas apres upload ?',
          a: 'Si aucun fichier .iso/.wim/.esd n apparait dans Fichiers deja sur le serveur, l upload navigateur a probablement echoue ou n a pas ete finalise. Relancer l envoi et attendre 100%.',
          steps: ['Verifier la progression upload.', 'Cliquer Rafraichir.', 'Verifier qu aucun .upload ne reste bloque.', 'Relancer seulement si le fichier est absent.'],
          critical: true,
        },
        {
          q: 'Difference entre ISO, WIM et ESD ?',
          a: 'ISO est le support Windows complet. WIM/ESD est l image d installation contenue dans l ISO. AOS doit finir avec une image WIM/ESD declaree et idealement une image par defaut.',
          steps: ['ISO: a preparer.', 'WIM/ESD: peut etre declare.', 'Image par defaut: necessaire avant deploiement.'],
        },
        {
          q: 'Ou sont stockees les procedures WIM preparees ?',
          a: 'Les procedures sont dans le partage deploy, dossier images/wim-builds. L interface Images WIM affiche les dernieres procedures avec chemin SMB, manifest et script.',
          steps: ['Images WIM > Etat de publication.', 'Lire Procedures WIM preparees.', 'Executer le script depuis un poste Windows ADK si necessaire.'],
        },
      ],
    },
    {
      category: 'Pilotes',
      items: [
        {
          q: 'Comment gerer les drivers par modele ?',
          a: 'Auditer une machine, preparer le pack drivers depuis l audit, stocker le pack par marque/modele/version Windows, puis le reutiliser pour les machines identiques.',
          steps: ['Audit > selectionner machine.', 'Cliquer Preparer drivers.', 'Verifier onglet Pilotes.', 'Associer au deploiement.'],
          critical: true,
        },
        {
          q: 'Les drivers doivent-ils etre telecharges automatiquement ?',
          a: 'Objectif final oui pour les constructeurs compatibles, notamment HP via SoftPaq quand disponible. Sinon le logiciel prepare le dossier et le technicien depose le pack extrait.',
          steps: ['Verifier marque/modele dans Audit.', 'Preparer drivers.', 'Si auto absent, deposer les INF dans le dossier indique.', 'Extraire/valider le pack.'],
        },
        {
          q: 'Pourquoi garder un pack driver sur le serveur ?',
          a: 'Pour eviter de refaire le travail a chaque machine. Quand un modele revient en atelier, le deploiement peut reutiliser le pack deja stocke.',
          steps: ['Nommer par marque/modele.', 'Conserver version Windows.', 'Ne pas supprimer les packs valides.'],
        },
      ],
    },
    {
      category: 'Unattend / Deploiement',
      items: [
        {
          q: 'Quelle difference entre deploiement standard et marketplace ?',
          a: 'Standard automatise l installation avec Unattend, compte local et reglages atelier. Marketplace garde une sortie plus proche OOBE client final, sans compte preconfigure, avec drivers installes.',
          steps: ['Standard: atelier/interne.', 'Marketplace: revente/client final.', 'Toujours associer drivers si disponibles.'],
        },
        {
          q: 'Unattend est-il obligatoire ?',
          a: 'Pour un deploiement propre et repetable, oui. Sans Unattend, Windows demandera plus de manipulations au technicien ou au client.',
          steps: ['Creer un profil Unattend.', 'Definir le profil par defaut.', 'Choisir le mode standard ou marketplace.'],
        },
      ],
    },
    {
      category: 'Etiquettes / Brother',
      items: [
        {
          q: 'Que doit contenir l etiquette machine ?',
          a: 'Marque, modele, reference/serie, processeur, RAM, disque, batterie/usure si portable, QR code lisible et code-barres secours.',
          steps: ['Verifier Audit complet.', 'Ouvrir Editeur etiquette.', 'Choisir format Brother.', 'Verifier preview.', 'Imprimer.'],
          critical: true,
        },
        {
          q: 'Le QR code est illisible.',
          a: 'Augmenter sa zone, eviter les traits et les fonds trop charges, garder un contraste noir sur blanc, et ne pas trop compresser les informations autour.',
          steps: ['Choisir modele etiquette lisible.', 'Verifier preview.', 'Scanner avant production en lot.'],
        },
        {
          q: 'Brother indique mauvais rouleau.',
          a: 'Verifier le format reel du rouleau, les preferences imprimante Windows et le gabarit AOS. Pour QL-500/QL-820NWB, garder des profils separes 29x90, 62 continu et 62x100.',
          steps: ['Verifier rouleau physique.', 'Choisir le bon profil.', 'Faire un test alignement.', 'Changer profil si necessaire.'],
        },
      ],
    },
    {
      category: 'Sauvegarde / Maintenance',
      items: [
        {
          q: 'Quand creer une sauvegarde appliance ?',
          a: 'Avant livraison client, avant changement reseau important, avant mise a jour, et apres configuration des images, drivers et profils Unattend.',
          steps: ['Guide > Sauvegarde.', 'Creer sauvegarde.', 'Verifier archive dans exports/aos-backups.', 'Garder au moins la derniere sauvegarde stable.'],
          critical: true,
        },
        {
          q: 'Comment restaurer sans risque ?',
          a: 'Toujours utiliser Simuler avant Restaurer. La simulation liste les fichiers qui seraient remis en place. Appliquer seulement si le resultat correspond.',
          steps: ['Guide > Sauvegarde.', 'Cliquer Simuler.', 'Lire le message.', 'Restaurer seulement si correct.'],
        },
        {
          q: 'Comment fournir un diagnostic au support ?',
          a: 'Aller dans Guide > Diagnostic puis Generer rapport support. Le rapport resume reseau, medias, images, pilotes, audits, sauvegardes et recommandations.',
          steps: ['Guide > Diagnostic.', 'Generer rapport.', 'Lire les recommandations.', 'Transmettre le resume au support.'],
        },
      ],
    },
    {
      category: 'Mobile EA520',
      items: [
        {
          q: 'A quoi sert le terminal Unitech EA520 ?',
          a: 'Scanner les etiquettes, ouvrir une fiche machine, changer un statut atelier, retrouver rapidement un audit ou preparer expedition/inventaire.',
          steps: ['Installer APK AtelierOS Mobile.', 'Scanner QR de configuration.', 'Scanner etiquette machine.', 'Verifier retour dans l interface.'],
        },
        {
          q: 'Comment configurer le mobile ?',
          a: 'Depuis Guide, scanner le QR EA520 qui contient l URL mobile du serveur. L APK doit ensuite pointer vers ce serveur.',
          steps: ['Guide > QR EA520.', 'Scanner avec le terminal.', 'Verifier URL serveur.', 'Tester scan etiquette.'],
        },
      ],
    },
  ]
  const faqCategories = ['Tous', ...faqSections.map((section) => section.category)]
  const faqNeedle = normalizeSearch(faqSearch.trim())
  const filteredFaqSections = faqSections
    .filter((section) => faqCategory === 'Tous' || section.category === faqCategory)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !faqNeedle || normalizeSearch(`${section.category} ${item.q} ${item.a} ${item.steps.join(' ')}`).includes(faqNeedle)),
    }))
    .filter((section) => section.items.length)
  const panels = {
    install: {
      title: 'Installation client en 6 controles',
      detail: 'A faire a chaque nouvelle installation ou changement de reseau.',
      items: [
        { title: 'Dashboard accessible', detail: dashboardUrl, ok: Boolean(dashboardUrl) },
        { title: 'API joignable', detail: apiUrl, ok: services.length === 0 || services.some((service) => `${service.key} ${service.label}`.toLowerCase().includes('api') && service.status === 'online') },
        { title: 'PXE HTTP pret', detail: pxeUrl, ok: services.length === 0 || services.some((service) => `${service.key} ${service.label}`.toLowerCase().includes('http') && service.status === 'online') },
        { title: 'Partage reseau visible', detail: share, ok: Boolean(share) },
        { title: 'Premier PC test', detail: 'Boot PXE -> Audit rapide -> retour dans Audit', ok: true },
        { title: 'Mobile EA520', detail: mobileUrl, ok: Boolean(mobileUrl) },
      ],
    },
    diagnostic: {
      title: 'Diagnostic rapide',
      detail: offlineServices.length ? 'Commencer par les services en orange avant de tester PXE.' : 'Base saine. Tester maintenant un client PXE reel.',
      items: [
        { title: 'Services a verifier', detail: offlineServices.map((service) => service.label || service.key).join(', ') || 'Aucun service hors ligne connu', ok: offlineServices.length === 0 },
        { title: 'Si PXE ne demarre pas', detail: 'Verifier cable, boot UEFI PXE, Secure Boot, puis logs dnsmasq.', ok: true },
        { title: 'Si audit ne remonte pas', detail: `Verifier que le client joint ${apiUrl}`, ok: true },
        { title: 'Si partage invisible', detail: `Depuis Windows, ouvrir ${share}`, ok: true },
        { title: 'Si WIM absent', detail: 'Onglet Images WIM -> importer ISO/WIM -> definir image par defaut.', ok: true },
      ],
    },
    faq: {
      title: 'FAQ complete',
      detail: 'Base de connaissance atelier pour installation, PXE, audit, WIM, drivers, etiquettes, sauvegarde et mobile.',
      items: faqSections.flatMap((section) => section.items.filter((item) => item.critical).map((item) => ({ title: item.q, detail: item.a, ok: true }))).slice(0, 6),
    },
    backup: {
      title: 'Sauvegarde et restauration',
      detail: 'Sauvegarde appliance disponible. Restaurer uniquement apres simulation et verification.',
      items: [
        { title: 'Sauvegarder config', detail: 'IP, mode PXE, partage SMB, profils reseau.', ok: true },
        { title: 'Sauvegarder donnees atelier', detail: 'Audits recents, pilotes declares, images declarees.', ok: true },
        { title: 'Sauvegarder profils', detail: 'WIM, Unattend, scripts et parametres deploiement.', ok: true },
        { title: 'Restaurer appliance', detail: 'Simulation avant application depuis les archives disponibles.', ok: true },
      ],
    },
  }[tab]
  const diagnosticScore = services.length ? Math.round(((services.length - offlineServices.length) / services.length) * 100) : 0
  const diagnosticTone = diagnosticScore >= 90 ? 'emerald' : diagnosticScore >= 60 ? 'amber' : 'rose'
  const diagnosticClass = {
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    rose: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
  }[diagnosticTone]
  const installReadyCount = panels.items.filter((item) => item.ok).length
  const installReadyPercent = Math.round((installReadyCount / Math.max(panels.items.length, 1)) * 100)

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-white">{panels.title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-400">{panels.detail}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">{panels.items.length} points</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {panels.items.map((item) => (
          <div key={item.title} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border', item.ok ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/25 bg-amber-300/10 text-amber-200')}>
              {item.ok ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{item.title}</div>
              <div className="mt-1 break-words text-sm leading-5 text-slate-400">{item.detail}</div>
            </div>
          </div>
        ))}
      </div>
      {tab === 'install' ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">Avancement installation</div>
            <div className="font-mono text-sm font-black text-cyan-100">{installReadyPercent}%</div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all" style={{ width: `${installReadyPercent}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-400">{installReadyCount}/{panels.items.length} controles valides.</div>
        </div>
      ) : null}
      {tab === 'diagnostic' ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Score appliance</div>
              <div className="mt-1 text-xs text-slate-400">Calcul base sur les services reseau connus par AOS.</div>
            </div>
            <span className={cn('rounded-full border px-3 py-1 text-sm font-black', diagnosticClass)}>{diagnosticScore}%</span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {services.map((service) => (
              <div key={service.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold text-white">{service.label}</div>
                  <span className={cn('h-2.5 w-2.5 rounded-full', service.status === 'online' ? 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.8)]' : 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,.8)]')} />
                </div>
                <div className="mt-1 truncate font-mono text-xs text-slate-500">{service.endpoint}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-cyan-300/10 bg-cyan-300/[0.045] p-3 text-sm leading-6 text-cyan-100">
            {offlineServices.length
              ? `Action conseillee: corriger ${offlineServices.map((service) => service.label).join(', ')}, puis relancer Regeneration reseau dans Parametres.`
              : 'Action conseillee: lancer un boot PXE reel et verifier le retour dans Audit.'}
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Rapport support client</div>
                <div className="mt-1 text-xs text-slate-400">Resume exportable pour diagnostiquer une appliance sans SSH.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {systemReport ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(systemReportSupportText(systemReport))}
                      className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                    >
                      Copier resume
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadJsonFile(`aos-support-${new Date(systemReport.generated_at).toISOString().slice(0, 10)}.json`, systemReport)}
                      className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                    >
                      Export JSON
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => void onLoadSystemReport()}
                  className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                >
                  Generer rapport
                </button>
              </div>
            </div>
            {systemReport ? (
              <div className="mt-4 grid gap-3">
                <div className="grid gap-2 lg:grid-cols-3">
                  <InfoRow label="IP configuree" value={systemReport.network.configured_ip || 'Non definie'} mono />
                  <InfoRow label="IP detectee" value={systemReport.network.detected_ip || 'Non detectee'} mono />
                  <InfoRow label="Mode PXE" value={systemReport.pxe_config.mode} />
                </div>
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Fiabilite appliance</div>
                      <div className="mt-1 text-xs text-slate-400">Score calcule par le backend: services, fichiers critiques, stockage, image par defaut, Unattend et sauvegarde.</div>
                    </div>
                    <span className={cn(
                      'rounded-full border px-3 py-1 text-sm font-black',
                      systemReport.reliability_score >= 90 ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : systemReport.reliability_score >= 70 ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : 'border-rose-300/25 bg-rose-300/10 text-rose-100',
                    )}>
                      {systemReport.reliability_score}% - {systemReport.readiness_level}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {systemReport.checks.map((check) => (
                      <div key={check.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold text-white">{check.label}</div>
                          <span className={cn('h-2.5 w-2.5 rounded-full', check.status === 'online' ? 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.8)]' : 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,.8)]')} />
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{check.detail}</div>
                        {check.endpoint ? <div className="mt-1 truncate font-mono text-[11px] text-slate-600">{check.endpoint}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {[
                    ['Libre', `${systemReport.storage_free_gb} GB`],
                    ['Utilise', `${systemReport.storage_used_percent}%`],
                    ['Medias', systemReport.media_total],
                    ['Images', systemReport.wim_images_total],
                    ['Pilotes', systemReport.driver_packs_total],
                    ['Audits', systemReport.audits_total_visible],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
                      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.07] p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Recommandations</div>
                  <div className="grid gap-1 text-sm leading-6 text-slate-200">
                    {systemReport.recommendations.map((recommendation) => (
                      <div key={recommendation}>- {recommendation}</div>
                    ))}
                  </div>
                </div>
                <div className="font-mono text-[11px] text-slate-500">Genere le {new Date(systemReport.generated_at).toLocaleString('fr-FR')}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {tab === 'faq' ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.045] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Recherche FAQ</div>
                <div className="mt-1 text-xs text-slate-400">Filtre par mot cle: PXE, WIM, drivers, etiquette, sauvegarde, EA520, reseau.</div>
              </div>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                {filteredFaqSections.reduce((count, section) => count + section.items.length, 0)} resultat(s)
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200" />
                <input
                  value={faqSearch}
                  onChange={(event) => setFaqSearch(event.target.value)}
                  placeholder="Rechercher une panne, une procedure, un module..."
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-cyan-300/5"
                />
              </div>
              <select
                value={faqCategory}
                onChange={(event) => setFaqCategory(event.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-cyan-300/40 focus:bg-cyan-300/5"
              >
                {faqCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {faqCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFaqCategory(category)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                    faqCategory === category ? 'border-cyan-300/30 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.06]',
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {filteredFaqSections.length === 0 ? (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
              Aucun resultat. Essaie un mot cle plus simple ou repasse sur Tous.
            </div>
          ) : (
            filteredFaqSections.map((section) => (
              <section key={section.category} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-base font-semibold text-white">{section.category}</h5>
                    <div className="mt-1 text-xs text-slate-500">{section.items.length} question(s)</div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{section.category}</span>
                </div>
                <div className="grid gap-3">
                  {section.items.map((item) => (
                    <details key={item.q} className="group rounded-xl border border-white/10 bg-black/20 p-4 open:border-cyan-300/20 open:bg-cyan-300/[0.045]">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                        <span>
                          <span className="flex items-center gap-2 text-sm font-semibold text-white">
                            {item.critical ? <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,.8)]" /> : null}
                            {item.q}
                          </span>
                          {item.critical ? <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">Point critique</span> : null}
                        </span>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-90 group-open:text-cyan-200" />
                      </summary>
                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.7fr)]">
                        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Reponse</div>
                          <p className="text-sm leading-6 text-slate-300">{item.a}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Procedure</div>
                          <ol className="grid gap-2">
                            {item.steps.map((step, index) => (
                              <li key={step} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2 text-sm leading-5 text-slate-300">
                                <span className="grid h-6 w-6 place-items-center rounded-md border border-emerald-300/20 bg-emerald-300/10 font-mono text-[11px] font-bold text-emerald-100">{index + 1}</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      ) : null}
      {tab === 'backup' ? (
        <div className="mt-4 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.045] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Archives appliance</div>
              <div className="mt-1 text-xs text-slate-400">Sauvegarde config, profils, pilotes declares, images declarees et audits recents.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onRefreshBackups()}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Rafraichir
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void onCreateBackup()}
                className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Creation...' : 'Creer sauvegarde'}
              </button>
            </div>
          </div>
          {backupMessage ? <div className="mt-3 rounded-lg border border-emerald-300/15 bg-emerald-300/10 p-3 text-xs text-emerald-100">{backupMessage}</div> : null}
          <div className="mt-4 grid gap-2">
            {backups.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-400">Aucune sauvegarde detectee.</div>
            ) : (
              backups.map((backup) => (
                <div key={backup.filename} className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{backup.filename}</div>
                    <div className="mt-1 truncate font-mono text-xs text-cyan-200">{backup.path}</div>
                  </div>
                  <div className="text-xs text-slate-400 sm:text-right">
                    <div>{backup.size_mb} MB</div>
                    <div>{new Date(backup.created_at).toLocaleString('fr-FR')}</div>
                    <div className="mt-2 flex flex-wrap justify-start gap-2 sm:justify-end">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void onDownloadBackup(backup.filename)}
                        className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Telecharger
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          if (window.confirm(`Supprimer la sauvegarde ${backup.filename} ? Les donnees actives ne seront pas modifiees.`)) {
                            void onDeleteBackup(backup.filename)
                          }
                        }}
                        className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void onRestoreBackup(backup.filename, true)}
                        className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Simuler
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          if (window.confirm(`Restaurer ${backup.filename} ? Cette action remplace la configuration/profils sauvegardes.`)) {
                            void onRestoreBackup(backup.filename, false)
                          }
                        }}
                        className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Restaurer
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AssistantBot({
  activeSection,
  mode,
  apiError,
  status,
  systemReport,
  audits,
}: {
  activeSection: NavigationSection
  mode: InterfaceMode
  apiError: string | null
  status: ForgePxeStatus | null
  systemReport: ForgeSystemReportResponse | null
  audits: ForgePxeAuditSummary[]
}) {
  const [open, setOpen] = useState(() => mode === 'beginner')
  const services = status?.services ?? []
  const offlineServices = services.filter((service) => service.status !== 'online')
  const latestAudit = audits[0]
  const advice = assistantAdvice(activeSection, {
    apiError,
    offlineServices: offlineServices.length,
    reliabilityScore: systemReport?.reliability_score ?? null,
    firstBlockingCheck: systemReport?.checks.find((check) => check.status !== 'online') ?? null,
    auditCount: audits.length,
    latestMachine: latestAudit ? machineName(latestAudit) : null,
    hasPxeClients: Boolean(status?.clients?.length),
  })

  return (
    <div className="fixed bottom-20 right-3 z-40 sm:bottom-5 sm:right-5">
      {open ? (
        <div className="mb-3 w-[min(calc(100vw-1.5rem),360px)] overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#07111d]/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
                <Bot className="h-5 w-5 animate-[pulse_2.4s_ease-in-out_infinite]" />
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-[#07111d] bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.9)]" />
              </div>
              <div>
                <div className="text-sm font-black text-white">AtelierOS Assistant</div>
                <div className="text-xs text-cyan-200">{advice.status}</div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label="Fermer assistant">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-sm leading-6 text-slate-200">{advice.primary}</p>
            <div className="grid gap-2">
              {advice.actions.map((item) => (
                <div key={item} className="flex gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            {apiError ? (
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                API: {apiError}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group relative grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/15 text-cyan-100 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl transition hover:scale-105 hover:bg-cyan-300/20"
        aria-label="Ouvrir assistant AtelierOS"
      >
        <span className="absolute inset-0 rounded-2xl bg-cyan-300/10 opacity-0 blur-xl transition group-hover:opacity-100" />
        <Bot className="relative h-7 w-7 animate-[bounce_2.8s_ease-in-out_infinite]" />
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.9)]" />
      </button>
    </div>
  )
}

function assistantAdvice(
  section: NavigationSection,
  context: { apiError: string | null; offlineServices: number; reliabilityScore: number | null; firstBlockingCheck: ForgePxeServiceCheck | null; auditCount: number; latestMachine: string | null; hasPxeClients: boolean },
) {
  if (context.apiError) {
    return {
      status: 'Action requise',
      primary: "L'API ne repond pas correctement. Avant de deployer ou imprimer, verifie les services et relance la synchronisation.",
      actions: ['Ouvre Logs pour lire la derniere erreur.', 'Va dans Guide pour verifier les adresses serveur.', 'Controle le service API AtelierOS si le probleme persiste.'],
    }
  }
  if (context.offlineServices > 0) {
    return {
      status: `${context.offlineServices} service(s) a verifier`,
      primary: 'Un service est signale hors ligne ou non verifie. Le PXE peut fonctionner partiellement, mais il faut corriger avant une livraison client.',
      actions: ['Controle les voyants dans Dashboard.', 'Teste le partage reseau depuis un PC Windows.', 'Verifie HTTP PXE avant de lancer un audit.'],
    }
  }
  if (context.firstBlockingCheck) {
    return {
      status: context.reliabilityScore === null ? 'Diagnostic' : `Fiabilite ${context.reliabilityScore}%`,
      primary: `Blocage principal: ${context.firstBlockingCheck.label}. ${context.firstBlockingCheck.detail}`,
      actions: [
        context.firstBlockingCheck.key === 'default-image' ? 'Va dans Images WIM et importe ou declare une image Windows.' : 'Ouvre Guide > Diagnostic pour lire le controle detaille.',
        'Corrige ce point puis clique Synchroniser.',
        'Ne lance pas de deploiement tant que ce point reste orange.',
      ],
    }
  }

  const sectionAdvice: Record<NavigationSection, { status: string; primary: string; actions: string[] }> = {
    dashboard: {
      status: 'Vue atelier',
      primary: context.hasPxeClients ? 'Le serveur voit des clients PXE. Tu peux suivre les machines en cours et traiter les alertes.' : 'Commence par brancher un PC en PXE ou ouvrir le Guide pour verifier le serveur.',
      actions: ['Regarde les services actifs.', 'Passe en Audit pour etiqueter les machines.', 'Utilise Guide si tu installes chez un client.'],
    },
    deployments: {
      status: 'Deploiement',
      primary: 'Avant tout deploiement, verifie que le bon WIM, le bon profil Unattend et les drivers du modele sont prets.',
      actions: ['Controle Images WIM.', 'Controle Pilotes.', 'Utilise le mode marketplace seulement si tu veux laisser OOBE au client final.'],
    },
    audit: {
      status: context.auditCount ? `${context.auditCount} audit(s)` : 'En attente audit',
      primary: context.latestMachine ? `Derniere machine recue: ${context.latestMachine}. Verifie batterie, disque et tests atelier avant etiquette.` : 'Aucun audit recu. Lance Audit rapide depuis le menu PXE.',
      actions: ['Ouvre la fiche machine.', 'Prepare les drivers depuis audit.', 'Imprime etiquette quand les infos sont completes.'],
    },
    boot: {
      status: 'Boot UEFI',
      primary: 'Cette zone doit rester simple pour le technicien: choix PXE clair, audit rapide direct, deploiement standard ou marketplace.',
      actions: ['Garde Audit rapide sans manipulation manuelle.', 'Verifie le menu sur un PC test.', 'Documente les touches boot Dell/HP/Lenovo.'],
    },
    images: {
      status: 'Images Windows',
      primary: 'Le prochain gros gain est de fiabiliser import ISO, extraction WIM et choix image par defaut.',
      actions: ['Depose les ISO dans le partage.', 'Cree un profil WIM par edition Windows.', 'Associe un profil Unattend clair.'],
    },
    drivers: {
      status: 'Pilotes',
      primary: 'Les drivers doivent etre stockes par marque/modele pour eviter de recommencer a chaque machine identique.',
      actions: ['Prepare pack depuis un audit.', 'Verifie la couverture des modeles audites.', 'Garde un dossier par constructeur.'],
    },
    tools: {
      status: 'Tests atelier',
      primary: 'Les tests doivent rester rapides: clavier, pixels, USB, camera, micro et audio, puis retour dans Audit.',
      actions: ['Teste sur un PC client.', 'Evite les pages longues.', 'Garde mode texte en secours si le graphique echoue.'],
    },
    guide: {
      status: 'Installation client',
      primary: 'Utilise cette page comme checklist de livraison. Le QR EA520 sert a configurer le terminal sans ADB.',
      actions: ['Controle les adresses utiles.', 'Scanne le QR avec EA520.', 'Verifie partage et PXE avant livraison.'],
    },
    logs: {
      status: 'Diagnostic',
      primary: 'Les logs servent a comprendre rapidement si le souci vient du client PXE, du backend ou du reseau.',
      actions: ['Cherche les erreurs recentes.', 'Note le service concerne.', 'Relance seulement le service impacte.'],
    },
    settings: {
      status: 'Parametres',
      primary: 'Apres un changement de switch, routeur ou IP, utilise la regeneration reseau puis verifie les voyants avant de relancer un PC client.',
      actions: ['Lis le diagnostic reseau.', 'Clique Regenerer reseau si IP changee.', 'Cree une sauvegarde apres configuration stable.'],
    },
  }
  return sectionAdvice[section]
}

function ToolsModule({
  pxeStatus,
  config,
  isSaving,
  onCreateUsbKit,
  onRefreshUsbKits,
  onDownloadUsbKit,
  onDeleteUsbKit,
}: {
  pxeStatus: ForgePxeStatus | null
  config: ForgePxeConfig | null
  isSaving: boolean
  onCreateUsbKit: (profile: string) => Promise<ForgeUsbKitResponse | null>
  onRefreshUsbKits: () => Promise<ForgeUsbKitResponse[]>
  onDownloadUsbKit: (filename: string) => Promise<void>
  onDeleteUsbKit: (filename: string) => Promise<void>
}) {
  const serverUrl = pxeStatus?.server_url || `http://${window.location.hostname}:1950`
  const toolsUrl = `${serverUrl.replace(/\/$/, '')}/tests/`
  return (
    <div className="space-y-6">
      <PageTitle title="Outils" description="Tests navigateur atelier : clavier, pixels, USB, camera, micro et audio." icon={TestTube2} />
      <WorkshopUsbPanel config={config} isSaving={isSaving} onCreateUsbKit={onCreateUsbKit} onRefreshUsbKits={onRefreshUsbKits} onDownloadUsbKit={onDownloadUsbKit} onDeleteUsbKit={onDeleteUsbKit} />
      <section className="rounded-2xl border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/20">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <h2 className="text-lg font-semibold text-white">Console de test navigateur</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              A ouvrir directement sur la machine testee apres boot Windows ou depuis un navigateur disponible.
              Les resultats peuvent etre envoyes dans l'onglet Audit via le bouton Envoyer l'audit.
            </p>
            <div className="mt-4 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.045] p-4 font-mono text-sm text-cyan-100">
              {toolsUrl}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={toolsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
                Ouvrir les outils
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(toolsUrl)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
              >
                <Copy className="h-4 w-4" />
                Copier URL
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-4">
            <div className="text-sm font-semibold text-amber-100">Note camera / micro</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Chrome peut bloquer camera et micro sur une adresse HTTP locale. Dans ce cas, l'outil affiche l'erreur et le technicien valide OK/NOK manuellement.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function SettingsModule({
  status,
  config,
  diagnostic,
  isSaving,
  saveMessage,
  networkMessage,
  assistantEnabled,
  onAssistantEnabledChange,
  onSave,
  onResyncNetwork,
}: {
  status: ForgePxeStatus | null
  config: ForgePxeConfig | null
  diagnostic: ForgeNetworkDiagnosticResponse | null
  isSaving: boolean
  saveMessage: string | null
  networkMessage: string | null
  assistantEnabled: boolean
  onAssistantEnabledChange: (enabled: boolean) => void
  onSave: (config: ForgePxeConfig) => Promise<void>
  onResyncNetwork: () => Promise<void>
}) {
  return (
    <div className="space-y-6">
      <PageTitle title="Parametres" description="Configuration active lue depuis le backend AtelierOS." icon={Settings} />
      <AssistantSettingsPanel enabled={assistantEnabled} onChange={onAssistantEnabledChange} />
      <NetworkResyncPanel status={status} config={config} diagnostic={diagnostic} isRunning={isSaving} message={networkMessage} onResync={onResyncNetwork} />
      <SettingsPanel status={status} config={config} isSaving={isSaving} saveMessage={saveMessage} onSave={onSave} />
    </div>
  )
}

function NetworkResyncPanel({
  status,
  config,
  diagnostic,
  isRunning,
  message,
  onResync,
}: {
  status: ForgePxeStatus | null
  config: ForgePxeConfig | null
  diagnostic: ForgeNetworkDiagnosticResponse | null
  isRunning: boolean
  message: string | null
  onResync: () => Promise<void>
}) {
  const serverIp = status?.server_ip || config?.server_ip || 'non detecte'
  const serverUrl = status?.server_url || config?.server_url || '-'
  const share = status?.smb_share || config?.smb_share || '-'
  const ipMatches = diagnostic?.ip_matches ?? true
  const deployDirs = diagnostic?.deploy_dirs ? Object.entries(diagnostic.deploy_dirs) : []
  const fallbackDeployDirs: Array<[string, boolean]> = [['audit', false], ['iso', false], ['images', false], ['drivers', false], ['exports', false], ['incoming', false]]
  const offlineServices = diagnostic?.services.filter((service) => service.status !== 'online') ?? []

  return (
    <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4 shadow-xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Regeneration reseau</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              A utiliser apres changement de switch, routeur ou IP. AtelierOS redetecte l'adresse LAN, met a jour le partage et relance les services PXE/SMB.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onResync}
          disabled={isRunning}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', isRunning && 'animate-spin')} />
          {isRunning ? 'Resynchronisation...' : 'Regenerer reseau'}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoRow label="IP serveur" value={serverIp} mono />
        <InfoRow label="HTTP PXE" value={serverUrl} mono />
        <InfoRow label="Partage" value={share} mono />
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">Diagnostic lecture seule</div>
            <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', ipMatches && offlineServices.length === 0 ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-200')}>
              {ipMatches && offlineServices.length === 0 ? 'coherent' : 'a verifier'}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <InfoRow label="IP configuree" value={diagnostic?.configured_ip ?? serverIp} mono />
            <InfoRow label="IP detectee" value={diagnostic?.detected_ip ?? 'non detectee'} mono />
            <InfoRow label="Mode DHCP" value={diagnostic?.dhcp_mode ?? config?.mode ?? 'proxy DHCP'} />
          </div>
          <div className="mt-3 rounded-lg border border-cyan-300/10 bg-cyan-300/[0.06] px-3 py-2 text-xs leading-5 text-cyan-100">
            {diagnostic?.dhcp_mode_detail ?? 'Mode reseau en attente de diagnostic.'}
          </div>
          <div className={cn('mt-3 rounded-lg border px-3 py-2 text-sm', ipMatches ? 'border-emerald-300/15 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/20 bg-amber-300/10 text-amber-100')}>
            {diagnostic?.recommendation ?? 'Diagnostic en attente de synchronisation.'}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-3 text-sm font-semibold text-white">Stockage deploy</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(deployDirs.length ? deployDirs : fallbackDeployDirs).map(([name, ok]) => (
              <div key={name} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2 py-2">
                <span className={cn('h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]', ok ? 'bg-emerald-300 text-emerald-300' : 'bg-amber-300 text-amber-300')} />
                <span className="truncate text-xs font-semibold text-slate-300">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {message ? (
        <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}
    </section>
  )
}

function WorkshopUsbPanel({
  config,
  isSaving,
  onCreateUsbKit,
  onRefreshUsbKits,
  onDownloadUsbKit,
  onDeleteUsbKit,
}: {
  config: ForgePxeConfig | null
  isSaving: boolean
  onCreateUsbKit: (profile: string) => Promise<ForgeUsbKitResponse | null>
  onRefreshUsbKits: () => Promise<ForgeUsbKitResponse[]>
  onDownloadUsbKit: (filename: string) => Promise<void>
  onDeleteUsbKit: (filename: string) => Promise<void>
}) {
  const [kit, setKit] = useState<ForgeUsbKitResponse | null>(null)
  const [kits, setKits] = useState<ForgeUsbKitResponse[]>([])
  const [wizardStep, setWizardStep] = useState(1)
  const [usbProfile, setUsbProfile] = useState<'complete' | 'audit' | 'deployment'>('complete')
  const serverUrl = config?.server_url || 'http://192.168.1.57:1950'
  const share = config?.smb_share || '\\\\192.168.1.57\\deploy'
  const dashboardUrl = config?.server_url ? config.server_url.replace(':1950', '') : 'http://192.168.1.57'
  const files = [
    { path: 'AOS-USB\\README.txt', detail: 'Guide rapide technicien' },
    { path: 'UTILITAIRE-CREER-CLE-BOOTABLE.bat', detail: 'Assistant Windows' },
    { path: 'UTILITAIRE-CREER-CLE-BOOTABLE.ps1', detail: 'Script admin pour copier AOS-USB' },
    { path: 'ventoy\\AOS DISK.exe', detail: 'Optionnel: outil Ventoy/AOS a deposer ici' },
    { path: 'AOS-USB\\boot\\ipxe.iso', detail: 'ISO boot reseau secours' },
    { path: 'AOS-USB\\images\\', detail: 'Depot ISO/WIM si reseau indisponible' },
    { path: 'AOS-USB\\drivers\\', detail: 'Packs drivers atelier' },
    { path: 'AOS-USB\\tools\\', detail: 'Outils audit hors-ligne' },
  ]
  const steps = [
    'Generer puis telecharger le ZIP depuis AOS.',
    'Extraire le ZIP dans un dossier du poste atelier.',
    'Mettre AOS DISK.exe ou Ventoy2Disk.exe dans le dossier ventoy si disponible.',
    'Lancer UTILITAIRE-CREER-CLE-BOOTABLE.bat en administrateur.',
    'Choisir la bonne cle USB dans Ventoy puis installer.',
    `Copier les ressources depuis ${share} si besoin.`,
    'Redemarrer un PC test et verifier que la cle boote.',
  ]
  const readiness = [
    { label: 'Ventoy installe sur la cle', detail: 'La cle doit booter en UEFI et Legacy si possible.' },
    { label: 'Dossier AOS-USB cree', detail: 'Racine claire pour que tout technicien retrouve les fichiers.' },
    { label: 'ISO iPXE ou WinPE secours copiee', detail: 'Permet de demarrer meme si le menu reseau direct pose probleme.' },
    { label: 'Drivers et outils synchronises', detail: 'Copier les dossiers utiles depuis le partage deploy.' },
    { label: 'Test sur un PC reel', detail: 'Ne pas livrer une cle jamais testee.' },
  ]
  const readme = [
    'AtelierOS - Cle USB atelier autonome',
    '',
    `Dashboard: ${dashboardUrl}`,
    `Serveur PXE/tests: ${serverUrl}`,
    `Partage reseau: ${share}`,
    '',
    'Utilisation rapide:',
    '1. Creer la cle avec UTILITAIRE-CREER-CLE-BOOTABLE.bat.',
    '2. Demarrer le PC sur la cle USB.',
    '3. Choisir le menu Ventoy/iPXE ou WinPE selon le besoin.',
    '4. Si le reseau est disponible, ouvrir le dashboard AtelierOS et lancer Audit rapide ou Deploiement.',
    '5. Si le reseau est indisponible, utiliser les dossiers images, drivers et tools comme secours.',
    '6. Apres intervention, remonter les resultats dans AtelierOS des que le reseau revient.',
    '',
    'Structure attendue:',
    ...files.map((file) => `- ${file.path}: ${file.detail}`),
  ].join('\n')
  const usbProfiles = [
    { id: 'complete', title: 'Multitool complet', detail: 'Audit, tests, ISO/WIM, drivers et secours PXE.' },
    { id: 'audit', title: 'Audit rapide', detail: 'Controle machine, etiquette, tests atelier et retour audit.' },
    { id: 'deployment', title: 'Deploiement Windows', detail: 'ISO/WIM, drivers, Unattend et installation Windows.' },
  ] as const
  const profileTitle = (profile: string) => usbProfiles.find((item) => item.id === profile)?.title ?? 'Multitool complet'

  const createKit = async () => {
    const result = await onCreateUsbKit(usbProfile)
    if (result) {
      setKit(result)
      setKits((current) => [result, ...current.filter((item) => item.filename !== result.filename)].slice(0, 5))
      setWizardStep(2)
    }
  }
  const refreshKits = async () => {
    const result = await onRefreshUsbKits()
    setKits(result)
    if (!kit && result.length) setKit(result[0])
  }

  useEffect(() => {
    void refreshKits()
  }, [])

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 shadow-xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Cle USB atelier bootable</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Parcours complet: AtelierOS genere le kit, l'utilitaire Windows installe Ventoy/AOS DISK sur la cle, puis copie le dossier AOS-USB.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void createKit()}
            className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Generation...' : 'Generer kit ZIP'}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void refreshKits()}
            className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Rafraichir kits
          </button>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(readme)}
            className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Copier README
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile('AOS-USB-README.txt', readme)}
            className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
          >
            Telecharger README
          </button>
        </div>
      </div>
      {kit ? (
        <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-emerald-100">{kit.message}</div>
              <div className="mt-2 truncate font-mono text-xs text-cyan-100">{kit.smb_path}</div>
              <div className="mt-1 text-xs text-emerald-200">{kit.filename} - {kit.size_mb} MB - {kit.included.length} fichier(s)</div>
            </div>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(kit.smb_path)}
              className="shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Copier chemin ZIP
            </button>
            <button
              type="button"
              onClick={() => void onDownloadUsbKit(kit.filename)}
              className="shrink-0 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
            >
              Telecharger ZIP
            </button>
          </div>
          <div className="mt-3 grid gap-1 text-xs text-slate-300 sm:grid-cols-2 xl:grid-cols-3">
            {kit.included.slice(0, 9).map((item) => (
              <div key={item} className="truncate rounded-lg border border-white/10 bg-black/20 px-2 py-1 font-mono">{item}</div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-white">Assistant debutant - creer une cle Multitool bootable</h4>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Parcours simple pour un technicien: generer le kit, telecharger le ZIP, lancer l'utilitaire Windows, choisir la cle, tester le boot.
            </p>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">Mode guide</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {usbProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setUsbProfile(profile.id)}
              className={cn(
                'rounded-xl border p-4 text-left transition',
                usbProfile === profile.id ? 'border-cyan-300/35 bg-cyan-300/12 shadow-lg shadow-cyan-500/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.04]',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-white">{profile.title}</div>
                {usbProfile === profile.id ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : null}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{profile.detail}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void createKit()}
            className={cn(
              'min-h-[150px] rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
              wizardStep === 1 ? 'border-cyan-300/30 bg-cyan-300/10 shadow-lg shadow-cyan-500/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.04]',
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 font-mono text-sm font-bold text-cyan-100">01</span>
              {kit ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Zap className="h-5 w-5 text-cyan-200" />}
            </div>
            <div className="font-semibold text-white">Creer le kit {profileTitle(usbProfile)}</div>
            <div className="mt-2 text-sm leading-6 text-slate-400">AtelierOS prepare le ZIP, les dossiers AOS-USB, README, raccourcis et scripts de creation.</div>
          </button>
          <button
            type="button"
            disabled={!kit || isSaving}
            onClick={() => {
              if (kit) {
                setWizardStep(3)
                void onDownloadUsbKit(kit.filename)
              }
            }}
            className={cn(
              'min-h-[150px] rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
              wizardStep === 2 ? 'border-emerald-300/30 bg-emerald-300/10 shadow-lg shadow-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.04]',
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 font-mono text-sm font-bold text-emerald-100">02</span>
              <HardDrive className="h-5 w-5 text-emerald-200" />
            </div>
            <div className="font-semibold text-white">Telecharger le ZIP</div>
            <div className="mt-2 text-sm leading-6 text-slate-400">{kit ? kit.filename : 'Disponible apres creation du kit.'}</div>
          </button>
          <div className={cn(
            'min-h-[150px] rounded-xl border p-4',
            wizardStep >= 3 ? 'border-amber-300/30 bg-amber-300/10 shadow-lg shadow-amber-500/10' : 'border-white/10 bg-black/20',
          )}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 font-mono text-sm font-bold text-amber-100">03</span>
              <Printer className="h-5 w-5 text-amber-200" />
            </div>
            <div className="font-semibold text-white">Rendre la cle bootable</div>
            <div className="mt-2 text-sm leading-6 text-slate-400">
              Extraire le ZIP, clic droit sur `UTILITAIRE-CREER-CLE-BOOTABLE.bat`, executer en administrateur, installer Ventoy, puis tester le boot.
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            Important: le navigateur ne peut pas formater une cle USB directement. Le formatage bootable est fait par Ventoy/AOS DISK via l'utilitaire Windows inclus, avec validation humaine du disque pour eviter d'effacer le mauvais support.
          </div>
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm leading-6 text-emerald-100">
            Pour inclure ton outil local, copie `AOS DISK.exe` dans le dossier `ventoy` du ZIP extrait avant de lancer l'utilitaire. Sinon le script te demandera d'ajouter Ventoy manuellement.
          </div>
        </div>
      </div>
      {kits.length ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Kits USB disponibles</div>
              <div className="mt-1 text-xs text-slate-500">Derniers ZIP generes dans le partage exports/aos-usb-kits.</div>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">{kits.length}</span>
          </div>
          <div className="grid gap-2">
            {kits.slice(0, 5).map((item) => (
              <div key={item.filename} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{item.filename}</div>
                  <div className="mt-1 truncate font-mono text-xs text-cyan-200">{item.smb_path}</div>
                  <div className="mt-1 text-xs text-slate-500">{profileTitle(item.profile)} - {item.size_mb} MB - {item.included.length || '?'} fichier(s)</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setKit(item)
                      void navigator.clipboard?.writeText(item.smb_path)
                    }}
                    className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Copier chemin
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDownloadUsbKit(item.filename)}
                    className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                  >
                    Telecharger
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      if (window.confirm(`Supprimer le kit USB ${item.filename} ?`)) {
                        await onDeleteUsbKit(item.filename)
                        const result = await onRefreshUsbKits()
                        setKits(result)
                        if (kit?.filename === item.filename) setKit(result[0] ?? null)
                      }
                    }}
                    className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Structure recommandee</div>
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.path} className="grid grid-cols-[1.2fr_1fr] gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs">
                <span className="truncate font-mono text-cyan-100">{file.path}</span>
                <span className="text-slate-400">{file.detail}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checklist avant livraison</div>
          <div className="space-y-2">
            {readiness.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,.8)]" />
                  {item.label}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Procedure technicien</div>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-300">
                <span className="font-mono text-cyan-200">{String(index + 1).padStart(2, '0')}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function AssistantSettingsPanel({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 shadow-xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Assistant AtelierOS</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">Petit robot de conseil contextuel pour guider les techniciens dans chaque onglet.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(!enabled)}
          className={cn('relative h-8 w-16 rounded-full border transition', enabled ? 'border-emerald-300/30 bg-emerald-300/20' : 'border-white/10 bg-white/[0.05]')}
          aria-pressed={enabled}
        >
          <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow-lg transition', enabled ? 'left-9' : 'left-1')} />
          <span className="sr-only">{enabled ? 'Desactiver assistant' : 'Activer assistant'}</span>
        </button>
      </div>
      <div className={cn('mt-3 rounded-xl border px-3 py-2 text-sm', enabled ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-slate-500/20 bg-white/[0.035] text-slate-400')}>
        {enabled ? 'Assistant actif sur ce poste.' : 'Assistant masque sur ce poste.'}
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-lg', statusStyles[status])}>
      <span className="mr-2 h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_14px_currentColor]" />
      {statusLabels[status]}
    </span>
  )
}

function ProgressBar({ value, status }: { value: number; status: DeploymentStatus }) {
  const color = status === 'success' ? 'from-emerald-300 to-teal-300' : status === 'failed' ? 'from-rose-400 to-red-300' : 'from-cyan-300 via-blue-400 to-violet-400'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out shadow-[0_0_18px_rgba(34,211,238,0.55)]', color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

function ActiveDeployments({ deployments }: { deployments: ActiveDeployment[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/65 shadow-2xl shadow-black/25 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Deploiements actifs</h2>
          <p className="text-sm text-slate-400">Flux PXE, WinPE et image Windows en cours</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
          <Activity className="h-3.5 w-3.5" />
          Live stream
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
              <th className="px-5 py-3 font-semibold">Machine</th>
              <th className="px-5 py-3 font-semibold">Reseau</th>
              <th className="px-5 py-3 font-semibold">Image</th>
              <th className="px-5 py-3 font-semibold">Statut</th>
              <th className="px-5 py-3 font-semibold">Progression</th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((deployment) => (
              <tr key={deployment.id} className="group border-t border-white/10">
                <td className="border-t border-white/10 px-5 py-4">
                  <div className="font-semibold text-slate-100">{deployment.hostname}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{deployment.id} - {deployment.bootMode}</div>
                </td>
                <td className="border-t border-white/10 px-5 py-4">
                  <div className="font-mono text-sm text-cyan-100">{deployment.ipAddress}</div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{deployment.macAddress}</div>
                </td>
                <td className="border-t border-white/10 px-5 py-4">
                  <div className="text-sm font-medium text-slate-200">{deployment.imageName}</div>
                  <div className="mt-1 text-xs text-slate-500">{deployment.lastEvent}</div>
                </td>
                <td className="border-t border-white/10 px-5 py-4">
                  <StatusBadge status={deployment.status} />
                </td>
                <td className="border-t border-white/10 px-5 py-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{deployment.progress}%</span>
                    <span className="font-mono text-slate-500">{deployment.throughputMbps} Mbps</span>
                  </div>
                  <ProgressBar value={deployment.progress} status={deployment.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function LogConsole({ logs }: { logs: LogEntry[] }) {
  const levelColor: Record<LogEntry['level'], string> = {
    info: 'text-cyan-300',
    success: 'text-emerald-300',
    warn: 'text-amber-300',
    error: 'text-rose-300',
  }
  const diagnoses = logs.map(logDiagnosis).filter(Boolean).slice(0, 4) as Array<{ title: string; detail: string; action: string; tone: 'amber' | 'rose' | 'cyan' }>

  return (
    <div className="space-y-4">
      {diagnoses.length ? (
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl shadow-black/20">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Diagnostic logs</h2>
              <p className="text-sm text-slate-400">Causes probables detectees automatiquement.</p>
            </div>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-100">{diagnoses.length}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {diagnoses.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]', item.tone === 'rose' ? 'bg-rose-300 text-rose-300' : item.tone === 'cyan' ? 'bg-cyan-300 text-cyan-300' : 'bg-amber-300 text-amber-300')} />
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</div>
                <div className="mt-2 text-xs font-semibold text-cyan-200">{item.action}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="flex h-full min-h-[420px] flex-col rounded-2xl border border-white/10 bg-[#05070b] shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-emerald-300" />
            <div>
              <h2 className="text-lg font-semibold text-white">Console logs</h2>
              <p className="text-sm text-slate-500">dnsmasq, wimboot, WinPE, deploy-api</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">stream</span>
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-6">
          {logs.map((log) => (
            <div key={log.id} className="grid grid-cols-[92px_92px_minmax(0,1fr)] gap-3 border-b border-white/[0.04] py-1.5">
              <span className="text-slate-600">{log.timestamp}</span>
              <span className={cn('font-semibold', levelColor[log.level])}>[{log.source}]</span>
              <span className="text-slate-300">{log.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function logDiagnosis(log: LogEntry) {
  const text = `${log.source} ${log.message}`.toLowerCase()
  if (text.includes('service') && text.includes('offline')) {
    if (text.includes('smb') || text.includes('partage')) {
      return {
        title: 'Partage SMB indisponible',
        detail: 'Le depot reseau peut etre inaccessible depuis les PC atelier. Les ISO, audits ou drivers peuvent ne pas se synchroniser.',
        action: 'Aller dans Parametres > Regeneration reseau puis tester \\\\IP_SERVEUR\\deploy depuis Windows.',
        tone: 'rose' as const,
      }
    }
    if (text.includes('http') || text.includes('pxe')) {
      return {
        title: 'HTTP PXE indisponible',
        detail: 'Le client peut recevoir le boot PXE mais ne pas telecharger le menu, WinPE ou les scripts.',
        action: 'Verifier forge-nginx-pxe, puis Parametres > Regenerer reseau.',
        tone: 'rose' as const,
      }
    }
    if (text.includes('api') || text.includes('backend')) {
      return {
        title: 'Backend API indisponible',
        detail: 'L interface peut s ouvrir mais les retours audits, images et commandes machines ne fonctionneront pas correctement.',
        action: 'Verifier aos-backend puis ouvrir Guide > Diagnostic.',
        tone: 'rose' as const,
      }
    }
  }
  if (text.includes('asset') && (text.includes('missing') || text.includes('absent') || text.includes('a generer') || text.includes('deposer'))) {
    return {
      title: 'Ressource PXE manquante',
      detail: 'Un fichier de boot ou WinPE manque sur le serveur. Le menu peut apparaitre mais l audit graphique ou le deploiement ne partira pas.',
      action: 'Ouvrir Images WIM > Assets PXE et deposer/generer le fichier indique.',
      tone: 'amber' as const,
    }
  }
  if (text.includes('ip inconnue') || text.includes('no ip') || text.includes('unknown ip')) {
    return {
      title: 'Client sans adresse IP',
      detail: 'La machine PXE est vue mais son adresse IP ne remonte pas. Causes probables: DHCP, cable, VLAN, switch ou lien direct mal configure.',
      action: 'Relancer Parametres > Regenerer reseau puis refaire un boot PXE propre.',
      tone: 'amber' as const,
    }
  }
  if (text.includes('tftp') && (text.includes('timeout') || text.includes('not found') || text.includes('failed'))) {
    return {
      title: 'TFTP ne fournit pas le fichier',
      detail: 'Le client PXE demande un fichier absent ou inaccessible. Souvent: chemin boot incorrect, asset PXE manquant ou service TFTP KO.',
      action: 'Verifier Images WIM > Assets PXE puis Parametres > Regeneration reseau.',
      tone: 'rose' as const,
    }
  }
  if (text.includes('dhcp') && (text.includes('no address') || text.includes('proxy') || text.includes('offer'))) {
    return {
      title: 'DHCP/PXE a verifier',
      detail: 'Le client ne recoit pas une reponse PXE coherente. Causes probables: mauvais VLAN, DHCP externe prioritaire, mode direct/switch change.',
      action: 'Lancer Parametres > Regenerer reseau puis refaire un boot PXE.',
      tone: 'amber' as const,
    }
  }
  if (text.includes('winpe') && (text.includes('missing') || text.includes('not ready') || text.includes('absent'))) {
    return {
      title: 'WinPE manquant',
      detail: 'Le menu PXE peut booter mais les tests/deploiements ne demarrent pas si WinPE ou wimboot manque.',
      action: 'Aller dans Images WIM et preparer WinPE/assets avant le test client.',
      tone: 'amber' as const,
    }
  }
  if (text.includes('network error') || text.includes('connection refused') || text.includes('failed to fetch')) {
    return {
      title: 'API ou reseau inaccessible',
      detail: 'Le navigateur ou l agent PXE ne joint pas le backend. Causes probables: IP changee, service backend arrete, pare-feu ou proxy.',
      action: 'Verifier Dashboard > Services puis Parametres > Diagnostic lecture seule.',
      tone: 'rose' as const,
    }
  }
  if (log.level === 'warn' || log.level === 'error') {
    return {
      title: 'Evenement a controler',
      detail: log.message,
      action: 'Lire la ligne source et verifier le module lie.',
      tone: log.level === 'error' ? 'rose' as const : 'amber' as const,
    }
  }
  return null
}

function TopologyPanel() {
  return (
    <section id="boot" className="scroll-mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Boot fabric</h2>
          <p className="text-sm text-slate-400">Chaine technique UEFI controlee</p>
        </div>
        <Network className="h-5 w-5 text-cyan-200" />
      </div>
      <div className="space-y-3">
        {[
          { icon: RadioTower, label: 'DHCP Proxy', value: 'Port 4011', tone: 'text-cyan-200' },
          { icon: Server, label: 'TFTP / iPXE', value: 'UEFI x64 actif', tone: 'text-emerald-200' },
          { icon: Boxes, label: 'WinPE Store', value: 'WIM + drivers', tone: 'text-blue-200' },
          { icon: ShieldCheck, label: 'Validation', value: 'Secure pipeline', tone: 'text-violet-200' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className={cn('grid h-10 w-10 place-items-center rounded-lg bg-white/[0.055]', item.tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="text-xs text-slate-500">{item.value}</div>
              </div>
              <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-300" />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function AssetPanel({ assets }: { assets: ForgePxeAsset[] }) {
  const displayAssets = assets.length
    ? assets
    : [
        { key: 'menu', label: 'Menu iPXE', status: 'ready', detail: 'Menu HTTP disponible.', url: null },
        { key: 'winpe', label: 'WinPE', status: 'missing', detail: 'Image WinPE a deposer.', url: null },
      ]
  return (
    <section id="images" className="scroll-mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Images WIM & assets</h2>
          <p className="text-sm text-slate-400">Etat reel des ressources PXE exposees par l'API</p>
        </div>
        <Database className="h-5 w-5 text-cyan-200" />
      </div>
      <div className="space-y-3">
        {displayAssets.map((asset) => {
          const ready = asset.status === 'ready'
          return (
            <div key={asset.key} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">{asset.label}</div>
                <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', ready ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-200')}>
                  {asset.status}
                </span>
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-400">{asset.detail}</div>
              {asset.url && <div className="mt-2 truncate font-mono text-xs text-cyan-200">{asset.url}</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function WimCreatorPanel({
  recipes,
  generatedScript,
  isCreating,
  onCreateRecipe,
  onLoadScript,
}: {
  recipes: ForgeWimRecipe[]
  generatedScript: string | null
  isCreating: boolean
  onCreateRecipe: (recipe: Omit<ForgeWimRecipe, 'id' | 'created_at'>) => Promise<void>
  onLoadScript: (recipeId: string) => Promise<void>
}) {
  const [form, setForm] = useState<Omit<ForgeWimRecipe, 'id' | 'created_at'>>({
    name: 'Windows 11 Pro - client',
    windows_iso_path: 'C:\\AOS\\ISO\\windows.iso',
    work_dir: 'C:\\AOS\\WIM',
    output_wim_path: 'C:\\AOS\\Output\\install-custom.wim',
    image_index: 1,
    driver_path: 'C:\\AOS\\Drivers',
    include_drivers: true,
    enable_dotnet35: false,
    enable_powershell: true,
    cleanup_image: true,
  })
  const inputClass = 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-cyan-300/5'
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Createur WIM client</h2>
          <p className="text-sm text-slate-400">Assistant DISM/ADK pour generer un install.wim sans commandes manuelles.</p>
        </div>
        <Terminal className="h-5 w-5 text-emerald-200" />
      </div>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onCreateRecipe(form)
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <FieldLabel label="Nom du profil">
            <input className={inputClass} value={form.name} onChange={(event) => update('name', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="ISO Windows">
            <input className={inputClass} value={form.windows_iso_path} onChange={(event) => update('windows_iso_path', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Dossier de travail">
            <input className={inputClass} value={form.work_dir} onChange={(event) => update('work_dir', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="WIM de sortie">
            <input className={inputClass} value={form.output_wim_path} onChange={(event) => update('output_wim_path', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Dossier pilotes">
            <input className={inputClass} value={form.driver_path} onChange={(event) => update('driver_path', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Index image">
            <input className={inputClass} type="number" min={1} value={form.image_index} onChange={(event) => update('image_index', Number(event.target.value))} />
          </FieldLabel>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['include_drivers', 'Injecter pilotes'],
            ['enable_dotnet35', 'Activer .NET 3.5'],
            ['enable_powershell', 'PowerShell'],
            ['cleanup_image', 'Nettoyage image'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm font-semibold text-slate-100">
              <input
                type="checkbox"
                checked={Boolean(form[key as keyof typeof form])}
                onChange={(event) => update(key as keyof typeof form, event.target.checked as never)}
                className="h-4 w-4 accent-cyan-300"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.045] p-4">
          <div className="text-sm text-slate-300">Le script produit monte l'ISO, extrait install.wim/esd, injecte les pilotes/options, puis exporte un WIM propre.</div>
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? 'Creation...' : 'Creer le profil WIM'}
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          {recipes.length === 0 && <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm text-slate-400">Aucun profil WIM sauvegarde.</div>}
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => onLoadScript(recipe.id)}
              className="block w-full rounded-xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-cyan-300/25 hover:bg-cyan-300/10"
            >
              <div className="font-semibold text-white">{recipe.name}</div>
              <div className="mt-1 truncate font-mono text-xs text-slate-500">{recipe.output_wim_path}</div>
              <div className="mt-3 text-xs font-semibold text-cyan-200">Afficher script PowerShell</div>
            </button>
          ))}
        </div>
        <pre className="min-h-[360px] overflow-auto rounded-xl border border-white/10 bg-[#05070b] p-4 font-mono text-xs leading-5 text-slate-300">
          {generatedScript ?? 'Le script PowerShell apparait ici apres creation ou selection d un profil.'}
        </pre>
      </div>
    </section>
  )
}

function MediaUploadPanel({
  images,
  isSaving,
  onUploadMedia,
  onCheckMedia,
  serverMediaFiles,
  externalMediaSources,
  onRefreshMediaFiles,
  onImportExternalMediaSource,
  onDeleteMediaFile,
  onChecksumMediaFile,
  onCreateImageFromMedia,
  onPrepareIsoMedia,
  onInspectWimIndexes,
  checkStatusMessage,
  uploadMessage,
  onClearMessages,
}: {
  images: ForgeWimImage[]
  isSaving: boolean
  onUploadMedia: (
    file: File,
    kind: 'iso' | 'image',
    name: string,
    version: string,
    architecture: string,
    overwrite: boolean,
    onProgress: (percent: number | null) => void,
  ) => Promise<void>
  onCheckMedia: (file: File, kind: 'iso' | 'image') => Promise<ForgeMediaStatusResponse | null>
  serverMediaFiles: ForgeServerMediaFile[]
  externalMediaSources: ForgeExternalMediaSource[]
  onRefreshMediaFiles: () => Promise<void>
  onImportExternalMediaSource: (source: ForgeExternalMediaSource) => Promise<ForgeExternalMediaImportResponse | null>
  onDeleteMediaFile: (file: ForgeServerMediaFile) => Promise<void>
  onChecksumMediaFile: (file: ForgeServerMediaFile) => Promise<ForgeServerMediaChecksumResponse | null>
  onCreateImageFromMedia: (file: ForgeServerMediaFile) => Promise<void>
  onPrepareIsoMedia: (file: ForgeServerMediaFile, imageIndex?: number) => Promise<void>
  onInspectWimIndexes: (sourcePath: string) => Promise<ForgeWimIndex[]>
  checkStatusMessage: string
  uploadMessage: string | null
  onClearMessages: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<'iso' | 'image'>('image')
  const [name, setName] = useState('Windows 11 Pro')
  const [version, setVersion] = useState('24H2')
  const [architecture, setArchitecture] = useState('x64')
  const [mediaStatus, setMediaStatus] = useState<ForgeMediaStatusResponse | null>(null)
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [checksums, setChecksums] = useState<Record<string, string>>({})
  const [checksumLoadingKey, setChecksumLoadingKey] = useState<string | null>(null)
  const [externalImportingId, setExternalImportingId] = useState<string | null>(null)
  const [externalImportMessage, setExternalImportMessage] = useState<string | null>(null)
  const [indexChooser, setIndexChooser] = useState<{
    file: ForgeServerMediaFile
    indexes: ForgeWimIndex[]
    isLoading: boolean
    error: string | null
    mode: 'view' | 'prepare'
  } | null>(null)
  const inputClass = 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-cyan-300/5'
  const fileSize = file ? `${(file.size / (1024 ** 3)).toFixed(2)} GB` : 'Aucun fichier'
  const humanSize = mediaStatus?.size ? `${Math.max(0.1, mediaStatus.size / (1024 ** 2)).toFixed(1)} MB` : null
  const statusLine = mediaStatus
    ? mediaStatus.exists
      ? `Fichier deja present (${humanSize ?? '0 MB'})`
      : `${mediaStatus.filename} absent du serveur`
    : checkStatusMessage || ''
  const formattedDate = mediaStatus?.modified_at ? new Date(mediaStatus.modified_at).toLocaleString() : ''
  const isoCount = serverMediaFiles.filter((item) => item.kind === 'iso').length
  const imageCount = serverMediaFiles.filter((item) => item.kind === 'image').length
  const smbHost = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? window.location.hostname
    : '192.168.1.57'
  const isoDropPath = `\\\\${smbHost}\\deploy\\iso`
  const imageDropPath = `\\\\${smbHost}\\deploy\\images`
  const declaredImagePaths = new Set(images.map((image) => image.path.trim().toLowerCase()))
  const mediaKey = (item: ForgeServerMediaFile) => `${item.folder}/${item.filename}`
  const openIndexes = async (item: ForgeServerMediaFile, mode: 'view' | 'prepare') => {
    setIndexChooser({ file: item, indexes: [], isLoading: true, error: null, mode })
    try {
      const indexes = await onInspectWimIndexes(item.smb_path)
      setIndexChooser({ file: item, indexes, isLoading: false, error: indexes.length ? null : 'Aucune edition Windows detectee dans ce fichier.', mode })
    } catch (error) {
      setIndexChooser({
        file: item,
        indexes: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Lecture editions impossible',
        mode,
      })
    }
  }
  const selectImageIndex = (entry: ForgeWimIndex) => {
    if (!indexChooser) return
    const selectedFile = indexChooser.file
    setIndexChooser(null)
    void onPrepareIsoMedia(selectedFile, entry.index)
  }
  const calculateChecksum = async (item: ForgeServerMediaFile) => {
    const key = mediaKey(item)
    setChecksumLoadingKey(key)
    try {
      const result = await onChecksumMediaFile(item)
      if (result?.sha256) {
        setChecksums((current) => ({ ...current, [key]: result.sha256 }))
      }
    } finally {
      setChecksumLoadingKey(null)
    }
  }
  const importExternalSource = async (source: ForgeExternalMediaSource) => {
    setExternalImportingId(source.id)
    setExternalImportMessage(null)
    try {
      const result = await onImportExternalMediaSource(source)
      if (result?.command && !result.imported) {
        setExternalImportMessage(`${result.message} Commande: ${result.command}`)
        void navigator.clipboard?.writeText(result.command)
      } else if (result) {
        setExternalImportMessage(result.message)
      }
    } finally {
      setExternalImportingId(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!file) {
        setMediaStatus(null)
        setOverwriteExisting(false)
        setProgress(null)
        return
      }
      const status = await onCheckMedia(file, kind)
      if (!cancelled) {
        setMediaStatus(status)
        setOverwriteExisting(Boolean(status?.exists))
        if (!status?.exists) {
          setProgress(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file, kind, onCheckMedia])

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.045] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Importer une image Windows</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Choisis un ISO Windows, un install.wim ou un install.esd. Les WIM/ESD peuvent etre declares directement; les ISO devront ensuite etre convertis/prepares.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">{isoCount} ISO</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">{imageCount} WIM/ESD</span>
          </div>
        </div>
        {!serverMediaFiles.length ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            <div className="rounded-xl border border-cyan-300/15 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Option simple: copier depuis Windows</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Ouvre le partage reseau, depose l'ISO Windows dans le dossier `iso`, puis clique Rafraichir.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-cyan-100">{isoDropPath}</code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(isoDropPath)}
                  className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                >
                  Copier chemin ISO
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-300/15 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Option directe: WIM/ESD deja pret</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Si tu as deja un `install.wim` ou `install.esd`, depose-le dans `images`, puis declare-le comme image PXE.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-emerald-100">{imageDropPath}</code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(imageDropPath)}
                  className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                >
                  Copier chemin WIM
                </button>
              </div>
            </div>
            {externalMediaSources.slice(0, 2).map((source) => (
              <div key={source.id} className="rounded-xl border border-amber-300/15 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">{source.label}</div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">{source.source_type}</span>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-400">{source.message}</div>
                <div className="mt-2 text-xs text-slate-500">
                  {source.size_gb ? `${source.size_gb} GB` : 'taille inconnue'}{source.modified_at ? ` - ${new Date(source.modified_at).toLocaleString('fr-FR')}` : ''}
                </div>
                <div className="mt-3 space-y-2">
                  <code className="block break-all rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-amber-100">{source.path}</code>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void importExternalSource(source)}
                      disabled={externalImportingId === source.id}
                      className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {externalImportingId === source.id ? 'Import...' : 'Importer source'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(source.path)}
                      className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/15"
                    >
                      Copier chemin
                    </button>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(source.copy_hint)}
                      className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                    >
                      Copier commande
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {externalImportMessage ? (
          <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
            {externalImportMessage}
          </div>
        ) : null}
      </div>

      <form
        className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!file) return
          if (mediaStatus?.exists && !overwriteExisting) return
          onClearMessages()
          setProgress(0)
          onUploadMedia(
            file,
            kind,
            name,
            version,
            architecture,
            overwriteExisting,
            (value) => {
              setProgress(value)
            },
          )
        }}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_180px]">
          <FieldLabel label="Fichier">
            <input
              className={inputClass}
              type="file"
              accept=".iso,.wim,.esd"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null
                onClearMessages()
                setFile(selected)
                setProgress(null)
                if (selected?.name.toLowerCase().endsWith('.iso')) setKind('iso')
                if (selected?.name.toLowerCase().match(/\.(wim|esd)$/)) setKind('image')
              }}
            />
          </FieldLabel>
          <FieldLabel label="Type">
            <select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as 'iso' | 'image')}>
              <option value="image">Image WIM/ESD</option>
              <option value="iso">ISO Windows</option>
            </select>
          </FieldLabel>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_160px_140px]">
          <FieldLabel label="Nom inventaire">
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Version">
            <input className={inputClass} value={version} onChange={(event) => setVersion(event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Architecture">
            <input className={inputClass} value={architecture} onChange={(event) => setArchitecture(event.target.value)} />
          </FieldLabel>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
          <div>
            <div className="font-semibold text-white">{file?.name ?? 'Selectionne un fichier'}</div>
            <div className="mt-1 text-xs text-slate-500">{fileSize} - destination {kind === 'iso' ? '\\\\serveur\\deploy\\iso' : '\\\\serveur\\deploy\\images'}</div>
            <div className="mt-1 text-xs text-slate-300">{statusLine}</div>
            {mediaStatus?.modified_at ? <div className="mt-1 text-xs text-slate-500">Derniere modif: {formattedDate}</div> : null}
            {mediaStatus?.exists ? (
              <label className="mt-2 inline-flex items-center gap-2 text-xs">
                <input
                  className="h-4 w-4 accent-cyan-300"
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(event) => setOverwriteExisting(event.target.checked)}
                />
                <span className="text-amber-200">Remplacer le fichier existant</span>
              </label>
            ) : null}
            {uploadMessage ? <div className="mt-1 text-xs text-emerald-100">{uploadMessage}</div> : null}
          </div>
          {progress !== null ? (
            <div className="w-full">
              <div className="mb-1 text-xs text-slate-300">Progression: {progress}%</div>
              <div className="h-2 w-72 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, progress ?? 0))}%` }}
                />
              </div>
            </div>
          ) : null}
          <button
            type="submit"
            disabled={isSaving || !file || (mediaStatus?.exists && !overwriteExisting)}
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Envoyer au serveur
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Fichiers deja sur le serveur</h3>
            <p className="mt-1 text-xs text-slate-500">ISO, WIM et ESD detectes dans le stockage AtelierOS.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onRefreshMediaFiles()}
              className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
            >
              Rafraichir
            </button>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">{serverMediaFiles.length} fichier(s)</span>
          </div>
        </div>
        {serverMediaFiles.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-400">Aucun media detecte pour l'instant. Le fichier apparaitra ici apres synchronisation.</div>
        ) : (
          <div className="max-h-72 overflow-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fichier</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Etat</th>
                  <th className="px-3 py-2">Taille</th>
                  <th className="px-3 py-2">Modifie</th>
                  <th className="px-3 py-2">Chemin</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {serverMediaFiles.map((item) => {
                  const declared = item.kind === 'image' && declaredImagePaths.has(item.smb_path.trim().toLowerCase())
                  const stateLabel = declared ? 'Pret PXE' : item.kind === 'iso' ? 'A convertir' : 'A declarer'
                  const stateTone = declared ? 'emerald' : item.kind === 'iso' ? 'amber' : 'cyan'
                  const key = mediaKey(item)
                  const checksum = checksums[key]
                  return (
                  <tr key={`${item.folder}-${item.filename}`} className="bg-black/10">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-white">{item.filename}</div>
                      {declared ? <div className="mt-1 text-xs font-semibold text-emerald-200">Deja declare dans Image PXE</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', item.kind === 'iso' ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100')}>
                        {item.kind === 'iso' ? 'ISO' : 'WIM/ESD'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold',
                        stateTone === 'emerald'
                          ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                          : stateTone === 'amber'
                            ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                            : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
                      )}>
                        <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
                        {stateLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{item.size_gb ? `${item.size_gb} GB` : `${Math.round(item.size / (1024 ** 2))} MB`}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{new Date(item.modified_at).toLocaleString('fr-FR')}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 font-mono text-xs text-cyan-200">{item.smb_path}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => checksum ? void navigator.clipboard?.writeText(checksum) : void calculateChecksum(item)}
                          disabled={checksumLoadingKey === key}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-70"
                          title={checksum ? checksum : 'Calculer le SHA-256'}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {checksumLoadingKey === key ? 'Calcul...' : checksum ? `${checksum.slice(0, 8)}...` : 'SHA-256'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void openIndexes(item, 'view')}
                          className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                        >
                          <Search className="h-3.5 w-3.5" />
                          Editions
                        </button>
                        {declared ? (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 opacity-70"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Declare
                          </button>
                        ) : item.kind === 'image' ? (
                          <button
                            type="button"
                            onClick={() => void onCreateImageFromMedia(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                          >
                            <Database className="h-3.5 w-3.5" />
                            Declarer
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void openIndexes(item, 'prepare')}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2.5 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/15"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                            Preparer WIM
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Supprimer ${item.filename} du serveur ?`)) {
                              void onDeleteMediaFile(item)
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300/20 bg-red-300/10 px-2.5 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-300/15"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {indexChooser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-cyan-300/20 bg-[#08101b] p-5 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  {indexChooser.mode === 'prepare' ? 'Choisir edition a exporter' : 'Editions Windows detectees'}
                </div>
                <h3 className="mt-1 text-lg font-semibold text-white">{indexChooser.file.filename}</h3>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">{indexChooser.file.smb_path}</p>
              </div>
              <button
                type="button"
                onClick={() => setIndexChooser(null)}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {indexChooser.isLoading ? (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-slate-300">
                <RefreshCw className="h-4 w-4 animate-spin text-cyan-200" />
                Lecture des editions dans le fichier Windows...
              </div>
            ) : indexChooser.error ? (
              <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4">
                <div className="text-sm font-semibold text-amber-100">{indexChooser.error}</div>
                <p className="mt-1 text-xs text-amber-100/70">
                  Si l'image est valide mais non lisible, tu peux forcer l'index 1 pour demarrer la preparation.
                </p>
                {indexChooser.mode === 'prepare' ? (
                  <button
                    type="button"
                    onClick={() => selectImageIndex({ index: 1, name: 'Index 1', description: null, architecture: null })}
                    className="mt-3 rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-200/15"
                  >
                    Utiliser index 1
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {indexChooser.indexes.map((entry) => (
                  <div key={`${indexChooser.file.filename}-${entry.index}`} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">Index {entry.index}</span>
                          {entry.architecture ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-300">{entry.architecture}</span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-base font-semibold text-white">{entry.name || `Edition ${entry.index}`}</div>
                        {entry.description ? <div className="mt-1 text-sm leading-5 text-slate-400">{entry.description}</div> : null}
                      </div>
                      {indexChooser.mode === 'prepare' ? (
                        <button
                          type="button"
                          onClick={() => selectImageIndex(entry)}
                          className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                        >
                          Utiliser cette edition
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function WimImageInventory({
  images,
  isSaving,
  onCreateImage,
  onBuildWim,
  onSetDefaultImage,
  onDeleteImage,
}: {
  images: ForgeWimImage[]
  isSaving: boolean
  onCreateImage: (image: Omit<ForgeWimImage, 'id' | 'status' | 'is_default' | 'created_at'>) => Promise<void>
  onBuildWim: (imageId: string, payload: { reference?: string; version?: string; notes?: string; image_index?: number }) => Promise<ForgeWimBuildResponse | null>
  onSetDefaultImage: (imageId: string) => Promise<void>
  onDeleteImage: (imageId: string) => Promise<void>
}) {
  const [form, setForm] = useState<Omit<ForgeWimImage, 'id' | 'status' | 'is_default' | 'created_at'>>({
    name: 'Windows 11 Pro',
    version: '24H2',
    architecture: 'x64',
    path: '\\\\192.168.1.57\\deploy\\images\\install.wim',
    size_gb: null,
    source: 'manual',
    notes: '',
  })
  const [buildResult, setBuildResult] = useState<ForgeWimBuildResponse | null>(null)
  const inputClass = 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-cyan-300/5'
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }))
  const buildImage = async (image: ForgeWimImage) => {
    const result = await onBuildWim(image.id, {
      reference: `${image.name}-${image.architecture}`,
      version: image.version,
      notes: `Procedure WIM creee depuis ${image.path} avec index 1 par defaut`,
      image_index: 1,
    })
    if (result) setBuildResult(result)
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Images serveur pretes au deploiement</h2>
          <p className="text-sm text-slate-400">WIM/ESD disponibles pour le menu PXE. Si tu pars d'un ISO, commence par Parcourir.</p>
        </div>
        <Database className="h-5 w-5 text-cyan-200" />
      </div>

      <form
        className="mb-5 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onCreateImage(form)
        }}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_120px_120px_1.6fr_120px]">
          <FieldLabel label="Nom">
            <input className={inputClass} value={form.name} onChange={(event) => update('name', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Version">
            <input className={inputClass} value={form.version} onChange={(event) => update('version', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Arch">
            <input className={inputClass} value={form.architecture} onChange={(event) => update('architecture', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Chemin WIM/ESD">
            <input className={inputClass} value={form.path} onChange={(event) => update('path', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Taille GB">
            <input className={inputClass} type="number" step="0.1" value={form.size_gb ?? ''} onChange={(event) => update('size_gb', event.target.value ? Number(event.target.value) : null)} />
          </FieldLabel>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[280px] flex-1">
            <FieldLabel label="Notes">
              <input className={inputClass} value={form.notes ?? ''} onChange={(event) => update('notes', event.target.value)} />
            </FieldLabel>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ajouter image serveur
          </button>
        </div>
      </form>

      {buildResult ? (
        <div className="mb-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
          <div className="text-sm font-semibold text-emerald-100">{buildResult.message}</div>
          <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
            <InfoRow label="Reference" value={`${buildResult.reference} ${buildResult.version}`} />
            <InfoRow label="Dossier SMB" value={buildResult.smb_path} mono />
            <InfoRow label="Script" value={buildResult.script_path} mono />
            <InfoRow label="Manifest" value={buildResult.manifest_path} mono />
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-white/[0.035] text-xs uppercase tracking-[0.18em] text-slate-500">
              <th className="px-4 py-3 font-semibold">Image</th>
              <th className="px-4 py-3 font-semibold">Version</th>
              <th className="px-4 py-3 font-semibold">Chemin</th>
              <th className="px-4 py-3 font-semibold">Statut</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {images.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-sm text-slate-400">Aucune image serveur prete. Importe un ISO/WIM ou ajoute un chemin WIM existant.</td>
              </tr>
            )}
            {images.map((image) => (
              <tr key={image.id}>
                <td className="border-t border-white/10 px-4 py-4">
                  <div className="font-semibold text-white">{image.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{image.architecture} {image.size_gb ? `- ${image.size_gb} GB` : ''}</div>
                </td>
                <td className="border-t border-white/10 px-4 py-4 text-sm text-slate-300">{image.version}</td>
                <td className="border-t border-white/10 px-4 py-4">
                  <div className="max-w-[360px] truncate font-mono text-xs text-cyan-200">{image.path}</div>
                  {image.notes && <div className="mt-1 text-xs text-slate-500">{image.notes}</div>}
                </td>
                <td className="border-t border-white/10 px-4 py-4">
                  <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', image.is_default ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-slate-300/10 bg-white/[0.035] text-slate-300')}>
                    {image.is_default ? 'defaut' : image.status}
                  </span>
                </td>
                <td className="border-t border-white/10 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onSetDefaultImage(image.id)} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
                      Utiliser pour PXE
                    </button>
                    <button type="button" onClick={() => buildImage(image)} disabled={isSaving} className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60">
                      Creer WIM
                    </button>
                    <button type="button" onClick={() => onDeleteImage(image.id)} className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15">
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function UnattendPanel({
  profiles,
  generatedXml,
  isSaving,
  onCreateProfile,
  onSetDefaultProfile,
  onDeleteProfile,
  onLoadXml,
}: {
  profiles: ForgeUnattendProfile[]
  generatedXml: string | null
  isSaving: boolean
  onCreateProfile: (profile: Omit<ForgeUnattendProfile, 'id' | 'is_default' | 'created_at'>) => Promise<void>
  onSetDefaultProfile: (profileId: string) => Promise<void>
  onDeleteProfile: (profileId: string) => Promise<void>
  onLoadXml: (profileId: string) => Promise<void>
}) {
  const [form, setForm] = useState<Omit<ForgeUnattendProfile, 'id' | 'is_default' | 'created_at'>>({
    name: 'Installation Windows standard',
    locale: 'fr-FR',
    keyboard: '040c:0000040c',
    timezone: 'Romance Standard Time',
    computer_name: 'AOS-%SERIAL%',
    admin_username: 'Admin',
    admin_password: 'ChangeMe123!',
    organization: 'AtelierOS',
    product_key: '',
    deployment_mode: 'standard',
    accept_eula: true,
    skip_oobe: true,
    enable_rdp: true,
    auto_logon: false,
    create_local_account: true,
    include_drivers: true,
    run_first_logon_command: '',
  })
  const inputClass = 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-cyan-300/5'
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }))
  const applyPreset = (mode: 'standard' | 'marketplace') => {
    setForm((current) => ({
      ...current,
      name: mode === 'standard' ? 'Standard atelier - unattended' : 'Marketplace - OOBE propre',
      deployment_mode: mode,
      skip_oobe: mode === 'standard',
      create_local_account: mode === 'standard',
      auto_logon: false,
      include_drivers: true,
      admin_username: mode === 'standard' ? 'Admin' : '',
      admin_password: mode === 'standard' ? current.admin_password || 'ChangeMe123!' : '',
      run_first_logon_command: mode === 'marketplace' ? 'cmd /c del /q C:\\Windows\\Panther\\Unattend.xml' : '',
    }))
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Options Unattend</h2>
          <p className="text-sm text-slate-400">Generation autounattend.xml pour installation Windows sans assistant manuel.</p>
        </div>
        <ShieldCheck className="h-5 w-5 text-cyan-200" />
      </div>

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onCreateProfile(form)
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => applyPreset('standard')}
            className={cn('rounded-xl border p-4 text-left transition hover:bg-cyan-300/10', form.deployment_mode === 'standard' ? 'border-cyan-300/30 bg-cyan-300/10' : 'border-white/10 bg-white/[0.035]')}
          >
            <div className="font-semibold text-white">Standard atelier</div>
            <div className="mt-1 text-sm text-slate-400">Unattend complet, compte admin local, drivers integres.</div>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('marketplace')}
            className={cn('rounded-xl border p-4 text-left transition hover:bg-emerald-300/10', form.deployment_mode === 'marketplace' ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-white/10 bg-white/[0.035]')}
          >
            <div className="font-semibold text-white">Marketplace OOBE</div>
            <div className="mt-1 text-sm text-slate-400">Drivers installes, pas de compte client, premier demarrage propre.</div>
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <FieldLabel label="Nom profil">
            <input className={inputClass} value={form.name} onChange={(event) => update('name', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Locale">
            <input className={inputClass} value={form.locale} onChange={(event) => update('locale', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Clavier">
            <input className={inputClass} value={form.keyboard} onChange={(event) => update('keyboard', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Timezone">
            <input className={inputClass} value={form.timezone} onChange={(event) => update('timezone', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Nom machine">
            <input className={inputClass} value={form.computer_name} onChange={(event) => update('computer_name', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Admin local">
            <input className={inputClass} value={form.admin_username} onChange={(event) => update('admin_username', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Mot de passe">
            <input className={inputClass} value={form.admin_password} onChange={(event) => update('admin_password', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Organisation">
            <input className={inputClass} value={form.organization} onChange={(event) => update('organization', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Mode">
            <select className={inputClass} value={form.deployment_mode} onChange={(event) => update('deployment_mode', event.target.value)}>
              <option value="standard">standard</option>
              <option value="marketplace">marketplace</option>
            </select>
          </FieldLabel>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <FieldLabel label="Cle produit optionnelle">
            <input className={inputClass} value={form.product_key ?? ''} onChange={(event) => update('product_key', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Commande premier logon">
            <input className={inputClass} value={form.run_first_logon_command ?? ''} onChange={(event) => update('run_first_logon_command', event.target.value)} />
          </FieldLabel>
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          {[
            ['accept_eula', 'Accepter EULA'],
            ['skip_oobe', 'Masquer OOBE'],
            ['enable_rdp', 'Activer RDP'],
            ['auto_logon', 'Auto-logon 1 fois'],
            ['create_local_account', 'Compte local'],
            ['include_drivers', 'Injecter drivers'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm font-semibold text-slate-100">
              <input
                type="checkbox"
                checked={Boolean(form[key as keyof typeof form])}
                onChange={(event) => update(key as keyof typeof form, event.target.checked as never)}
                className="h-4 w-4 accent-cyan-300"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Creer profil Unattend
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-3">
          {profiles.length === 0 && <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm text-slate-400">Aucun profil Unattend.</div>}
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{profile.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{profile.locale} / {profile.timezone}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', profile.deployment_mode === 'marketplace' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200')}>
                      {profile.deployment_mode}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                      {profile.create_local_account ? 'compte local' : 'sans compte'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                      {profile.include_drivers ? 'drivers oui' : 'drivers non'}
                    </span>
                  </div>
                </div>
                {profile.is_default && <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">defaut</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onLoadXml(profile.id)} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
                  Afficher XML
                </button>
                <button type="button" onClick={() => onSetDefaultProfile(profile.id)} className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15">
                  Defaut
                </button>
                <button type="button" onClick={() => onDeleteProfile(profile.id)} className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15">
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
        <pre className="min-h-[420px] overflow-auto rounded-xl border border-white/10 bg-[#05070b] p-4 font-mono text-xs leading-5 text-slate-300">
          {generatedXml ?? 'Le fichier autounattend.xml apparait ici apres creation ou selection d un profil.'}
        </pre>
      </div>
    </section>
  )
}

function DeploymentProfilesPanel({
  profiles,
  images,
  unattendProfiles,
  driverPacks,
  isSaving,
  onCreateProfile,
  onSetDefaultProfile,
  onDeleteProfile,
}: {
  profiles: ForgeDeploymentProfile[]
  images: ForgeWimImage[]
  unattendProfiles: ForgeUnattendProfile[]
  driverPacks: ForgeDriverPack[]
  isSaving: boolean
  onCreateProfile: (profile: Omit<ForgeDeploymentProfile, 'id' | 'image_name' | 'unattend_name' | 'driver_pack_names' | 'is_default' | 'created_at'>) => Promise<void>
  onSetDefaultProfile: (profileId: string) => Promise<void>
  onDeleteProfile: (profileId: string) => Promise<void>
}) {
  const defaultImage = images.find((image) => image.is_default) ?? images[0]
  const defaultUnattend = unattendProfiles.find((profile) => profile.is_default) ?? unattendProfiles[0]
  const readyImages = images.filter((image) => image.status === 'ready')
  const criticalDrivers = driverPacks.filter((pack) => pack.critical)
  const [form, setForm] = useState<Omit<ForgeDeploymentProfile, 'id' | 'image_name' | 'unattend_name' | 'driver_pack_names' | 'is_default' | 'created_at'>>({
    name: 'Standard atelier',
    description: 'Image Windows + Unattend + drivers atelier',
    image_id: defaultImage?.id ?? '',
    unattend_profile_id: defaultUnattend?.id ?? null,
    driver_pack_ids: driverPacks.filter((pack) => pack.critical).map((pack) => pack.id).slice(0, 4),
    deployment_mode: 'standard',
    enabled: true,
  })
  const profileChecks = [
    { label: 'Image Windows', ok: Boolean(form.image_id), detail: form.image_id ? 'selectionnee' : 'obligatoire' },
    { label: 'Image prete', ok: readyImages.some((image) => image.id === form.image_id), detail: readyImages.length ? `${readyImages.length} image(s) prete(s)` : 'aucune image ready' },
    { label: 'Unattend', ok: Boolean(form.unattend_profile_id), detail: form.unattend_profile_id ? 'selectionne' : 'optionnel mais conseille' },
    { label: 'Drivers critiques', ok: criticalDrivers.length === 0 || form.driver_pack_ids.some((id) => criticalDrivers.some((pack) => pack.id === id)), detail: criticalDrivers.length ? `${criticalDrivers.length} critique(s)` : 'aucun critique' },
  ]
  const canCreateDeploymentProfile = Boolean(form.image_id && form.name.trim() && profileChecks[1].ok)

  useEffect(() => {
    setForm((current) => ({
      ...current,
      image_id: current.image_id || defaultImage?.id || '',
      unattend_profile_id: current.unattend_profile_id || defaultUnattend?.id || null,
    }))
  }, [defaultImage?.id, defaultUnattend?.id])

  const toggleDriverPack = (packId: string) => {
    setForm((current) => ({
      ...current,
      driver_pack_ids: current.driver_pack_ids.includes(packId)
        ? current.driver_pack_ids.filter((id) => id !== packId)
        : [...current.driver_pack_ids, packId],
    }))
  }

  const createProfile = async () => {
    if (!form.image_id) return
    await onCreateProfile(form)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-white">Creer un profil complet</h3>
          <p className="mt-1 text-sm text-slate-400">Un profil complet evite au technicien de choisir chaque option au moment du deploiement.</p>
        </div>
        <div className="space-y-3">
          <LabelInput label="Nom du profil" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Image Windows</span>
            <select value={form.image_id} onChange={(event) => setForm({ ...form, image_id: event.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40">
              <option value="">Choisir une image</option>
              {images.map((image) => <option key={image.id} value={image.id}>{image.name} - {image.version}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unattend</span>
            <select value={form.unattend_profile_id ?? ''} onChange={(event) => setForm({ ...form, unattend_profile_id: event.target.value || null })} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40">
              <option value="">Sans Unattend</option>
              {unattendProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} - {profile.deployment_mode}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mode</span>
            <select value={form.deployment_mode} onChange={(event) => setForm({ ...form, deployment_mode: event.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40">
              <option value="standard">Standard atelier</option>
              <option value="marketplace">Marketplace OOBE allege</option>
              <option value="custom">Personnalise</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Description</span>
            <textarea value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40" />
          </label>
          <button
            type="button"
            onClick={createProfile}
            disabled={isSaving || !canCreateDeploymentProfile}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            Creer le profil complet
          </button>
          <div className="grid gap-2">
            {profileChecks.map((check) => (
              <div key={check.label} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">{check.label}</div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">{check.detail}</div>
                </div>
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_12px_currentColor]', check.ok ? 'bg-emerald-300 text-emerald-300' : 'bg-amber-300 text-amber-300')} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">Packs drivers inclus</h3>
              <p className="mt-1 text-sm text-slate-400">Selectionne les drivers a injecter ou installer avec ce profil.</p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">{form.driver_pack_ids.length} choisi(s)</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {driverPacks.length === 0 ? (
              <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">Aucun pack driver enregistre pour le moment.</div>
            ) : driverPacks.map((pack) => (
              <button
                type="button"
                key={pack.id}
                onClick={() => toggleDriverPack(pack.id)}
                className={cn('rounded-lg border p-3 text-left transition', form.driver_pack_ids.includes(pack.id) ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.045]')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-white">{pack.name}</div>
                  {form.driver_pack_ids.includes(pack.id) ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : null}
                </div>
                <div className="mt-1 text-xs text-slate-400">{pack.vendor} {pack.model_family} - {pack.windows_version}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">Profils disponibles</h3>
              <p className="mt-1 text-sm text-slate-400">Le profil par defaut servira de choix recommande pour le deploiement reseau.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-slate-200">{profiles.length}</span>
          </div>
          <div className="grid gap-3">
            {profiles.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-400">Aucun profil complet. Cree d'abord un profil pour fiabiliser les deploiements.</div>
            ) : profiles.map((profile) => (
              <div key={profile.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white">{profile.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{profile.description || 'Aucune description'}</div>
                  </div>
                  {profile.is_default ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">defaut</span> : null}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <InfoRow label="Image" value={profile.image_name || profile.image_id} />
                  <InfoRow label="Unattend" value={profile.unattend_name || 'Aucun'} />
                  <InfoRow label="Drivers" value={profile.driver_pack_names.length ? `${profile.driver_pack_names.length} pack(s)` : 'Aucun'} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onSetDefaultProfile(profile.id)} className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15">Definir defaut</button>
                  <button type="button" onClick={() => onDeleteProfile(profile.id)} className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DriversPanel({
  driverPacks,
  audits,
  isSaving,
  onCreateDriverPack,
  onExtractDriverPack,
  onDeleteDriverPack,
}: {
  driverPacks: ForgeDriverPack[]
  audits: ForgePxeAuditSummary[]
  isSaving: boolean
  onCreateDriverPack: (pack: Omit<ForgeDriverPack, 'id' | 'status' | 'created_at'>) => Promise<void>
  onExtractDriverPack: (packId: string) => Promise<void>
  onDeleteDriverPack: (packId: string) => Promise<void>
}) {
  const [form, setForm] = useState<Omit<ForgeDriverPack, 'id' | 'status' | 'created_at'>>({
    name: 'Intel RST / NVMe',
    vendor: 'Intel',
    model_family: 'Universal',
    category: 'storage',
    path: '\\\\192.168.1.57\\deploy\\drivers\\intel-rst',
    architecture: 'x64',
    windows_version: 'Windows 11 24H2',
    critical: true,
    notes: '',
    source_audit_id: null,
  })
  const inputClass = 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-cyan-300/5'
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }))
  const categoryCount = (category: ForgeDriverPack['category']) => driverPacks.filter((pack) => pack.category === category).length
  const auditedModels = audits
    .filter((audit) => audit.brand && audit.model)
    .reduce<ForgePxeAuditSummary[]>((items, audit) => {
      const key = `${audit.brand} ${audit.model}`.toLowerCase()
      return items.some((item) => `${item.brand} ${item.model}`.toLowerCase() === key) ? items : [...items, audit]
    }, [])
  const coveredModels = auditedModels.filter((audit) => driverPackForAudit(audit, driverPacks)).length

  return (
    <section id="drivers" className="scroll-mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Pilotes</h2>
          <p className="text-sm text-slate-400">Catalogue driver-store pour WinPE et post-install</p>
        </div>
        <HardDrive className="h-5 w-5 text-emerald-200" />
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          ['Stockage', `${categoryCount('storage')} packs`, categoryCount('storage') > 0 ? 'pret' : 'a declarer'],
          ['Reseau', `${categoryCount('network')} packs`, categoryCount('network') > 0 ? 'pret' : 'a declarer'],
          ['Chipset', `${categoryCount('chipset')} packs`, categoryCount('chipset') > 0 ? 'pret' : 'a declarer'],
          ['Modeles audites', `${coveredModels}/${Math.max(auditedModels.length, 1)}`, coveredModels === auditedModels.length && auditedModels.length ? 'pret' : 'a completer'],
        ].map(([name, detail, state]) => (
          <div key={name} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-sm font-semibold text-white">{name}</div>
            <div className="mt-1 text-xs text-slate-500">{detail}</div>
            <div className={cn('mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', state === 'pret' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-200')}>
              {state}
            </div>
          </div>
        ))}
      </div>

      <form
        className="mb-5 grid gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4"
        onSubmit={(event) => {
          event.preventDefault()
          onCreateDriverPack(form)
        }}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_140px_150px_140px]">
          <FieldLabel label="Nom pack">
            <input className={inputClass} value={form.name} onChange={(event) => update('name', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Constructeur">
            <input className={inputClass} value={form.vendor} onChange={(event) => update('vendor', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Famille modele">
            <input className={inputClass} value={form.model_family} onChange={(event) => update('model_family', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Categorie">
            <select className={inputClass} value={form.category} onChange={(event) => update('category', event.target.value as ForgeDriverPack['category'])}>
              <option value="storage">storage</option>
              <option value="network">network</option>
              <option value="chipset">chipset</option>
              <option value="graphics">graphics</option>
              <option value="other">other</option>
            </select>
          </FieldLabel>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_140px_180px]">
          <FieldLabel label="Chemin pack">
            <input className={inputClass} value={form.path} onChange={(event) => update('path', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Architecture">
            <input className={inputClass} value={form.architecture} onChange={(event) => update('architecture', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Windows">
            <input className={inputClass} value={form.windows_version} onChange={(event) => update('windows_version', event.target.value)} />
          </FieldLabel>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[280px] flex-1">
            <FieldLabel label="Notes">
              <input className={inputClass} value={form.notes ?? ''} onChange={(event) => update('notes', event.target.value)} />
            </FieldLabel>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm font-semibold text-slate-100">
            <input type="checkbox" checked={form.critical} onChange={(event) => update('critical', event.target.checked)} className="h-4 w-4 accent-cyan-300" />
            Critique boot
          </label>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Declarer pack
          </button>
        </div>
      </form>

      <div className="mb-5 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Couverture par audit</h3>
            <p className="text-sm text-slate-400">Un pack par constructeur/modele suffit pour les prochaines machines identiques.</p>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
            {coveredModels}/{Math.max(auditedModels.length, 1)}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {auditedModels.length === 0 && <div className="text-sm text-slate-400">Aucun modele audite pour le moment.</div>}
          {auditedModels.slice(0, 9).map((audit) => {
            const pack = driverPackForAudit(audit, driverPacks)
            return (
              <div key={audit.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{machineName(audit)}</div>
                    <div className="mt-1 truncate font-mono text-xs text-slate-500">{audit.serial_number || audit.filename}</div>
                  </div>
                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', pack ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-200')}>
                    {pack ? 'pack pret' : 'manquant'}
                  </span>
                </div>
                {pack && <div className="mt-2 truncate font-mono text-xs text-cyan-200">{pack.path}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-white/[0.035] text-xs uppercase tracking-[0.18em] text-slate-500">
              <th className="px-4 py-3 font-semibold">Pack</th>
              <th className="px-4 py-3 font-semibold">Cible</th>
              <th className="px-4 py-3 font-semibold">Chemin</th>
              <th className="px-4 py-3 font-semibold">Statut</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {driverPacks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-sm text-slate-400">Aucun pack pilote declare.</td>
              </tr>
            )}
            {driverPacks.map((pack) => (
              <tr key={pack.id}>
                <td className="border-t border-white/10 px-4 py-4">
                  <div className="font-semibold text-white">{pack.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{pack.vendor} - {pack.category}</div>
                </td>
                <td className="border-t border-white/10 px-4 py-4">
                  <div className="text-sm text-slate-300">{pack.model_family}</div>
                  <div className="mt-1 text-xs text-slate-500">{pack.windows_version} / {pack.architecture}</div>
                </td>
                <td className="border-t border-white/10 px-4 py-4">
                  <div className="max-w-[360px] truncate font-mono text-xs text-cyan-200">{pack.path}</div>
                  {pack.notes && <div className="mt-1 text-xs text-slate-500">{pack.notes}</div>}
                </td>
                <td className="border-t border-white/10 px-4 py-4">
                  <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', pack.status === 'extracted' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : pack.status === 'downloaded' ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100' : pack.critical ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : 'border-white/10 bg-white/[0.04] text-slate-300')}>
                    {pack.status === 'extracted' ? 'extrait' : pack.status === 'downloaded' ? 'telecharge' : pack.critical ? 'critique' : pack.status}
                  </span>
                </td>
                <td className="border-t border-white/10 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onExtractDriverPack(pack.id)}
                    disabled={isSaving || pack.status === 'extracted'}
                    className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Extraire
                  </button>
                  <button type="button" onClick={() => onDeleteDriverPack(pack.id)} className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15">
                    Supprimer
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

function SettingsPanel({
  status,
  config,
  isSaving,
  saveMessage,
  onSave,
}: {
  status: ForgePxeStatus | null
  config: ForgePxeConfig | null
  isSaving: boolean
  saveMessage: string | null
  onSave: (config: ForgePxeConfig) => Promise<void>
}) {
  const [form, setForm] = useState<ForgePxeConfig>(
    config ?? {
      server_ip: status?.server_ip ?? '192.168.1.57',
      server_url: status?.server_url ?? 'http://192.168.1.57:1950',
      smb_share: status?.smb_share ?? '\\\\192.168.1.57\\deploy',
      mode: (status?.mode as ForgePxeConfig['mode']) ?? 'proxy DHCP',
      tftp_port: 69,
      http_port: 1950,
      dhcp_proxy_port: 4011,
      winpe_ready: false,
    },
  )

  useEffect(() => {
    if (config) setForm(config)
  }, [config])

  const updateForm = <K extends keyof ForgePxeConfig>(key: K, value: ForgePxeConfig[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const inputClass = 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-cyan-300/5'

  return (
    <section id="settings" className="scroll-mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Parametres</h2>
          <p className="text-sm text-slate-400">Configuration actuellement lue depuis le backend</p>
        </div>
        <Settings className="h-5 w-5 text-slate-300" />
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Serveur PXE', status?.server_ip ?? 'non connecte'],
          ['Mode DHCP', status?.mode ?? 'inconnu'],
          ['URL serveur', status?.server_url ?? '-'],
          ['Partage SMB', status?.smb_share ?? '-'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-2 break-words font-mono text-sm text-slate-100">{value}</div>
          </div>
        ))}
      </div>
      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <ServiceChecksPanel services={status?.services ?? []} />
        <InstallReadinessPanel status={status} config={form} />
      </div>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(form)
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <FieldLabel label="IP serveur">
            <input className={inputClass} value={form.server_ip} onChange={(event) => updateForm('server_ip', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="URL HTTP PXE">
            <input className={inputClass} value={form.server_url} onChange={(event) => updateForm('server_url', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Partage SMB">
            <input className={inputClass} value={form.smb_share} onChange={(event) => updateForm('smb_share', event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Mode DHCP">
            <select className={inputClass} value={form.mode} onChange={(event) => updateForm('mode', event.target.value as ForgePxeConfig['mode'])}>
              <option value="proxy DHCP">Proxy DHCP - cohabite avec box/routeur</option>
              <option value="DHCP principal atelier">DHCP principal atelier - recommande Dell</option>
              <option value="standalone DHCP">Standalone DHCP - reseau isole</option>
            </select>
          </FieldLabel>
        </div>
        <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-sm leading-6 text-amber-100">
          Si un HP boote mais qu'un Dell reste bloque avant TFTP, choisir <b>DHCP principal atelier</b> sur un reseau atelier dedie,
          ou configurer les options 66/67 dans le DHCP principal existant.
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <FieldLabel label="Port TFTP">
            <input className={inputClass} type="number" min={1} max={65535} value={form.tftp_port} onChange={(event) => updateForm('tftp_port', Number(event.target.value))} />
          </FieldLabel>
          <FieldLabel label="Port HTTP">
            <input className={inputClass} type="number" min={1} max={65535} value={form.http_port} onChange={(event) => updateForm('http_port', Number(event.target.value))} />
          </FieldLabel>
          <FieldLabel label="Port DHCP proxy">
            <input className={inputClass} type="number" min={1} max={65535} value={form.dhcp_proxy_port} onChange={(event) => updateForm('dhcp_proxy_port', Number(event.target.value))} />
          </FieldLabel>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">WinPE detecte automatiquement</div>
            <div className="mt-1 text-xs text-slate-500">L'etat WinPE vient du boot.wim servi par HTTP, pas d'un bouton manuel.</div>
          </div>
          <div className="flex items-center gap-3">
            {saveMessage && <span className="text-sm text-emerald-200">{saveMessage}</span>}
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

function ServiceChecksPanel({ services }: { services: ForgePxeServiceCheck[] }) {
  const checks = services.length
    ? services
    : [
        { key: 'pxe-http', label: 'HTTP PXE', status: 'offline', detail: 'En attente du backend.', endpoint: '-' },
        { key: 'smb', label: 'Partage SMB', status: 'offline', detail: 'En attente du backend.', endpoint: '-' },
        { key: 'api', label: 'Backend API', status: 'offline', detail: 'En attente du backend.', endpoint: '-' },
      ]

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Services reseau</h3>
          <p className="mt-1 text-sm text-slate-400">Controle direct des points exposes par la VM.</p>
        </div>
        <RadioTower className="h-5 w-5 text-cyan-200" />
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
        {checks.map((service) => {
          const online = service.status === 'online'
          return (
            <div key={service.key} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-100">{service.label}</span>
                <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', online ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-rose-300/20 bg-rose-300/10 text-rose-200')}>
                  {online ? 'online' : 'offline'}
                </span>
              </div>
              <div className="mt-2 truncate font-mono text-xs text-cyan-100">{service.endpoint}</div>
              <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{service.detail}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function InstallReadinessPanel({ status, config }: { status: ForgePxeStatus | null; config: ForgePxeConfig }) {
  const services = status?.services ?? []
  const allServicesOnline = services.length > 0 && services.every((service) => service.status === 'online')
  const assetsReady = status ? status.assets.filter((asset) => asset.status === 'ready').length : 0
  const totalAssets = status?.assets.length ?? 0
  const winpeAsset = status?.assets.find((asset) => asset.key === 'winpe')
  const onlineServices = services.filter((service) => service.status === 'online').length
  const steps = [
    { label: 'VM accessible sur le LAN', ready: Boolean(status?.server_ip), detail: config.server_ip },
    { label: 'Services reseau demarres', ready: allServicesOnline, detail: services.length ? `${onlineServices}/${services.length} online` : 'non verifie' },
    { label: 'Assets PXE de base', ready: totalAssets > 0 && assetsReady >= Math.max(1, totalAssets - 1), detail: `${assetsReady}/${totalAssets || 0} prets` },
    { label: 'Partage client', ready: Boolean(config.smb_share), detail: config.smb_share },
    { label: 'WinPE Windows', ready: winpeAsset?.status === 'ready', detail: winpeAsset?.detail ?? 'non verifie' },
  ]
  const readyCount = steps.filter((step) => step.ready).length
  const readinessPercent = Math.round((readyCount / steps.length) * 100)
  const deliveryState = readinessPercent >= 90 ? 'Pret client' : readinessPercent >= 60 ? 'A verifier' : 'Bloque'
  const deliveryTone = readinessPercent >= 90 ? 'emerald' : readinessPercent >= 60 ? 'amber' : 'rose'
  const checklistText = [
    'AtelierOS - Checklist premier demarrage',
    `Date: ${new Date().toLocaleString('fr-FR')}`,
    `Etat: ${deliveryState} (${readinessPercent}%)`,
    '',
    `IP serveur: ${status?.server_ip || config.server_ip || '-'}`,
    `Dashboard: ${status?.server_url || config.server_url || '-'}`,
    `Partage atelier: ${status?.smb_share || config.smb_share || '-'}`,
    `Mode PXE: ${status?.mode || config.mode || '-'}`,
    '',
    ...steps.map((step) => `${step.ready ? '[OK]' : '[A VERIFIER]'} ${step.label} - ${step.detail}`),
  ].join('\n')
  const copyText = [
    status?.server_url || config.server_url,
    status?.smb_share || config.smb_share,
    status?.server_ip || config.server_ip,
  ].filter(Boolean).join('\n')

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-xl shadow-black/20">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl border', deliveryTone === 'emerald' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : deliveryTone === 'amber' ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : 'border-rose-300/20 bg-rose-300/10 text-rose-200')}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">Premier demarrage client</h3>
              <span className={cn('rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em]', deliveryTone === 'emerald' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : deliveryTone === 'amber' ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : 'border-rose-300/20 bg-rose-300/10 text-rose-200')}>
                {deliveryState}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Vue simple pour savoir si l'appliance peut etre livree, deplacee ou utilisee par un technicien debutant.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(copyText)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            <Copy className="h-4 w-4" />
            Copier acces
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile(`atelieros-premier-demarrage-${new Date().toISOString().slice(0, 10)}.txt`, checklistText)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
        </div>
      </div>
      <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Score preparation</span>
          <span className="font-mono text-sm font-bold text-white">{readinessPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full transition-all', deliveryTone === 'emerald' ? 'bg-emerald-300' : deliveryTone === 'amber' ? 'bg-amber-300' : 'bg-rose-300')}
            style={{ width: `${readinessPercent}%` }}
          />
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border', step.ready ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-200')}>
              {step.ready ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">{step.label}</div>
              <div className="truncate font-mono text-xs text-slate-500">{step.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Header({
  activeSection,
  mode,
  searchQuery,
  searchResults,
  isLoading,
  onMenu,
  onModeChange,
  onRefresh,
  onSearchChange,
  onSearchSelect,
}: {
  activeSection: NavigationSection
  mode: InterfaceMode
  searchQuery: string
  searchResults: GlobalSearchResult[]
  isLoading?: boolean
  onMenu: () => void
  onModeChange: (mode: InterfaceMode) => void
  onRefresh?: () => void
  onSearchChange: (query: string) => void
  onSearchSelect: (result: GlobalSearchResult) => void
}) {
  const current = navigation.find((item) => item.id === activeSection)
  const hasQuery = searchQuery.trim().length > 0
  const showResults = hasQuery && searchResults.length > 0
  const searchInputClass = 'h-12 w-full rounded-2xl border border-white/10 bg-white/[0.045] pl-11 pr-10 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/30 focus:bg-cyan-300/[0.07] focus:ring-4 focus:ring-cyan-300/10'
  const handleSearchKeyDown = (event: { key: string; preventDefault: () => void }) => {
    if (event.key === 'Enter' && searchResults[0]) {
      event.preventDefault()
      onSearchSelect(searchResults[0])
    }
    if (event.key === 'Escape') {
      onSearchChange('')
    }
  }
  const searchBox = (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/80" />
      <input
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        onKeyDown={handleSearchKeyDown}
        className={searchInputClass}
        placeholder="Rechercher hostname, MAC, IP, image..."
        aria-label="Recherche globale AtelierOS"
      />
      {hasQuery ? (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-slate-500 transition hover:bg-white/10 hover:text-slate-100"
          aria-label="Effacer la recherche"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {showResults ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#080b11]/98 shadow-2xl shadow-black/45 backdrop-blur-xl">
          {searchResults.slice(0, 7).map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => onSearchSelect(result)}
              className="flex w-full items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-left transition last:border-b-0 hover:bg-cyan-300/10"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-100">{result.title}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}</span>
              </span>
              <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">
                {result.badge}
              </span>
            </button>
          ))}
        </div>
      ) : hasQuery ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 rounded-2xl border border-white/10 bg-[#080b11]/98 px-4 py-3 text-sm text-slate-500 shadow-2xl shadow-black/45">
          Aucun resultat direct
        </div>
      ) : null}
    </div>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090b11]/88 px-3 py-3 backdrop-blur-xl sm:px-5 lg:px-6 lg:py-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-200 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="hidden text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300 sm:block">Enterprise PXE Orchestrator</div>
          <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:mt-1 sm:text-2xl">
            {current ? current.label : 'AtelierOS'}
          </h1>
        </div>
        <div className="relative z-40 ml-auto hidden w-[min(34rem,36vw)] min-w-[280px] xl:block">
          {searchBox}
        </div>
        <div className="hidden rounded-xl border border-white/10 bg-black/20 p-1 sm:flex">
          {[
            ['beginner', 'Debutant'],
            ['expert', 'Expert'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value as InterfaceMode)}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-semibold transition',
                mode === value ? 'bg-cyan-300/15 text-cyan-100 shadow-lg shadow-cyan-500/10' : 'text-slate-500 hover:text-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300/15 sm:px-4"
        >
          <RefreshCw className={cn('h-4 w-4 sm:hidden', isLoading && 'animate-spin')} />
          <span className="hidden sm:inline">{isLoading ? 'Synchronisation...' : 'Synchroniser'}</span>
        </button>
      </div>
      <div className="relative z-40 mt-3 xl:hidden">
        {searchBox}
      </div>
      <div className="mt-3 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1 sm:hidden">
        {[
          ['beginner', 'Debutant'],
          ['expert', 'Expert'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value as InterfaceMode)}
            className={cn(
              'rounded-lg px-3 py-2 text-xs font-semibold transition',
              mode === value ? 'bg-cyan-300/15 text-cyan-100' : 'text-slate-500',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  )
}

function MobileNavigation({
  activeSection,
  onNavigate,
  items,
}: {
  activeSection: NavigationSection
  onNavigate: (sectionId: NavigationSection) => void
  items: Array<{ id: NavigationSection; label: string; icon: typeof Gauge }>
}) {
  const visibleItems = items.slice(0, 5)
  return (
    <nav className="fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 rounded-2xl border border-white/10 bg-[#080b11]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl lg:hidden">
      {visibleItems.map((item) => {
        const Icon = item.icon
        const isActive = activeSection === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={cn(
              'flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition',
              isActive ? 'bg-cyan-300/12 text-cyan-100' : 'text-slate-500',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="max-w-full truncate">{item.label.split(' ')[0]}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default function PxeControl({
  deployments = defaultDeployments,
  isLoading = false,
  onRefresh,
}: AOSDeployDashboardProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [pxeStatus, setPxeStatus] = useState<ForgePxeStatus | null>(null)
  const [pxeConfig, setPxeConfig] = useState<ForgePxeConfig | null>(null)
  const [wimRecipes, setWimRecipes] = useState<ForgeWimRecipe[]>([])
  const [wimImages, setWimImages] = useState<ForgeWimImage[]>([])
  const [wimBuilds, setWimBuilds] = useState<ForgeWimBuildSummary[]>([])
  const [serverMediaFiles, setServerMediaFiles] = useState<ForgeServerMediaFile[]>([])
  const [externalMediaSources, setExternalMediaSources] = useState<ForgeExternalMediaSource[]>([])
  const [driverPacks, setDriverPacks] = useState<ForgeDriverPack[]>([])
  const [unattendProfiles, setUnattendProfiles] = useState<ForgeUnattendProfile[]>([])
  const [deploymentProfiles, setDeploymentProfiles] = useState<ForgeDeploymentProfile[]>([])
  const [pxeAudits, setPxeAudits] = useState<ForgePxeAuditSummary[]>([])
  const [applianceBackups, setApplianceBackups] = useState<ForgeApplianceBackup[]>([])
  const [networkDiagnostic, setNetworkDiagnostic] = useState<ForgeNetworkDiagnosticResponse | null>(null)
  const [systemReport, setSystemReport] = useState<ForgeSystemReportResponse | null>(null)
  const [generatedWimScript, setGeneratedWimScript] = useState<string | null>(null)
  const [generatedUnattendXml, setGeneratedUnattendXml] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<NavigationSection>('dashboard')
  const [interfaceMode, setInterfaceMode] = useState<InterfaceMode>(() => {
    if (typeof window === 'undefined') return 'beginner'
    return window.localStorage.getItem('aos-interface-mode') === 'expert' ? 'expert' : 'beginner'
  })
  const [assistantEnabled, setAssistantEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem('aos-assistant-enabled') !== 'false'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [creatingWimRecipe, setCreatingWimRecipe] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [networkMessage, setNetworkMessage] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [mediaStatusMessage, setMediaStatusMessage] = useState('')
  const [sendingPxeAction, setSendingPxeAction] = useState(false)
  const [pxeActionMessage, setPxeActionMessage] = useState<string | null>(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const wimIndexCacheRef = useRef<Map<string, ForgeWimIndex[]>>(new Map())
  const effectiveMetrics = useMemo(() => metricsFromStatus(pxeStatus, health), [health, pxeStatus])
  const effectiveDeployments = useMemo(
    () => pxeStatus?.clients.map(mapClientToDeployment) ?? deployments,
    [deployments, pxeStatus],
  )
  const effectiveLogs = useMemo(() => logsFromStatus(pxeStatus, apiError), [apiError, pxeStatus])
  const visibleNavigation = useMemo(() => navigationForMode(interfaceMode), [interfaceMode])
  const globalSearchResults = useMemo(() => {
    const actionResults: GlobalSearchResult[] = [
      {
        id: 'action-network-repair',
        title: 'Reparer / resynchroniser le reseau',
        subtitle: 'Verifier IP, PXE, SMB, services et changement de switch',
        section: 'settings',
        badge: 'action',
        keywords: 'reseau ip switch direct dhcp pxe smb reparer resynchroniser regeneration diagnostic bloque',
      },
      {
        id: 'action-usb-kit',
        title: 'Creer une cle USB bootable atelier',
        subtitle: 'Generer le kit, ajouter AOS DISK/Ventoy, preparer une cle Multitool',
        section: 'tools',
        badge: 'usb',
        keywords: 'cle usb bootable multitool ventoy aos disk outil technicien debutant secours hors ligne',
      },
      {
        id: 'action-wim-flow',
        title: 'Importer ISO et preparer WIM',
        subtitle: 'ISO -> WIM/ESD -> image par defaut -> profil deploiement',
        section: 'images',
        badge: 'wim',
        keywords: 'iso wim esd image windows import upload creer preparer declarer deploiement default',
      },
      {
        id: 'action-label-print',
        title: 'Imprimer une etiquette machine',
        subtitle: 'Audit, QR code, code-barres, Brother 29x90 ou 62 mm',
        section: 'audit',
        badge: 'label',
        keywords: 'etiquette label qr code barre brother ql500 ql820 impression audit serie batterie ram disque',
      },
      {
        id: 'action-backup',
        title: 'Sauvegarder ou restaurer appliance',
        subtitle: 'Archive configuration, images declarees, profils, drivers et audits recents',
        section: 'guide',
        badge: 'backup',
        keywords: 'sauvegarde backup restauration restaurer appliance configuration securite migration client',
      },
      {
        id: 'action-faq',
        title: 'Ouvrir FAQ et guide technicien',
        subtitle: 'Installation, PXE, audit, WIM, drivers, etiquettes, mobile, depannage',
        section: 'guide',
        badge: 'faq',
        keywords: 'faq guide aide documentation technicien debutant depannage installation client procedure',
      },
    ]
    const baseResults: GlobalSearchResult[] = [
      ...actionResults,
      ...visibleNavigation.map((item) => ({
        id: `module-${item.id}`,
        title: item.label,
        subtitle: 'Ouvrir le module',
        section: item.id,
        badge: 'module',
        keywords: `${item.label} ${item.id} onglet menu page module`,
      })),
      ...effectiveDeployments.map((deployment) => ({
        id: `deployment-${deployment.id}`,
        title: deployment.hostname,
        subtitle: `${deployment.ipAddress} - ${deployment.macAddress} - ${deployment.imageName}`,
        section: 'deployments' as NavigationSection,
        badge: 'pxe',
        keywords: `${deployment.hostname} ${deployment.ipAddress} ${deployment.macAddress} ${deployment.imageName} ${deployment.status}`,
      })),
      ...(pxeStatus?.clients ?? []).map((client) => ({
        id: `client-${client.id}`,
        title: client.hostname || client.serial_number || client.mac || client.ip || 'Machine PXE',
        subtitle: `${client.brand || 'Marque inconnue'} ${client.model || ''} - ${client.ip || 'IP inconnue'} - ${client.mac || 'MAC inconnue'}`.trim(),
        section: 'audit' as NavigationSection,
        badge: 'audit',
        keywords: `${client.hostname ?? ''} ${client.ip ?? ''} ${client.mac ?? ''} ${client.serial_number ?? ''} ${client.brand ?? ''} ${client.model ?? ''} ${client.state ?? ''}`,
      })),
      ...pxeAudits.map((audit) => ({
        id: `audit-${audit.id}`,
        title: audit.serial_number || audit.mac || audit.ip || audit.filename || 'Audit machine',
        subtitle: `${audit.brand || 'Marque inconnue'} ${audit.model || ''} - ${audit.cpu || 'CPU inconnu'} - ${audit.ram || 'RAM inconnue'}`.trim(),
        section: 'audit' as NavigationSection,
        badge: 'audit',
        keywords: `${audit.filename ?? ''} ${audit.serial_number ?? ''} ${audit.mac ?? ''} ${audit.ip ?? ''} ${audit.brand ?? ''} ${audit.model ?? ''} ${audit.cpu ?? ''} ${audit.ram ?? ''} ${audit.main_disk ?? ''}`,
      })),
      ...wimImages.map((image) => ({
        id: `wim-image-${image.id}`,
        title: image.name,
        subtitle: `${image.version} - ${image.architecture} - ${image.path}`,
        section: 'images' as NavigationSection,
        badge: 'wim',
        keywords: `${image.name} ${image.version} ${image.architecture} ${image.path} ${image.status}`,
      })),
      ...serverMediaFiles.map((file) => ({
        id: `media-${file.folder}-${file.filename}`,
        title: file.filename,
        subtitle: `${file.kind.toUpperCase()} - ${file.folder} - ${file.smb_path}`,
        section: 'images' as NavigationSection,
        badge: file.kind,
        keywords: `${file.filename} ${file.kind} ${file.folder} ${file.smb_path} ${file.server_path}`,
      })),
      ...driverPacks.map((pack) => ({
        id: `driver-${pack.id}`,
        title: pack.name,
        subtitle: `${pack.vendor} ${pack.model_family} - ${pack.windows_version} - ${pack.path}`,
        section: 'drivers' as NavigationSection,
        badge: 'driver',
        keywords: `${pack.name} ${pack.vendor} ${pack.model_family} ${pack.windows_version} ${pack.architecture} ${pack.path}`,
      })),
      ...unattendProfiles.map((profile) => ({
        id: `unattend-${profile.id}`,
        title: profile.name,
        subtitle: `${profile.locale} - ${profile.timezone} - ${profile.computer_name}`,
        section: 'images' as NavigationSection,
        badge: 'xml',
        keywords: `${profile.name} ${profile.locale} ${profile.timezone} ${profile.computer_name} ${profile.deployment_mode} unattend xml oobe`,
      })),
      ...deploymentProfiles.map((profile) => ({
        id: `deployment-profile-${profile.id}`,
        title: profile.name,
        subtitle: `${profile.image_name || profile.image_id} - ${profile.unattend_name || 'sans unattend'} - ${profile.driver_pack_names.length} driver(s)`,
        section: 'images' as NavigationSection,
        badge: 'profil',
        keywords: `${profile.name} ${profile.description ?? ''} ${profile.image_name ?? ''} ${profile.unattend_name ?? ''} ${profile.driver_pack_names.join(' ')} ${profile.deployment_mode} profil complet deploiement`,
      })),
    ]
    const needle = normalizeSearch(globalSearch.trim())
    if (!needle) return []
    return baseResults
      .filter((result) => normalizeSearch(`${result.title} ${result.subtitle} ${result.keywords}`).includes(needle))
      .slice(0, 12)
  }, [deploymentProfiles, driverPacks, effectiveDeployments, globalSearch, pxeAudits, pxeStatus?.clients, serverMediaFiles, unattendProfiles, visibleNavigation, wimImages])
  const successRate = useMemo(() => {
    const active = effectiveDeployments.filter((item) => item.status !== 'failed')
    return Math.round((active.length / Math.max(effectiveDeployments.length, 1)) * 100)
  }, [effectiveDeployments])
  const [lastSync, setLastSync] = useState('23:14:20')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aos-assistant-enabled', assistantEnabled ? 'true' : 'false')
    }
  }, [assistantEnabled])

  const syncBackend = async () => {
    setSyncing(true)
    setApiError(null)
    try {
      const [healthData, auditsData] = await Promise.all([
        requestJson<HealthStatus>('/health'),
        requestJson<ForgePxeAuditSummary[]>('/forge/pxe/audits'),
      ])
      setHealth(healthData)
      setPxeAudits(auditsData)

      const token = await getDemoToken()
      const [pxeData, configData, recipesData, imagesData, buildsData, mediaData, externalMediaData, backupData, driversData, unattendData, deploymentProfilesData, networkData, reportData] = await Promise.all([
        requestJson<ForgePxeStatus>('/forge/pxe/status', token),
        requestJson<ForgePxeConfig>('/forge/pxe/config', token),
        requestJson<ForgeWimRecipe[]>('/forge/pxe/wim-recipes', token),
        requestJson<ForgeWimImage[]>('/forge/pxe/wim-images', token),
        requestJson<ForgeWimBuildListResponse>('/forge/pxe/wim-builds', token),
        requestJson<ForgeServerMediaListResponse>('/forge/pxe/media/files', token),
        requestJson<ForgeExternalMediaSourceListResponse>('/forge/pxe/media/external-sources', token),
        requestJson<ForgeApplianceBackupListResponse>('/forge/pxe/backups', token),
        requestJson<ForgeDriverPack[]>('/forge/pxe/driver-packs', token),
        requestJson<ForgeUnattendProfile[]>('/forge/pxe/unattend-profiles', token),
        requestJson<ForgeDeploymentProfile[]>('/forge/pxe/deployment-profiles', token),
        requestJson<ForgeNetworkDiagnosticResponse>('/forge/pxe/network/diagnostic', token),
        requestJson<ForgeSystemReportResponse>('/forge/pxe/system-report', token),
      ])
      setPxeStatus(pxeData)
      setPxeConfig(configData)
      setWimRecipes(recipesData)
      setWimImages(imagesData)
      setWimBuilds(buildsData.builds)
      setServerMediaFiles(mediaData.files)
      setExternalMediaSources(externalMediaData.sources)
      setApplianceBackups(backupData.backups)
      setDriverPacks(driversData)
      setUnattendProfiles(unattendData)
      setDeploymentProfiles(deploymentProfilesData)
      setNetworkDiagnostic(networkData)
      setSystemReport(reportData)
      setLastSync(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setApiError(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur API inconnue')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    syncBackend()
    const timer = window.setInterval(syncBackend, 15000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!visibleNavigation.some((item) => item.id === activeSection)) {
      setActiveSection('dashboard')
    }
  }, [activeSection, visibleNavigation])

  useEffect(() => {
    window.localStorage.setItem('aos-interface-mode', interfaceMode)
  }, [interfaceMode])

  const handleRefresh = () => {
    syncBackend()
    onRefresh?.()
  }

  const refreshMediaFiles = async () => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const media = await requestJson<ForgeServerMediaListResponse>('/forge/pxe/media/files', token)
      wimIndexCacheRef.current.clear()
      setServerMediaFiles(media.files)
      setSaveMessage(media.message)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur lecture fichiers serveur')
    }
  }

  const importExternalMediaSource = async (source: ForgeExternalMediaSource): Promise<ForgeExternalMediaImportResponse | null> => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const result = await requestJson<ForgeExternalMediaImportResponse>(`/forge/pxe/media/external-sources/${encodeURIComponent(source.id)}/import`, token, {
        method: 'POST',
      })
      setSaveMessage(result.message)
      if (result.imported) {
        const media = await requestJson<ForgeServerMediaListResponse>('/forge/pxe/media/files', token)
        setServerMediaFiles(media.files)
      }
      return result
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur import source externe')
      return null
    }
  }

  const deleteMediaFile = async (file: ForgeServerMediaFile) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const folder = encodeURIComponent(file.folder)
      const filename = encodeURIComponent(file.filename)
      const deleted = await requestJson<ForgeServerMediaDeleteResponse>(`/forge/pxe/media/files/${folder}/${filename}`, token, {
        method: 'DELETE',
      })
      setSaveMessage(deleted.message)
      const media = await requestJson<ForgeServerMediaListResponse>('/forge/pxe/media/files', token)
      wimIndexCacheRef.current.delete(file.smb_path)
      setServerMediaFiles(media.files)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur suppression fichier serveur')
    }
  }

  const checksumMediaFile = async (file: ForgeServerMediaFile): Promise<ForgeServerMediaChecksumResponse | null> => {
    setApiError(null)
    setSaveMessage(null)
    try {
      const token = await getDemoToken()
      const folder = encodeURIComponent(file.folder)
      const filename = encodeURIComponent(file.filename)
      const checksum = await requestJson<ForgeServerMediaChecksumResponse>(`/forge/pxe/media/files/${folder}/${filename}/checksum`, token, {
        method: 'POST',
      })
      setSaveMessage(`${checksum.message} ${checksum.sha256.slice(0, 16)}...`)
      return checksum
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur calcul checksum media')
      return null
    }
  }

  const refreshBackups = async () => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const data = await requestJson<ForgeApplianceBackupListResponse>('/forge/pxe/backups', token)
      setApplianceBackups(data.backups)
      setBackupMessage(data.message)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur lecture sauvegardes')
    }
  }

  const createApplianceBackup = async () => {
    setSavingConfig(true)
    setBackupMessage(null)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const created = await requestJson<ForgeApplianceBackupResponse>('/forge/pxe/backups', token, {
        method: 'POST',
      })
      setBackupMessage(created.message)
      const data = await requestJson<ForgeApplianceBackupListResponse>('/forge/pxe/backups', token)
      setApplianceBackups(data.backups)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur creation sauvegarde')
    } finally {
      setSavingConfig(false)
    }
  }

  const loadSystemReport = async () => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const report = await requestJson<ForgeSystemReportResponse>('/forge/pxe/system-report', token)
      setSystemReport(report)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur rapport systeme')
    }
  }

  const restoreApplianceBackup = async (filename: string, dryRun: boolean) => {
    setSavingConfig(true)
    setBackupMessage(null)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const result = await requestJson<ForgeApplianceRestoreResponse>(`/forge/pxe/backups/${encodeURIComponent(filename)}/restore`, token, {
        method: 'POST',
        body: JSON.stringify({
          dry_run: dryRun,
          restore_config: true,
          restore_profiles: true,
          restore_audits: false,
        }),
      })
      setBackupMessage(`${result.message} ${result.restored.slice(0, 3).join(' | ')}`)
      const data = await requestJson<ForgeApplianceBackupListResponse>('/forge/pxe/backups', token)
      setApplianceBackups(data.backups)
      if (!dryRun) {
        await syncBackend()
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur restauration sauvegarde')
    } finally {
      setSavingConfig(false)
    }
  }

  const downloadApplianceBackup = async (filename: string) => {
    setSavingConfig(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const response = await fetch(`${resolveApiBase()}/forge/pxe/backups/${encodeURIComponent(filename)}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ''}`)
      }
      const blob = await response.blob()
      downloadBlobFile(filename, blob)
      setBackupMessage(`Telechargement sauvegarde: ${filename}`)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur telechargement sauvegarde')
    } finally {
      setSavingConfig(false)
    }
  }

  const deleteApplianceBackup = async (filename: string) => {
    setSavingConfig(true)
    setBackupMessage(null)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const deleted = await requestJson<ForgeApplianceBackupDeleteResponse>(`/forge/pxe/backups/${encodeURIComponent(filename)}`, token, {
        method: 'DELETE',
      })
      setBackupMessage(deleted.message)
      const data = await requestJson<ForgeApplianceBackupListResponse>('/forge/pxe/backups', token)
      setApplianceBackups(data.backups)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur suppression sauvegarde')
    } finally {
      setSavingConfig(false)
    }
  }

  const createImageFromMediaFile = async (file: ForgeServerMediaFile) => {
    if (file.kind !== 'image') return
    const alreadyRegistered = wimImages.some((image) => image.path.toLowerCase() === file.smb_path.toLowerCase())
    if (alreadyRegistered) {
      setSaveMessage(`${file.filename} est deja declare dans Images pretes.`)
      return
    }
    const cleanName = file.filename.replace(/\.(wim|esd)$/i, '').replace(/[-_]+/g, ' ').trim() || file.filename
    await createWimImage({
      name: cleanName,
      version: '24H2',
      architecture: 'x64',
      path: file.smb_path,
      size_gb: file.size_gb,
      source: 'server',
      notes: `Declare depuis le fichier serveur ${file.folder}/${file.filename}`,
    })
  }

  const buildWimFromMedia = async (
    file: ForgeServerMediaFile,
    payload: { reference?: string; version?: string; notes?: string; image_index?: number } = {},
  ): Promise<ForgeWimBuildResponse | null> => {
    if (file.kind !== 'iso' && file.kind !== 'image') return null
    setApiError(null)
    setSaveMessage(null)
    setCreatingWimRecipe(true)
    try {
      const token = await getDemoToken()
      const result = await requestJson<ForgeWimBuildResponse>('/forge/pxe/media/build-wim', token, {
        method: 'POST',
        body: JSON.stringify({
          source_path: file.smb_path,
          reference: payload.reference || file.filename.replace(/\.iso$/i, ''),
          version: payload.version || '01',
          notes: payload.notes || `Build direct depuis ${file.filename}`,
          image_index: payload.image_index || 1,
        }),
      })
      const builds = await requestJson<ForgeWimBuildListResponse>('/forge/pxe/wim-builds', token)
      setWimBuilds(builds.builds)
      setSaveMessage(result.message)
      return result
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur generation WIM depuis media')
      return null
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const inspectWimIndexes = async (sourcePath: string): Promise<ForgeWimIndex[]> => {
    const cached = wimIndexCacheRef.current.get(sourcePath)
    if (cached) return cached
    const token = await getDemoToken()
    const result = await requestJson<ForgeWimIndexListResponse>('/forge/pxe/media/indexes', token, {
      method: 'POST',
      body: JSON.stringify({ source_path: sourcePath }),
    })
    wimIndexCacheRef.current.set(sourcePath, result.indexes)
    return result.indexes
  }

  const chooseWimIndex = async (sourcePath: string): Promise<number> => {
    try {
      const indexes = await inspectWimIndexes(sourcePath)
      if (indexes.length === 1) return indexes[0].index
      if (indexes.length > 1) {
        return indexes[0].index
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? `Lecture editions impossible, index 1 utilise: ${error.message}` : 'Lecture editions impossible, index 1 utilise')
    }
    return 1
  }

  const prepareIsoMediaFile = async (file: ForgeServerMediaFile, imageIndex?: number) => {
    if (file.kind !== 'iso') return
    const baseName = file.filename.replace(/\.iso$/i, '').replace(/[-_]+/g, ' ').trim() || 'Windows ISO'
    const selectedImageIndex = imageIndex ?? await chooseWimIndex(file.smb_path)
    const result = await buildWimFromMedia(file, {
      reference: baseName,
      version: '01',
      notes: `Build auto depuis ${file.filename}`,
      image_index: selectedImageIndex,
    })
    if (result) {
      setSaveMessage(`Demarrage OK: ${result.reference} ${result.version} (${result.status}).`)
    }
  }

  const savePxeConfig = async (config: ForgePxeConfig) => {
    setSavingConfig(true)
    setSaveMessage(null)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const saved = await requestJson<ForgePxeConfig>('/forge/pxe/config', token, {
        method: 'PATCH',
        body: JSON.stringify(config),
      })
      const status = await requestJson<ForgePxeStatus>('/forge/pxe/status', token)
      setPxeConfig(saved)
      setPxeStatus(status)
      setSaveMessage('Configuration sauvegardee')
      setLastSync(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur sauvegarde configuration')
    } finally {
      setSavingConfig(false)
    }
  }

  const loadWimRecipeScript = async (recipeId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const script = await requestText(`/forge/pxe/wim-recipes/${recipeId}/script`, token)
      setGeneratedWimScript(script)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur generation script WIM')
    }
  }

  const createWimRecipe = async (recipe: Omit<ForgeWimRecipe, 'id' | 'created_at'>) => {
    setCreatingWimRecipe(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const created = await requestJson<ForgeWimRecipe>('/forge/pxe/wim-recipes', token, {
        method: 'POST',
        body: JSON.stringify(recipe),
      })
      setWimRecipes((current) => [created, ...current])
      const script = await requestText(`/forge/pxe/wim-recipes/${created.id}/script`, token)
      setGeneratedWimScript(script)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur creation profil WIM')
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const createWimImage = async (image: Omit<ForgeWimImage, 'id' | 'status' | 'is_default' | 'created_at'>) => {
    setCreatingWimRecipe(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const created = await requestJson<ForgeWimImage>('/forge/pxe/wim-images', token, {
        method: 'POST',
        body: JSON.stringify(image),
      })
      setWimImages((current) => [created, ...current])
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur declaration image WIM')
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const resyncNetwork = async () => {
    setSavingConfig(true)
    setSaveMessage(null)
    setNetworkMessage(null)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const result = await requestJson<ForgeNetworkResyncResponse>('/forge/pxe/network/resync', token, {
        method: 'POST',
      })
      setPxeConfig((current) => current ? {
        ...current,
        server_ip: result.server_ip,
        server_url: result.server_url,
        smb_share: result.smb_share,
      } : current)
      setSaveMessage(result.message)
      setNetworkMessage(`${result.message}. Services: ${result.restarted_services.join(', ') || 'aucun service relance'}`)
      await syncBackend()
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur regeneration reseau')
    } finally {
      setSavingConfig(false)
    }
  }

  const buildWimFromImage = async (imageId: string, payload: { reference?: string; version?: string; notes?: string; image_index?: number }) => {
    setCreatingWimRecipe(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const result = await requestJson<ForgeWimBuildResponse>(`/forge/pxe/wim-images/${encodeURIComponent(imageId)}/build-wim`, token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const builds = await requestJson<ForgeWimBuildListResponse>('/forge/pxe/wim-builds', token)
      setWimBuilds(builds.builds)
      setSaveMessage(result.message)
      return result
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur creation WIM')
      return null
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const checkMediaOnServer = async (file: File, kind: 'iso' | 'image'): Promise<ForgeMediaStatusResponse | null> => {
    setMediaStatusMessage('')
    try {
      const token = await getDemoToken()
      const status = await requestMediaStatus(file.name, kind, token)
      setMediaStatusMessage(status.message)
      return status
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur verification de fichier'
      setMediaStatusMessage(message)
      return null
    }
  }

  const clearMediaMessages = () => {
    setSaveMessage(null)
    setMediaStatusMessage('')
    setApiError(null)
  }

  const uploadPxeMedia = async (
    file: File,
    kind: 'iso' | 'image',
    name: string,
    version: string,
    architecture: string,
    overwrite: boolean,
    onProgress: (percent: number | null) => void,
  ) => {
    setCreatingWimRecipe(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const form = new FormData()
      form.append('file', file)
      form.append('kind', kind)
      form.append('name', name)
      form.append('version', version)
      form.append('architecture', architecture)
      form.append('overwrite', overwrite ? '1' : '0')

      const uploaded = await new Promise<ForgeMediaUploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${resolveUploadApiBase()}/forge/pxe/media/upload`)
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(describeUploadFailure(xhr)))
            return
          }
          try {
            resolve(JSON.parse(xhr.responseText) as ForgeMediaUploadResponse)
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Réponse serveur invalide'))
          }
        }
        xhr.onerror = () => reject(new Error(`Erreur reseau pendant l upload vers ${resolveUploadApiBase()}`))
        xhr.send(form)
      })

      if (uploaded.image) {
        setWimImages((current) => [uploaded.image as ForgeWimImage, ...current.filter((image) => image.id !== uploaded.image?.id)])
      }
      setSaveMessage(uploaded.message)
      setMediaStatusMessage('')
      const [images, media] = await Promise.all([
        requestJson<ForgeWimImage[]>('/forge/pxe/wim-images', token),
        requestJson<ForgeServerMediaListResponse>('/forge/pxe/media/files', token),
      ])
      wimIndexCacheRef.current.clear()
      setWimImages(images)
      setServerMediaFiles(media.files)
      onProgress(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur upload media')
      onProgress(null)
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const setDefaultWimImage = async (imageId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const selected = await requestJson<ForgeWimImage>(`/forge/pxe/wim-images/${imageId}/default`, token, {
        method: 'POST',
      })
      setWimImages((current) => current.map((image) => ({ ...image, is_default: image.id === selected.id })))
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur image par defaut')
    }
  }

  const deleteWimImage = async (imageId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      await fetch(`${resolveApiBase()}/forge/pxe/wim-images/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      })
      const images = await requestJson<ForgeWimImage[]>('/forge/pxe/wim-images', token)
      setWimImages(images)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur suppression image WIM')
    }
  }

  const createDriverPack = async (pack: Omit<ForgeDriverPack, 'id' | 'status' | 'created_at'>) => {
    setCreatingWimRecipe(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const created = await requestJson<ForgeDriverPack>('/forge/pxe/driver-packs', token, {
        method: 'POST',
        body: JSON.stringify(pack),
      })
      setDriverPacks((current) => [created, ...current])
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur declaration pack pilote')
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const prepareDriversFromAudit = async (auditId: string) => {
    setCreatingWimRecipe(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const prepared = await requestJson<ForgeDriverPrepareResponse>(`/forge/pxe/audits/${encodeURIComponent(auditId)}/prepare-drivers`, token, {
        method: 'POST',
        body: JSON.stringify({
          windows_version: 'Windows 11 24H2',
          architecture: 'x64',
          category: 'other',
          notes: 'Pack prepare depuis l audit rapide AtelierOS.',
        }),
      })
      setDriverPacks((current) => {
        const withoutDuplicate = current.filter((pack) => pack.id !== prepared.pack.id)
        return [prepared.pack, ...withoutDuplicate]
      })
      setSaveMessage(prepared.message)
      setActiveSection('drivers')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur preparation drivers')
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const deletePxeAudit = async (auditId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      await fetch(`${resolveApiBase()}/forge/pxe/audits/${encodeURIComponent(auditId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      })
      const audits = await requestJson<ForgePxeAuditSummary[]>('/forge/pxe/audits', token)
      setPxeAudits(audits)
      setSaveMessage('Audit supprime')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur suppression audit')
    }
  }

  const prunePxeAudits = async (keepLatest: number, dryRun: boolean) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const result = await requestJson<ForgePxeAuditPruneResponse>('/forge/pxe/audits/prune', token, {
        method: 'POST',
        body: JSON.stringify({ keep_latest: keepLatest, dry_run: dryRun }),
      })
      const audits = await requestJson<ForgePxeAuditSummary[]>('/forge/pxe/audits', token)
      setPxeAudits(audits)
      setSaveMessage(result.message)
      return result
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur nettoyage audits')
      return null
    }
  }

  const extractDriverPack = async (packId: string) => {
    setCreatingWimRecipe(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const extracted = await requestJson<ForgeDriverExtractResponse>(`/forge/pxe/driver-packs/${encodeURIComponent(packId)}/extract`, token, {
        method: 'POST',
      })
      setDriverPacks((current) => current.map((pack) => (pack.id === extracted.pack.id ? extracted.pack : pack)))
      setSaveMessage(extracted.message)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur extraction drivers')
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const deleteDriverPack = async (packId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      await fetch(`${resolveApiBase()}/forge/pxe/driver-packs/${packId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      })
      setDriverPacks((current) => current.filter((pack) => pack.id !== packId))
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur suppression pack pilote')
    }
  }

  const loadUnattendXml = async (profileId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const xml = await requestText(`/forge/pxe/unattend-profiles/${profileId}/xml`, token)
      setGeneratedUnattendXml(xml)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur generation Unattend')
    }
  }

  const createUnattendProfile = async (profile: Omit<ForgeUnattendProfile, 'id' | 'is_default' | 'created_at'>) => {
    setCreatingWimRecipe(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const created = await requestJson<ForgeUnattendProfile>('/forge/pxe/unattend-profiles', token, {
        method: 'POST',
        body: JSON.stringify(profile),
      })
      setUnattendProfiles((current) => [created, ...current])
      const xml = await requestText(`/forge/pxe/unattend-profiles/${created.id}/xml`, token)
      setGeneratedUnattendXml(xml)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur creation profil Unattend')
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const setDefaultUnattendProfile = async (profileId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const selected = await requestJson<ForgeUnattendProfile>(`/forge/pxe/unattend-profiles/${profileId}/default`, token, {
        method: 'POST',
      })
      setUnattendProfiles((current) => current.map((profile) => ({ ...profile, is_default: profile.id === selected.id })))
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur profil Unattend par defaut')
    }
  }

  const deleteUnattendProfile = async (profileId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      await fetch(`${resolveApiBase()}/forge/pxe/unattend-profiles/${profileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      })
      const profiles = await requestJson<ForgeUnattendProfile[]>('/forge/pxe/unattend-profiles', token)
      setUnattendProfiles(profiles)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur suppression profil Unattend')
    }
  }

  const createDeploymentProfile = async (profile: Omit<ForgeDeploymentProfile, 'id' | 'image_name' | 'unattend_name' | 'driver_pack_names' | 'is_default' | 'created_at'>) => {
    setCreatingWimRecipe(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const created = await requestJson<ForgeDeploymentProfile>('/forge/pxe/deployment-profiles', token, {
        method: 'POST',
        body: JSON.stringify(profile),
      })
      setDeploymentProfiles((current) => [created, ...current])
      setSaveMessage(`Profil de deploiement cree: ${created.name}`)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur creation profil deploiement')
    } finally {
      setCreatingWimRecipe(false)
    }
  }

  const setDefaultDeploymentProfile = async (profileId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const selected = await requestJson<ForgeDeploymentProfile>(`/forge/pxe/deployment-profiles/${profileId}/default`, token, {
        method: 'POST',
      })
      setDeploymentProfiles((current) => current.map((profile) => ({ ...profile, is_default: profile.id === selected.id })))
      setSaveMessage(`Profil de deploiement par defaut: ${selected.name}`)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur profil deploiement par defaut')
    }
  }

  const deleteDeploymentProfile = async (profileId: string) => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      await fetch(`${resolveApiBase()}/forge/pxe/deployment-profiles/${profileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      })
      const profiles = await requestJson<ForgeDeploymentProfile[]>('/forge/pxe/deployment-profiles', token)
      setDeploymentProfiles(profiles)
      setSaveMessage('Profil de deploiement supprime')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur suppression profil deploiement')
    }
  }

  const sendPxeAction = async (clientId: string, action: string) => {
    setSendingPxeAction(true)
    setPxeActionMessage(null)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const response = await requestJson<ForgeRemoteActionResponse>('/forge/pxe/actions', token, {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, action }),
      })
      setPxeActionMessage(response.message)
      await syncBackend()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur commande PXE'
      setPxeActionMessage(message)
      setApiError(message)
    } finally {
      setSendingPxeAction(false)
    }
  }

  const createUsbKit = async (profile: string) => {
    setSavingConfig(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const kit = await requestJson<ForgeUsbKitResponse>('/forge/pxe/usb-kit', token, {
        method: 'POST',
        body: JSON.stringify({ profile }),
      })
      setSaveMessage(kit.message)
      return kit
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur generation kit USB')
      return null
    } finally {
      setSavingConfig(false)
    }
  }

  const refreshUsbKits = async () => {
    setApiError(null)
    try {
      const token = await getDemoToken()
      const response = await requestJson<ForgeUsbKitListResponse>('/forge/pxe/usb-kit', token)
      return response.kits
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur liste kits USB')
      return []
    }
  }

  const downloadUsbKit = async (filename: string) => {
    setSavingConfig(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const response = await fetch(`${resolveApiBase()}/forge/pxe/usb-kit/${encodeURIComponent(filename)}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ''}`)
      }
      const blob = await response.blob()
      downloadBlobFile(filename, blob)
      setSaveMessage(`Telechargement du kit USB: ${filename}`)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur telechargement kit USB')
    } finally {
      setSavingConfig(false)
    }
  }

  const deleteUsbKit = async (filename: string) => {
    setSavingConfig(true)
    setApiError(null)
    try {
      const token = await getDemoToken()
      const deleted = await requestJson<ForgeUsbKitDeleteResponse>(`/forge/pxe/usb-kit/${encodeURIComponent(filename)}`, token, {
        method: 'DELETE',
      })
      setSaveMessage(deleted.message)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Erreur suppression kit USB')
    } finally {
      setSavingConfig(false)
    }
  }

  const navigateSection = (sectionId: NavigationSection) => {
    setActiveSection(sectionId)
    setMobileMenuOpen(false)
  }

  const handleGlobalSearchSelect = (result: GlobalSearchResult) => {
    setActiveSection(result.section)
    setGlobalSearch('')
    setMobileMenuOpen(false)
  }

  const activeModule = {
    dashboard: (
      <DashboardModule
        mode={interfaceMode}
        status={pxeStatus}
        systemReport={systemReport}
        metrics={effectiveMetrics}
        successRate={successRate}
        lastSync={lastSync}
        deployments={effectiveDeployments}
        logs={effectiveLogs}
        isNetworkResyncing={savingConfig}
        networkMessage={networkMessage}
        onResyncNetwork={resyncNetwork}
        onNavigate={navigateSection}
      />
    ),
    deployments: <DeploymentsModule deployments={effectiveDeployments} />,
    audit: (
      <AuditModule
        audits={pxeAudits}
        clients={pxeStatus?.clients ?? []}
        driverPacks={driverPacks}
        isPreparingDrivers={creatingWimRecipe}
        isSendingAction={sendingPxeAction}
        actionMessage={pxeActionMessage}
        onPrepareDrivers={prepareDriversFromAudit}
        onSendAction={sendPxeAction}
        onDeleteAudit={deletePxeAudit}
        onPruneAudits={prunePxeAudits}
      />
    ),
    boot: <BootModule />,
    images: (
      <ImagesModule
        assets={pxeStatus?.assets ?? []}
        images={wimImages}
        builds={wimBuilds}
        serverMediaFiles={serverMediaFiles}
        externalMediaSources={externalMediaSources}
        recipes={wimRecipes}
        unattendProfiles={unattendProfiles}
        deploymentProfiles={deploymentProfiles}
        driverPacks={driverPacks}
        generatedScript={generatedWimScript}
        generatedUnattendXml={generatedUnattendXml}
        isCreating={creatingWimRecipe}
        onCreateImage={createWimImage}
        onBuildWim={buildWimFromImage}
        onUploadMedia={uploadPxeMedia}
        onCheckMedia={checkMediaOnServer}
        onRefreshMediaFiles={refreshMediaFiles}
        onImportExternalMediaSource={importExternalMediaSource}
        onDeleteMediaFile={deleteMediaFile}
        onChecksumMediaFile={checksumMediaFile}
        onCreateImageFromMedia={createImageFromMediaFile}
        onPrepareIsoMedia={prepareIsoMediaFile}
        onInspectWimIndexes={inspectWimIndexes}
        checkStatusMessage={mediaStatusMessage}
        uploadMessage={saveMessage}
        onClearMessages={clearMediaMessages}
        onSetDefaultImage={setDefaultWimImage}
        onDeleteImage={deleteWimImage}
        onCreateRecipe={createWimRecipe}
        onLoadScript={loadWimRecipeScript}
        onCreateUnattendProfile={createUnattendProfile}
        onSetDefaultUnattendProfile={setDefaultUnattendProfile}
        onDeleteUnattendProfile={deleteUnattendProfile}
        onLoadUnattendXml={loadUnattendXml}
        onCreateDeploymentProfile={createDeploymentProfile}
        onSetDefaultDeploymentProfile={setDefaultDeploymentProfile}
        onDeleteDeploymentProfile={deleteDeploymentProfile}
      />
    ),
    drivers: (
      <DriversModule
        driverPacks={driverPacks}
        audits={pxeAudits}
        isSaving={creatingWimRecipe}
        onCreateDriverPack={createDriverPack}
        onExtractDriverPack={extractDriverPack}
        onDeleteDriverPack={deleteDriverPack}
      />
    ),
    tools: <ToolsModule pxeStatus={pxeStatus} config={pxeConfig} isSaving={savingConfig} onCreateUsbKit={createUsbKit} onRefreshUsbKits={refreshUsbKits} onDownloadUsbKit={downloadUsbKit} onDeleteUsbKit={deleteUsbKit} />,
    guide: (
      <GuideModule
        status={pxeStatus}
        config={pxeConfig}
        backups={applianceBackups}
        systemReport={systemReport}
        isSaving={savingConfig}
        backupMessage={backupMessage}
        onCreateBackup={createApplianceBackup}
        onRefreshBackups={refreshBackups}
        onDeleteBackup={deleteApplianceBackup}
        onDownloadBackup={downloadApplianceBackup}
        onRestoreBackup={restoreApplianceBackup}
        onLoadSystemReport={loadSystemReport}
      />
    ),
    logs: <LogsModule logs={effectiveLogs} />,
    settings: (
      <SettingsModule
        status={pxeStatus}
        config={pxeConfig}
        diagnostic={networkDiagnostic}
        isSaving={savingConfig}
        saveMessage={saveMessage}
        networkMessage={networkMessage}
        assistantEnabled={assistantEnabled}
        onAssistantEnabledChange={setAssistantEnabled}
        onSave={savePxeConfig}
        onResyncNetwork={resyncNetwork}
      />
    ),
  } satisfies Record<NavigationSection, JSX.Element>

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.12),transparent_34rem),radial-gradient(circle_at_85%_20%,rgba(16,185,129,0.09),transparent_30rem),linear-gradient(135deg,#05070b,#0c111b_45%,#111827)]" />
      <div className="flex min-h-screen">
        <Sidebar activeSection={activeSection} onNavigate={navigateSection} items={visibleNavigation} status={pxeStatus} open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div className="min-w-0 flex-1">
          <Header
            activeSection={activeSection}
            mode={interfaceMode}
            searchQuery={globalSearch}
            searchResults={globalSearchResults}
            isLoading={isLoading || syncing}
            onMenu={() => setMobileMenuOpen(true)}
            onModeChange={setInterfaceMode}
            onRefresh={handleRefresh}
            onSearchChange={setGlobalSearch}
            onSearchSelect={handleGlobalSearchSelect}
          />
          <main className="space-y-4 px-3 pb-24 pt-4 sm:space-y-6 sm:px-5 lg:p-6">
            {apiError && (
              <ApiErrorBanner message={apiError} isLoading={syncing} onRetry={syncBackend} />
            )}
            {activeModule[activeSection]}
          </main>
        </div>
      </div>
      {assistantEnabled ? (
        <AssistantBot activeSection={activeSection} mode={interfaceMode} apiError={apiError} status={pxeStatus} systemReport={systemReport} audits={pxeAudits} />
      ) : null}
      <MobileNavigation activeSection={activeSection} onNavigate={navigateSection} items={visibleNavigation} />
    </div>
  )
}
