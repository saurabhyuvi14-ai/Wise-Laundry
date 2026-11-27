import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Smartphone, Banknote, IndianRupee } from 'lucide-react'
import { api } from '../../../services/api-client'
import { Card, CardHeader, CardBody } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../utils/cn'

const METHOD = { UPI: 'UPI', CASH: 'Cash' }

/** Small pill showing where the payment stands. */
export function PaymentBadge({ payment, className }) {
  if (!payment) return null
  const map = {
    PAID: [`Paid${payment.method ? ` · ${METHOD[payment.method]}` : ''}`, 'bg-emerald-100 text-emerald-700'],
    PENDING: ['Payment checking', 'bg-amber-100 text-amber-800'],
    UNPAID: ['Unpaid', 'bg-navy-100 text-navy-600'],
  }
  const [label, color] = map[payment.status] || map.UNPAID
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', color, className)}>{label}</span>
}

/** A UPI QR any payment app can scan. */
export function UpiQr({ value, size = 184 }) {
  return (
    <div className="inline-block rounded-2xl bg-white p-3 ring-1 ring-line">
      <QRCodeSVG value={value} size={size} level="M" marginSize={0} />
    </div>
  )
}

/**
 * Customer's "Pay now" card on the order page. Money goes straight to our UPI ID.
 * Since there's no gateway, the customer taps "I've paid" and staff confirm the money arrived.
 */
export function CustomerPayment({ order, onPaid }) {
  const [showRef, setShowRef] = useState(false)
  const [upiRef, setUpiRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const pay = order.upiPayment
  const status = order.payment?.status

  if (status === 'PAID') {
    return (
      <Card className="flex animate-fade-up items-center gap-3 border-emerald-200 bg-emerald-50/60 p-5">
        <CheckCircle2 className="size-6 shrink-0 text-emerald-600" aria-hidden />
        <div>
          <p className="font-bold text-emerald-900">Payment received</p>
          <p className="text-sm text-emerald-800">Paid by {METHOD[order.payment.method] ?? 'us'}. Thank you!</p>
        </div>
      </Card>
    )
  }
  if (!pay) return null // no UPI set up, or bill not ready yet

  async function markPaid() {
    setSaving(true)
    setError(null)
    try {
      const res = await api.markPaid(order.id, { upiRef: upiRef.trim() || undefined })
      onPaid(res.data, "Thanks! We'll confirm your payment shortly.")
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="animate-fade-up overflow-hidden border-brand-200">
      <CardHeader icon={IndianRupee} title={`Pay ₹${pay.amount}`} description="Pay now by UPI — it goes straight to us." />
      <CardBody className="space-y-4 pt-3">
        {status === 'PENDING' && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800">
            Thanks — we've noted your payment and are confirming it. You can pay again below if it didn't go through.
          </p>
        )}

        <a
          href={pay.link}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white transition hover:bg-brand-800 active:scale-[0.99]"
        >
          <Smartphone className="size-5" aria-hidden /> Pay ₹{pay.amount} with any UPI app
        </a>

        <div className="flex flex-col items-center gap-2 rounded-xl bg-canvas p-4 text-center">
          <p className="text-sm font-medium text-navy-700">On a computer? Scan with GPay, PhonePe, Paytm…</p>
          <UpiQr value={pay.link} />
          <p className="text-xs text-navy-500">Paying <span className="font-semibold">{pay.payeeName}</span> · {pay.upiId}</p>
        </div>

        {showRef && (
          <label className="block text-sm font-medium text-navy-700">
            UPI reference number (optional)
            <input
              value={upiRef}
              onChange={(e) => setUpiRef(e.target.value)}
              inputMode="numeric"
              maxLength={30}
              placeholder="e.g. 402212345678"
              className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-base"
            />
          </label>
        )}
        <Button variant="secondary" className="w-full" loading={saving} onClick={markPaid}>
          <CheckCircle2 className="size-4" aria-hidden /> I've paid
        </Button>
        {!showRef && (
          <button type="button" onClick={() => setShowRef(true)} className="mx-auto block text-xs font-semibold text-brand-700 hover:underline">
            Add UPI reference number
          </button>
        )}
        {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        {pay.cashAllowed && <p className="text-center text-xs text-navy-500">Or pay cash when we deliver.</p>}
      </CardBody>
    </Card>
  )
}

/**
 * Rider/staff payment control on a work-list card: badge, plus a QR to show the customer
 * and one-tap "Paid by UPI / Cash". Confirms a customer's own claim too.
 */
export function CollectPayment({ card, onDone }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const payment = card.payment
  if (!card.billed || payment?.status === 'PAID') {
    return payment?.status === 'PAID' ? <PaymentBadge payment={payment} /> : null
  }

  async function set(method) {
    setBusy(method)
    try {
      await api.staffSetPayment(card.reference, 'PAID', method)
      onDone(`${card.reference}: marked paid (${METHOD[method]})`)
    } catch (err) {
      onDone(err.message, 'error')
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <PaymentBadge payment={payment} />
        <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
          {payment?.status === 'PENDING' ? 'Confirm payment' : 'Collect payment'}
        </Button>
      </div>
      {open && (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-xl bg-canvas p-4 animate-fade-up">
          {card.upi && (
            <>
              <p className="text-sm font-semibold">Show this to the customer · ₹{card.upi.amount}</p>
              <UpiQr value={card.upi.link} size={160} />
            </>
          )}
          <div className="flex w-full flex-wrap justify-center gap-2">
            <Button size="sm" loading={busy === 'UPI'} onClick={() => set('UPI')}>
              <Smartphone className="size-4" aria-hidden /> Paid by UPI
            </Button>
            {card.upi?.cashAllowed !== false && (
              <Button size="sm" variant="secondary" loading={busy === 'CASH'} onClick={() => set('CASH')}>
                <Banknote className="size-4" aria-hidden /> Paid by cash
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
