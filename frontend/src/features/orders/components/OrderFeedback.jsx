import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Star, MessageSquareHeart, AlertTriangle, Check } from 'lucide-react'
import { api } from '../../../services/api-client'
import { Card, CardHeader, CardBody } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Textarea } from '../../../components/ui/Input'
import { cn } from '../../../utils/cn'

const WORDS = ['', 'Very bad', 'Not good', 'Okay', 'Good', 'Loved it']
const GOOD_TAGS = [['CLEAN_FRESH', 'Clean & fresh'], ['NEATLY_FOLDED', 'Neatly folded'], ['ON_TIME', 'On time'], ['POLITE_RIDER', 'Polite rider'], ['GOOD_VALUE', 'Good value']]
const BAD_TAGS = [['STAINS_LEFT', 'Stains left'], ['ITEM_MISSING', 'Item missing'], ['DAMAGED', 'Something damaged'], ['LATE', 'Came late'], ['WRONG_ITEMS', 'Wrong items']]
export const ISSUE_TYPES = [
  ['ITEM_MISSING', 'Item missing'],
  ['DAMAGED', 'Damaged item'],
  ['STAINS_LEFT', 'Stains not removed'],
  ['WRONG_ITEMS', 'Got someone else’s items'],
  ['LATE_DELIVERY', 'Late delivery'],
  ['BILLING', 'Wrong bill'],
  ['OTHER', 'Something else'],
]
const tagLabel = Object.fromEntries([...GOOD_TAGS, ...BAD_TAGS])
const issueLabel = Object.fromEntries(ISSUE_TYPES)

export function Stars({ value, onChange, size = 'size-8', readOnly }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="flex gap-1" role={readOnly ? 'img' : 'radiogroup'} aria-label={readOnly ? `${value} out of 5 stars` : 'Rating'} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= shown
        const icon = <Star className={cn(size, 'transition duration-200', on ? 'fill-amber-400 text-amber-400' : 'text-navy-400/50', on && n === value && !readOnly && 'animate-pop')} strokeWidth={1.75} aria-hidden />
        if (readOnly) return <span key={n}>{icon}</span>
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}, ${WORDS[n]}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="rounded-lg p-0.5 transition hover:scale-110 active:scale-95"
          >
            {icon}
          </button>
        )
      })}
    </div>
  )
}

function Chip({ on, onClick, children, tone = 'brand' }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm',
        on
          ? tone === 'red' ? 'border-red-400 bg-red-50 text-red-700' : 'border-brand-500 bg-brand-50 text-brand-800'
          : 'border-line bg-white text-navy-700 hover:border-navy-400/50',
      )}
    >
      {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      {children}
    </button>
  )
}

/** "How was it?" card on a delivered order: stars, quick tags, comment, and an optional problem report. */
export function OrderFeedback({ order, onSaved }) {
  const [params] = useSearchParams()
  const preset = Number(params.get('rate'))
  const [rating, setRating] = useState(preset >= 1 && preset <= 5 ? preset : 0)
  const [tags, setTags] = useState([])
  const [comment, setComment] = useState('')
  const [reporting, setReporting] = useState(false)
  const [issue, setIssue] = useState({ type: null, note: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (preset) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [preset])

  if (order.currentStatus !== 'DELIVERED') return null

  const fb = order.feedback
  if (fb) {
    return (
      <Card className="animate-fade-up">
        <CardHeader icon={MessageSquareHeart} title="Your rating" />
        <CardBody className="space-y-2 pt-3 text-sm">
          <div className="flex items-center gap-2"><Stars value={fb.rating} size="size-5" readOnly /><span className="font-semibold">{WORDS[fb.rating]}</span></div>
          {fb.tags.length > 0 && <p className="text-navy-500">{fb.tags.map((t) => tagLabel[t] ?? t).join(' · ')}</p>}
          {fb.comment && <p className="text-navy-700">“{fb.comment}”</p>}
          {fb.issue && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Problem reported: <strong>{issueLabel[fb.issue.type] ?? fb.issue.type}</strong>{fb.issue.note && ` — ${fb.issue.note}`}. Our team will look into it. <Link to={`/customer/help?order=${encodeURIComponent(order.reference)}`} className="font-semibold underline">Get help</Link></span>
            </p>
          )}
        </CardBody>
      </Card>
    )
  }

  const tagChoices = rating && rating <= 3 ? BAD_TAGS : GOOD_TAGS
  const toggleTag = (t) => setTags((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]))

  async function save() {
    if (!rating) return setError('Tap a star to rate.')
    if (reporting && !issue.type) return setError('Choose what went wrong.')
    if (reporting && issue.type === 'OTHER' && !issue.note.trim()) return setError('Tell us what went wrong.')
    setSaving(true)
    setError(null)
    try {
      const valid = new Set(tagChoices.map(([t]) => t))
      const res = await api.submitFeedback(order.id, {
        rating,
        tags: tags.filter((t) => valid.has(t)),
        comment,
        issue: reporting ? { type: issue.type, note: issue.note } : null,
      })
      onSaved(res.data, reporting ? 'Thanks. We have noted the problem.' : 'Thanks for rating!')
    } catch (err) {
      if (err.status === 409) onSaved(null, err.message, 'error')
      else setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Card ref={ref} className="animate-fade-up border-amber-200 bg-gradient-to-br from-amber-50/60 to-white">
      <CardHeader icon={MessageSquareHeart} title="How was your laundry?" />
      <CardBody className="space-y-4 pt-3">
        <div>
          <Stars value={rating} onChange={(n) => { setRating(n); setError(null) }} />
          <p className="mt-1 h-5 text-sm font-semibold text-navy-700" aria-live="polite">{WORDS[rating]}</p>
        </div>

        {rating > 0 && (
          <div className="animate-fade-up space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-navy-700">{rating <= 3 ? 'What went wrong?' : 'What did you like?'}</p>
              <div className="flex flex-wrap gap-2">
                {tagChoices.map(([t, label]) => <Chip key={t} on={tags.includes(t)} onClick={() => toggleTag(t)} tone={rating <= 3 ? 'red' : 'brand'}>{label}</Chip>)}
              </div>
            </div>
            <Textarea label="Anything else? (optional)" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />

            {!reporting ? (
              <button type="button" onClick={() => setReporting(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline">
                <AlertTriangle className="size-4" aria-hidden /> Report a problem with this order
              </button>
            ) : (
              <div className="animate-fade-up rounded-xl border border-red-200 bg-red-50/50 p-3.5">
                <p className="mb-2 text-sm font-semibold text-red-800">What's the problem?</p>
                <div className="flex flex-wrap gap-2">
                  {ISSUE_TYPES.map(([t, label]) => <Chip key={t} tone="red" on={issue.type === t} onClick={() => setIssue((s) => ({ ...s, type: t }))}>{label}</Chip>)}
                </div>
                <Textarea className="mt-3" aria-label="Problem details" placeholder="Which item, what happened…" rows={2} maxLength={500} value={issue.note} onChange={(e) => setIssue((s) => ({ ...s, note: e.target.value }))} />
                <button type="button" onClick={() => { setReporting(false); setIssue({ type: null, note: '' }) }} className="mt-2 text-xs font-semibold text-navy-500 hover:underline">Never mind</button>
              </div>
            )}
          </div>
        )}

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>}
        <Button onClick={save} loading={saving} disabled={!rating} className="w-full sm:w-auto">Submit</Button>
      </CardBody>
    </Card>
  )
}
