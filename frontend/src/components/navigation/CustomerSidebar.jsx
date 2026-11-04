import { LayoutDashboard, Package, LogOut } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Logo } from './Navbar'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { cn } from '../../utils/cn'

// Only two menu items (team decision). Booking starts from the Dashboard button,
// Profile opens from the account card / avatar, Live Tracking opens from an order.
export const customerNav = [
  { to: '/customer', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customer/orders', label: 'My Orders', icon: Package },
]

/** Which menu item is active. Order details, tracking and booking all belong under My Orders / Dashboard. */
export function activeNavItem(pathname) {
  if (pathname.startsWith('/customer/orders') || pathname.startsWith('/customer/tracking')) return '/customer/orders'
  if (pathname === '/customer' || pathname === '/customer/' || pathname.startsWith('/customer/book')) return '/customer'
  return null
}

export function CustomerSidebar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const current = activeNavItem(pathname)
  const onProfile = pathname.startsWith('/customer/profile')

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white px-4 py-6 lg:flex">
      <Logo to="/customer" className="px-3" />

      <nav aria-label="Main" className="mt-10 flex flex-col gap-1">
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

      <div className={cn('mt-auto flex items-center gap-2 rounded-xl border p-2 transition', onProfile ? 'border-brand-200 bg-brand-50' : 'border-line')}>
        <Link to="/customer/profile" className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1" aria-label="Open profile">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
            {user?.fullName?.[0] ?? '?'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{user?.fullName}</span>
            <span className="block truncate text-xs text-navy-500 group-hover:text-brand-700">Profile & addresses</span>
          </span>
        </Link>
        <button onClick={logout} className="rounded-lg p-1.5 text-navy-500 hover:bg-canvas hover:text-red-600" aria-label="Log out">
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  )
}
