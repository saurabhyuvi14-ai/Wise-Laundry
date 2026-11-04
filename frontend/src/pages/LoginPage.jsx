import { LoginForm } from '../features/auth/components/LoginForm'

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-navy-500">Log in to book and track your laundry.</p>
      <LoginForm />
    </>
  )
}
