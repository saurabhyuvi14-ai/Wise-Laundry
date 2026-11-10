import { Link, NavLink, useLocation } from 'react-router-dom'
import { customerNav, activeNavItem, BOOK_PATH, BookIcon } from './CustomerSidebar'
import { Logo } from './Navbar'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { cn } from '../../utils/cn'

export function MobileTopBar() {
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur lg:hidden">
      <Logo to="/customer" className="[&_span]:text-[15px] [&_svg]:size-8" />
      <Link to="/customer/profile" aria-label="Profile" className="grid size-9 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
        {user?.fullName?.[0] ?? '?'}
      </Link>
    </header>
  )
}

function Tab({ to, label, icon: Icon, active }) {
  return (
    <NavLink
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-semibold outline-none focus-visible:bg-brand-50 sm:text-[11px]',
        active ? 'text-brand-700' : 'text-navy-500',
      )}
    >
      <span className={cn('grid h-7 w-12 place-items-center rounded-full transition', active && 'bg-brand-50')}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="w-full truncate text-center">{label}</span>
    </NavLink>
  )
}

/** Phone tab bar: Dashboard · My Orders · [+] · Tracking · Profile */
export function MobileNav() {
  const { pathname } = useLocation()
  const current = activeNavItem(pathname)
  const [dash, orders, tracking, profile] = customerNav

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
        <Tab {...dash} active={current === dash.to} />
        <Tab {...orders} active={current === orders.to} />
        <div className="flex justify-center">
          <Link
            to={BOOK_PATH}
            aria-label="Book a pickup"
            aria-current={current === BOOK_PATH ? 'page' : undefined}
            className="-mt-5 mb-1.5 grid size-14 place-items-center rounded-full bg-brand-700 text-white shadow-lift ring-4 ring-white transition active:scale-95"
          >
            <BookIcon className="size-6" strokeWidth={2.5} aria-hidden />
          </Link>
        </div>
        <Tab {...tracking} active={current === tracking.to} />
        <Tab {...profile} active={current === profile.to} />
      </div>
    </nav>
  )
}
