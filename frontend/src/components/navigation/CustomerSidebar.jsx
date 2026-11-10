import { LayoutDashboard, Package, MapPin, UserRound, Plus, LogOut } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Logo } from './Navbar'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { cn } from '../../utils/cn'

// Main menu (team decision): Dashboard · My Orders · [+ Book] · Tracking · Profile
export const customerNav = [
  { to: '/customer', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customer/orders', label: 'My Orders', icon: Package },
  { to: '/customer/tracking', label: 'Tracking', icon: MapPin },
  { to: '/customer/profile', label: 'Profile', icon: UserRound },
]
export const BOOK_PATH = '/customer/book'
export const BookIcon = Plus

/** Which menu item is active for the current URL. */
export function activeNavItem(pathname) {
  if (/^\/customer\/(tracking|orders\/[^/]+\/tracking)/.test(pathname)) return '/customer/tracking'
  if (pathname.startsWith('/customer/orders')) return '/customer/orders'
  if (pathname.startsWith('/customer/profile')) return '/customer/profile'
  if (pathname.startsWith(BOOK_PATH)) return BOOK_PATH
  if (pathname === '/customer' || pathname === '/customer/') return '/customer'
  return null
}

export function CustomerSidebar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const current = activeNavItem(pathname)

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white px-4 py-6 lg:flex">
      <Logo to="/customer" className="px-3" />

      <Link
        to={BOOK_PATH}
        aria-current={current === BOOK_PATH ? 'page' : undefined}
        className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
      >
        <BookIcon className="size-4" strokeWidth={2.5} aria-hidden /> Book a Pickup
      </Link>

      <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
        {customerNav.map(({ to, label, icon: Icon }) => {
          const active = current === to
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition',
                active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-navy-700 hover:bg-canvas hover:text-navy-900',
              )}
            >
              <Icon className="size-[19px]" aria-hidden />
              {label}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 rounded-xl border border-line p-2">
        <span className="flex min-w-0 flex-1 items-center gap-3 p-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
            {user?.fullName?.[0] ?? '?'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{user?.fullName}</span>
            <span className="block truncate text-xs text-navy-500">{user?.email}</span>
          </span>
        </span>
        <button onClick={logout} className="rounded-lg p-1.5 text-navy-500 hover:bg-canvas hover:text-red-600" aria-label="Log out">
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  )
}
