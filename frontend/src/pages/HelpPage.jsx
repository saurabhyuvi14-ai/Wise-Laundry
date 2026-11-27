import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, MessageCircle, Phone, Mail, Headset } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useServices } from '../features/services/components/ServiceList'
import { formatCurrency, UNIT_LABEL } from '../utils/formatCurrency'
import { cn } from '../utils/cn'

// Support contacts come from the deploy settings, so nothing fake is ever shown.
const env = import.meta.env
const WHATSAPP = (env.VITE_SUPPORT_WHATSAPP || '').replace(/\D/g, '')
const PHONE = (env.VITE_SUPPORT_PHONE || '').trim()
const EMAIL = (env.VITE_SUPPORT_EMAIL || '').trim()

const days = (hours) => (hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} hours`)

function faqs(services) {
  const priceList = services?.length
    ? services.map((s) => `${s.name}: ${formatCurrency(s.unitPricePaise)} ${UNIT_LABEL[s.pricingUnit]}`).join(' · ')
    : null
  const turnaround = services?.length
    ? services.map((s) => `${s.name} takes about ${days(s.turnaroundHours)}`).join(', ')
    : null
  return [
    {
      q: 'How much will I pay?',
      a: `You pay by weight or by item, not a fixed price. ${priceList ? `${priceList}. ` : ''}We weigh or count your clothes after pickup, and the final bill shows up on your order page.`,
    },
    {
      q: 'Do I need to count or weigh my clothes?',
      a: 'No. Just hand them over. Our team weighs or counts them and puts the exact numbers on your bill.',
    },
    {
      q: 'How long does it take?',
      a: `${turnaround ? `${turnaround}, counted from pickup. ` : ''}Your order page shows the expected delivery time, and you can track every step live.`,
    },
    {
      q: 'Can I change or cancel my pickup?',
      a: 'Yes. Open the order and use “Change this pickup”. You can reschedule or cancel up to 2 hours before the pickup time, and reschedule up to 2 times per order. After that, contact us below.',
    },
    {
      q: 'Do you pick up from my area?',
      a: 'We currently serve Bengaluru. When you save an address we check it right away and tell you if we can reach it.',
    },
    {
      q: 'How do I tell the rider something?',
      a: 'Add it in “Pickup & delivery instructions” when you book (gate number, call first, leave with security…). Save it on your address and it fills in automatically next time.',
    },
    {
      q: 'Is my address and phone number safe?',
      a: 'Yes. Your address and instructions are stored encrypted and are only used to pick up and deliver your order.',
    },
  ]
}

function Faq({ q, a, open, onToggle }) {
  return (
    <div className="border-b border-line last:border-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-4 py-4 text-left font-semibold">
        {q}
        <ChevronDown className={cn('size-4 shrink-0 text-navy-500 transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <p className="-mt-1 pb-4 text-sm leading-relaxed text-navy-700">{a}</p>}
    </div>
  )
}

export default function HelpPage() {
  const [params] = useSearchParams()
  const order = params.get('order')
  const services = useServices()
  const [openIdx, setOpenIdx] = useState(0)
  const message = order ? `Hi Wise Laundry, I need help with order ${order}.` : 'Hi Wise Laundry, I need some help.'
  const hasContact = WHATSAPP || PHONE || EMAIL

  return (
    <>
      <PageHeader
        back={order ? { to: `/customer/orders/${encodeURIComponent(order)}`, label: `Order ${order}` } : { to: '/customer', label: 'Dashboard' }}
        title="Help & support"
        description={order ? `Getting help with order ${order}` : 'Quick answers, or talk to us.'}
      />

      <div className="grid animate-fade-up gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader title="Common questions" />
          <CardBody className="pt-1">
            {faqs(services.data).map((f, i) => (
              <Faq key={f.q} {...f} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
            ))}
          </CardBody>
        </Card>

        <Card className="self-start">
          <CardHeader icon={Headset} title="Talk to us" />
          <CardBody className="space-y-2 pt-3">
            {hasContact ? (
              <>
                {WHATSAPP && (
                  <Button href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="w-full">
                    <MessageCircle className="size-4" aria-hidden /> Chat on WhatsApp
                  </Button>
                )}
                {PHONE && (
                  <Button variant="secondary" href={`tel:${PHONE.replace(/[^\d+]/g, '')}`} className="w-full">
                    <Phone className="size-4" aria-hidden /> Call {PHONE}
                  </Button>
                )}
                {EMAIL && (
                  <Button variant="secondary" href={`mailto:${EMAIL}?subject=${encodeURIComponent(order ? `Help with ${order}` : 'Help')}`} className="w-full">
                    <Mail className="size-4" aria-hidden /> Email us
                  </Button>
                )}
                {order && <p className="pt-1 text-xs text-navy-500">Your order number {order} is added to the message for you.</p>}
              </>
            ) : (
              <p className="text-sm text-navy-700">Contact details are coming soon. For now, the answers on this page cover most questions.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
