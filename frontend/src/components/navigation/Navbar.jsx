import { Link, NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'
import { useAuth } from '../../features/auth/hooks/useAuth'

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-9', className)} aria-hidden>
      <rect x="3" y="2" width="26" height="28" rx="7" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M3 9.5h26" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="8" cy="6" r="1.1" fill="currentColor" />
      <circle cx="11.5" cy="6" r="1.1" fill="currentColor" />
      <circle cx="16" cy="19.5" r="6.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M10.4 20.6c1.9-1.5 3.7-1.5 5.6 0s3.7 1.5 5.6 0a5.6 5.6 0 0 1-11.2 0z" fill="currentColor" />
    </svg>
  )
}

export function Logo({ to = '/', className }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5 text-brand-700', className)} aria-label="Wise Laundry home">
      <LogoMark />
      <span className="text-[17px] leading-[1.05] font-extrabold tracking-tight text-navy-900">
        Wise<br />Laundry
      </span>
    </Link>
  )
}

export function Navbar() {
  const { user } = useAuth()
  const link = ({ isActive }) => cn('text-sm font-medium transition hover:text-navy-900', isActive ? 'text-navy-900' : 'text-navy-500')

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo className="[&_svg]:size-8 [&_span]:text-[15px]" />
        <nav aria-label="Main" className="flex items-center gap-3 sm:gap-7">
          <NavLink to="/" end className={(s) => cn(link(s), 'hidden sm:inline')}>Home</NavLink>
          <NavLink to="/services" className={(s) => cn(link(s), 'hidden min-[400px]:inline')}>Services</NavLink>
          {user ? (
            <Button to="/customer" size="sm" className="whitespace-nowrap">Dashboard</Button>
          ) : (
            <>
              <NavLink to="/login" className={cn(link({}), 'hidden sm:inline')}>Log in</NavLink>
              <Button to="/customer/book" size="sm" className="whitespace-nowrap">Book a Pickup</Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
