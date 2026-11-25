import { MapPin, Navigation } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'

/**
 * Dismissible popup shown after signup or when clicking "Add Address".
 * Offers "Use My Current Location" and "Close".
 */
export function LocationPromptModal({ open, detecting, error, onUseLocation, onClose }) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!detecting) onClose()
      }}
      title="Set up your pickup address"
      description="Use your current location to set up your pickup address?"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={detecting}>
            Close
          </Button>
          <Button type="button" onClick={onUseLocation} loading={detecting}>
            <Navigation className="size-4" /> Use My Current Location
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3.5 text-sm text-navy-700">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-700 text-white">
            <MapPin className="size-4" aria-hidden />
          </span>
          <p>
            We’ll detect your area, city, and pincode once so you can review, add your flat or house number, and confirm before saving.
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
