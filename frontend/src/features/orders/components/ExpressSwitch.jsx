import { useEffect, useState } from 'react'
import { Zap, Clock3 } from 'lucide-react'
import { api } from '../../../services/api-client'
import { Card, CardBody } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { formatTime } from '../../../utils/formatDate'
import { hoursText } from './DeliverySpeed'

function useMinutesLeft(deadlineIso) {
  const calc = () => Math.max(0, Math.ceil((new Date(deadlineIso) - Date.now()) / 60000))
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 15000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineIso])
  return left
}

const leftText = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m} min left`)

/**
 * On the order page: lets a standard order switch to express (or back) for a few hours after booking.
 * The server checks the same rules again.
 */
export function ExpressSwitch({ order, standardHours, onChanged }) {
  const rules = order.expressRules
  const left = useMinutesLeft(rules?.deadline)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!rules || !(rules.canUpgrade || rules.canDowngrade) || left <= 0) return null

  async function change(express) {
    setSaving(true)
    setError(null)
    try {
      const res = await api.setExpress(order.id, { express })
      setConfirming(false)
      onChanged(res.data, express ? 'Switched to Express delivery' : 'Switched back to standard delivery')
    } catch (err) {
      if (err.status === 409) { setConfirming(false); onChanged(null, err.message, 'error') }
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const until = formatTime(rules.deadline)

  if (rules.canDowngrade) {
    return (
      <Card className="animate-fade-up p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-800"><Zap className="size-4" aria-hidden /> Express is on</p>
        <p className="mt-1 text-sm text-navy-700">Changed your mind? You can switch back to standard until <strong>{until}</strong> ({leftText(left)}).</p>
        <Button variant="ghost" size="sm" className="mt-2 -ml-2" loading={saving} onClick={() => change(false)}>Switch to standard</Button>
        {error && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p>}
      </Card>
    )
  }

  return (
    <Card className="animate-fade-up overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-white">
      <CardBody className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-white"><Zap className="size-5" aria-hidden /></span>
          <div>
            <p className="font-bold">Need it faster?</p>
            <p className="text-sm text-navy-700">
              Switch to Express: back in <strong>{hoursText(rules.turnaroundHours)}</strong>
              {standardHours ? <> instead of {hoursText(standardHours)}</> : null}, for +{rules.surchargePercent}% on the washing price.
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
          <Clock3 className="size-3.5" aria-hidden /> You can switch until {until} · {leftText(left)}
        </p>
        <Button className="w-full bg-amber-500 hover:bg-amber-600" onClick={() => setConfirming(true)}>
          <Zap className="size-4" aria-hidden /> Switch to Express
        </Button>
      </CardBody>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Switch to Express?"
        description={`${order.reference} · back in ${hoursText(rules.turnaroundHours)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Keep standard</Button>
            <Button className="bg-amber-500 hover:bg-amber-600" loading={saving} onClick={() => change(true)}>Yes, switch</Button>
          </>
        }
      >
        <p className="text-sm text-navy-700">
          An extra <strong>{rules.surchargePercent}%</strong> of the washing price is added to your final bill
          {order.bill ? ' (your bill is updated right away)' : ' when we weigh your clothes'}. You can switch back until {until}.
        </p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>}
      </Modal>
    </Card>
  )
}
