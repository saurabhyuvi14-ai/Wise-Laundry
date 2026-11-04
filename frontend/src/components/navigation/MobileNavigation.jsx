import { Link, NavLink, useLocation } from 'react-router-dom'
import { customerNav, activeNavItem } from './CustomerSidebar'
import { Logo } from './Navbar'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { cn } from '../../utils/cn'

export function MobileTopBar() {
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
      <Logo to="/customer" className="[&_svg]:size-8 [&_span]:text-[15px]" />
      <Link to="/customer/profile" aria-label="Profile and addresses" className="grid size-9 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
        {user?.fullName?.[0] ?? '?'}
      </Link>
    </header>
  )
}

export function MobileNav() {
  const { pathname } = useLocation()
  const current = activeNavItem(pathname)
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {customerNav.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          aria-current={current === to ? 'page' : undefined}
          className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', current === to ? 'text-brand-700' : 'text-navy-500')}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
