export interface Tenant {
  id: string
  slug: string
  name: string
  plan: string
  business_type: string
  branding: { display_name?: string; color?: string; logo?: string }
  company: CompanyInfo
  enabled_modules: string[]
  is_active: boolean
  created_at: string
}

export interface CompanyInfo {
  name?: string
  address?: string
  zip_city?: string
  siret?: string
  vat_number?: string
  iban?: string
  payment_terms?: string
  legal_mentions?: string
}

export type UserRole = 'admin' | 'technician' | 'commercial' | 'accountant' | 'logistics'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export type ClientType = 'particulier' | 'grossiste' | 'semi_grossiste' | 'revendeur'

export interface Client {
  id: string
  type: ClientType
  company_name: string | null
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  whatsapp: string | null
  address: Record<string, string>
  tax_number: string | null
  discount_rate: number
  notes: string | null
  is_active: boolean
  created_at: string
}

export type StockStatus = 'received' | 'in_diagnosis' | 'in_refurbishment' | 'ready' | 'sold' | 'scrapped'

export interface StockItem {
  id: string
  serial_number: string | null
  brand: string | null
  model: string | null
  category: string
  status: StockStatus
  grade: string | null
  purchase_price: number | null
  sale_price: number | null
  audit_data: Record<string, unknown>
  erase_cert: Record<string, unknown>
  notes: string | null
  received_at: string
  sold_at: string | null
}

export type OrderStatus = 'draft' | 'confirmed' | 'prepared' | 'shipped' | 'delivered' | 'cancelled'

export interface OrderLine {
  id: string
  stock_item_id: string | null
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Order {
  id: string
  client_id: string
  reference: string
  status: OrderStatus
  discount_rate: number
  carrier: string | null
  tracking_number: string | null
  shipping_address: string | null
  notes: string | null
  created_at: string
  shipped_at: string | null
  lines: OrderLine[]
  subtotal: number
  total: number
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'

export interface InvoiceLine {
  id: string
  description: string
  quantity: number
  unit_price_ht: number
  vat_rate: number
  line_ht: number
  line_vat: number
  line_ttc: number
}

export interface Invoice {
  id: string
  client_id: string
  order_id: string | null
  number: string | null
  status: InvoiceStatus
  issue_date: string | null
  due_date: string | null
  notes: string | null
  created_at: string
  paid_at: string | null
  lines: InvoiceLine[]
  total_ht: number
  total_vat: number
  total_ttc: number
}

export type MessageStatus = 'sent' | 'failed'

export interface WhatsAppMessage {
  id: string
  client_id: string | null
  to_number: string
  body: string
  status: MessageStatus
  provider_message_id: string | null
  error: string | null
  created_at: string
}

export interface NavItem {
  label: string
  path: string
  icon: string
}

export interface Module {
  slug: string
  name: string
  description: string
  nav_items: NavItem[]
}
