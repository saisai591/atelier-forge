const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forge-500'

export function TextInput({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type} value={value} placeholder={placeholder} required={required}
        onChange={(e) => onChange(e.target.value)} className={inputCls}
      />
    </div>
  )
}

export function NumberInput({ label, value, onChange, placeholder }: {
  label: string; value: number | ''; onChange: (v: number | '') => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number" step="0.01" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={inputCls}
      />
    </div>
  )
}

export function Select<T extends string>({ label, value, onChange, options, required }: {
  label: string; value: T; onChange: (v: T) => void
  options: { value: T; label: string }[]; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputCls}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export function SubmitBar({ onCancel, pending, label = 'Enregistrer' }: {
  onCancel: () => void; pending?: boolean; label?: string
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel}
        className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
        Annuler
      </button>
      <button type="submit" disabled={pending}
        className="px-4 py-2 rounded-lg bg-forge-500 text-white text-sm font-medium hover:bg-forge-600 disabled:opacity-60">
        {pending ? 'Enregistrement…' : label}
      </button>
    </div>
  )
}
