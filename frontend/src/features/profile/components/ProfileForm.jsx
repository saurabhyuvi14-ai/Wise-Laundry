import { useState } from 'react'
import { UserRound, Pencil, Lock } from 'lucide-react'
import { Card, CardHeader, CardBody } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { useToast } from '../../../components/feedback/Toast'
import { useAuth } from '../../auth/hooks/useAuth'
import { validate, required, isPhone } from '../../../utils/bookingValidation'
import { api } from '../../../services/api-client'

const schema = {
  fullName: [[required, 'Enter your full name.']],
  phone: [[required, 'Enter your mobile number.'], [isPhone, 'Enter a valid 10-digit mobile number.']],
}

export function ProfileForm() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({ fullName: user.fullName, phone: user.phone })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (f) => (e) => setValues((v) => ({ ...v, [f]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    const found = validate(values, schema)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      const res = await api.updateMe({ fullName: values.fullName.trim(), phone: values.phone.replace(/\D/g, '').slice(-10) })
      setUser(res.data)
      setEditing(false)
      toast('Profile updated')
    } catch (err) {
      setErrors(err.fields ?? {})
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setValues({ fullName: user.fullName, phone: user.phone })
    setErrors({})
    setEditing(false)
  }

  return (
    <Card>
      <CardHeader
        icon={UserRound}
        title="Customer details"
        description="Used to contact you about pickups."
        action={!editing && (
          <Button size="sm" variant="ghost" className="text-brand-700" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        )}
      />
      <CardBody>
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 md:grid-cols-3">
            <Input label="Full name" value={values.fullName} onChange={set('fullName')} disabled={!editing} error={errors.fullName} autoComplete="name" />
            <Input label="Mobile number" type="tel" inputMode="numeric" value={values.phone} onChange={set('phone')} disabled={!editing} error={errors.phone} autoComplete="tel" />
            <Input
              label={<span className="inline-flex items-center gap-1">Email <Lock className="size-3 text-navy-400" aria-hidden /></span>}
              value={user.email}
              disabled
              hint={editing ? 'Email changes need verification — coming later.' : undefined}
            />
          </div>
          {editing && (
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={cancel}>Cancel</Button>
              <Button type="submit" loading={saving}>Save changes</Button>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  )
}
