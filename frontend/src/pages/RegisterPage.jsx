import { RegisterForm } from '../features/auth/components/RegisterForm'
import { IS_DEMO } from '../services/api-client'

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-navy-500">
        {IS_DEMO ? 'Demo mode — your details stay in this browser only.' : 'Book pickups in under a minute.'}
      </p>
      <RegisterForm />
    </>
  )
}
