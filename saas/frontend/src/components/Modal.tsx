import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, wide }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} mt-12`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
