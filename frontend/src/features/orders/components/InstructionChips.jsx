import { Check } from 'lucide-react'
import { cn } from '../../../utils/cn'

// Common instructions, one tap each. They're added to (or removed from) the text box.
export const QUICK_INSTRUCTIONS = [
  'Call before coming',
  'Ring the bell',
  'Leave with security',
  'Message on WhatsApp, don’t call',
  'Pets at home',
]

const has = (text, chip) => text.split(/\.\s*|\n/).some((part) => part.trim() === chip)

/** Toggle a quick instruction in a free-text instructions string. */
export function toggleInstruction(text, chip) {
  if (has(text, chip)) {
    return text
      .split(/(?<=\.)\s*/)
      .filter((part) => part.replace(/\.$/, '').trim() !== chip)
      .join(' ')
      .trim()
  }
  const base = text.trim()
  return `${base}${base && !/[.!?]$/.test(base) ? '.' : ''}${base ? ' ' : ''}${chip}.`.slice(0, 240)
}

export function InstructionChips({ value, onChange }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Quick instructions">
      {QUICK_INSTRUCTIONS.map((chip) => {
        const on = has(value, chip)
        return (
          <button
            key={chip}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggleInstruction(value, chip))}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm',
              on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line bg-white text-navy-700 hover:border-navy-400/50',
            )}
          >
            {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
            {chip}
          </button>
        )
      })}
    </div>
  )
}
