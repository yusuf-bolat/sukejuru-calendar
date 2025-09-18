import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

interface EventEditModalProps {
  event: {
    id: string | number
    title?: string
    start?: string
    end?: string
    extendedProps?: any
    backgroundColor?: string
    borderColor?: string
    textColor?: string
  }
  onClose: () => void
  onSave: (updated: { id: string | number; title: string; start: string; end: string; description?: string; backgroundColor?: string; borderColor?: string; textColor?: string }) => Promise<void>
  onDelete: (id: string | number) => Promise<void>
}

function toLocalInputValue(dateLike?: string) {
  if (!dateLike) return ''
  const d = new Date(dateLike)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

export default function EventEditModal({ event, onClose, onSave, onDelete }: EventEditModalProps) {
  const [title, setTitle] = useState(event.title || '')
  const [start, setStart] = useState(toLocalInputValue(event.start))
  const [end, setEnd] = useState(toLocalInputValue(event.end))
  const [description, setDescription] = useState(event.extendedProps?.description || '')
  const [backgroundColor, setBackgroundColor] = useState(event.extendedProps?.backgroundColor || event.backgroundColor || '#66bb6a')
  const [borderColor, setBorderColor] = useState(event.extendedProps?.borderColor || event.borderColor || '#1b5e20')
  const [textColor, setTextColor] = useState(event.extendedProps?.textColor || event.textColor || '#ffffff')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const COLOR_PRESETS = useMemo(() => ([
    { key: 'green', label: 'Green', bg: '#10b981', border: '#065f46', text: '#ffffff' },
    { key: 'indigo', label: 'Indigo', bg: '#6366f1', border: '#3730a3', text: '#ffffff' },
    { key: 'blue', label: 'Blue', bg: '#3b82f6', border: '#1e40af', text: '#ffffff' },
    { key: 'purple', label: 'Purple', bg: '#8b5cf6', border: '#5b21b6', text: '#ffffff' },
    { key: 'yellow', label: 'Yellow', bg: '#f59e0b', border: '#92400e', text: '#111827' },
    { key: 'red', label: 'Red', bg: '#ef4444', border: '#991b1b', text: '#ffffff' },
    { key: 'slate', label: 'Slate', bg: '#64748b', border: '#334155', text: '#ffffff' }
  ]), [])

  const initialPresetKey = useMemo(() => {
    const found = COLOR_PRESETS.find(p => p.bg.toLowerCase() === String(backgroundColor).toLowerCase())
    return found?.key || 'green'
  }, [COLOR_PRESETS, backgroundColor])
  const [selectedPreset, setSelectedPreset] = useState(initialPresetKey)

  const applyPreset = (key: string) => {
    const p = COLOR_PRESETS.find(p => p.key === key)
    if (!p) return
    setBackgroundColor(p.bg)
    setBorderColor(p.border)
    setTextColor(p.text)
  }

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value
    setSelectedPreset(key)
    applyPreset(key)
  }

  const handleSave = async () => {
    if (!title || !start || !end) return alert('Please provide title, start and end')
    setSaving(true)
    try {
      setErrorMsg(null)
      await onSave({ id: event.id, title, start: new Date(start).toISOString(), end: new Date(end).toISOString(), description, backgroundColor, borderColor, textColor })
      onClose()
    } catch (e: any) {
      console.error('Save failed', e)
      const msg = e?.message || JSON.stringify(e) || 'Unknown error'
      setErrorMsg(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this event?')) return
    setSaving(true)
    try {
      await onDelete(event.id)
      onClose()
    } catch (e) {
      console.error('Delete failed', e)
      alert('Failed to delete event')
    } finally {
      setSaving(false)
    }
  }

  // removed convert-to-todo feature

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-gray-100">Edit Event</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 space-y-4">
            <div>
              <label className="text-sm text-gray-300 block mb-1">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-700/40 border border-gray-600 rounded-md px-3 py-2 text-gray-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-300 block mb-1">Start</label>
                <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-gray-700/40 border border-gray-600 rounded-md px-3 py-2 text-gray-100" />
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-1">End</label>
                <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="w-full bg-gray-700/40 border border-gray-600 rounded-md px-3 py-2 text-gray-100" />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300 block mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-700/40 border border-gray-600 rounded-md px-3 py-2 text-gray-100 h-28" />
            </div>

            <div>
              <label className="text-sm text-gray-300 block mb-2">Event Color</label>
              <div className="flex items-center gap-3">
                <select value={selectedPreset} onChange={handlePresetChange} className="bg-gray-700/40 border border-gray-600 rounded-md px-3 py-2 text-gray-100">
                  {COLOR_PRESETS.map(p => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="inline-block w-5 h-5 rounded border" style={{ backgroundColor, borderColor }} />
                  Preview
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="px-4 pb-2 text-sm text-red-400">Save error: {errorMsg}</div>
          )}

          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700 flex-shrink-0">
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md">Delete</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
