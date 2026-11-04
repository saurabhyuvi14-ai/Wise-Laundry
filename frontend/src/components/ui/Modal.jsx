import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/** Accessible dialog using the native <dialog> element (focus trap + Esc built in). */
export function Modal({ open, onClose, title, description, children, footer }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-line bg-white p-0 text-navy-900 shadow-2xl backdrop:bg-navy-950/40 backdrop:backdrop-blur-[2px] open:animate-fade-up"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {description && <p className="mt-1 text-sm text-navy-500">{description}</p>}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-navy-500 hover:bg-canvas" aria-label="Close dialog">
          <X className="size-5" />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-6 py-4">{footer}</div>}
    </dialog>
  )
}
