import { useCallback, useEffect, useState } from 'react'
import { ShieldAlert, UserPlus } from 'lucide-react'
import { api } from '../services/api-client'
import { useAuth } from '../features/auth/hooks/useAuth'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/feedback/EmptyState'
import { useToast } from '../components/feedback/Toast'

const ROLES = [
  { value: 'RIDER', label: 'Rider', hint: 'Sees only the pickups and deliveries given to them.' },
  { value: 'STAFF', label: 'Staff', hint: 'Sees all orders, weighs, bills and gives jobs to riders.' },
  { value: 'ADMIN', label: 'Admin', hint: 'Everything staff can do, plus this Team page.' },
]
const roleLabel = Object.fromEntries(ROLES.map((r) => [r.value, r.label]))

/** Admin only: give people a team role by email, change it, or remove them. */
export default function TeamPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [team, setTeam] = useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('RIDER')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const isAdmin = user?.role === 'ADMIN'

  const load = useCallback(() => api.staffTeam().then((r) => setTeam(r.data)).catch((e) => setError(e.message)), [])
  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  if (user && !isAdmin) {
    return <EmptyState icon={ShieldAlert} title="Admins only" description="Ask an admin if you need to change the team." action={<Button to="/staff">Go to Work list</Button>} />
  }

  async function save(e, target = { email, role }) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.staffSetRole(target)
      toast(res.data.role === 'CUSTOMER' ? `${res.data.fullName} removed from the team` : `${res.data.fullName} is now ${roleLabel[res.data.role]}`)
      if (!e) return load()
      setEmail('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Team" description="Riders, staff and admins. They sign up on the website first, then you add them here by email." />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader title="Your team" />
          <CardBody className="pt-2">
            {!team ? (
              <p className="py-4 text-sm text-navy-500">Loading…</p>
            ) : (
              <ul className="divide-y divide-line">
                {team.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{m.fullName}{m.id === user.id && <span className="font-normal text-navy-500"> (you)</span>}</span>
                      <span className="block truncate text-sm text-navy-500">{m.email}{m.phone && ` · ${m.phone}`}</span>
                    </span>
                    {m.id === user.id ? (
                      <span className="text-sm font-semibold">{roleLabel[m.role]}</span>
                    ) : (
                      <>
                        <select
                          value={m.role}
                          disabled={busy}
                          onChange={(e) => save(null, { email: m.email, role: e.target.value })}
                          aria-label={`Role for ${m.fullName}`}
                          className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
                        >
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" disabled={busy} onClick={() => save(null, { email: m.email, role: 'CUSTOMER' })}>
                          Remove
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={UserPlus} title="Add someone" />
          <CardBody className="pt-3">
            <form onSubmit={save} noValidate className="space-y-4">
              <Input label="Their email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rider@gmail.com" hint="The email they signed up with." />
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-navy-700">Role</legend>
                {ROLES.map((r) => (
                  <label key={r.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/60">
                    <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="mt-1 accent-brand-700" />
                    <span>
                      <span className="block text-sm font-semibold">{r.label}</span>
                      <span className="block text-xs text-navy-500">{r.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>}
              <Button type="submit" className="w-full" loading={busy}>Add to team</Button>
              <p className="text-xs text-navy-500">They need to log out and back in to see their new screen.</p>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
