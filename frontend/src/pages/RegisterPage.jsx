import { GoogleSignIn } from '../features/auth/components/GoogleSignIn'
import { RegisterForm } from '../features/auth/components/RegisterForm'

export default function RegisterPage() {
  return (
    <GoogleSignIn
      mode="signup"
      header={
        <>
          <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
          <p className="mt-1 mb-6 text-sm text-navy-500">Book pickups in under a minute.</p>
        </>
      }
    >
      <RegisterForm />
    </GoogleSignIn>
  )
}
