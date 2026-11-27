import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '../../../context/NotificationsContext'
import { cn } from '../../../utils/cn'

/** Bell with an unread count. Wiggles when a new update arrives. */
export function NotificationBell({ className, withLabel = false }) {
  const { unreadCount, ring } = useNotifications()
  const [wiggle, setWiggle] = useState(false)

  useEffect(() => {
    if (!ring) return
    setWiggle(true)
    const t = setTimeout(() => setWiggle(false), 900)
    return () => clearTimeout(t)
  }, [ring])

  const label = unreadCount ? `Updates, ${unreadCount} new` : 'Updates'
  return (
    <NavLink
      to="/customer/notifications"
      aria-label={withLabel ? undefined : label}
      className={({ isActive }) => cn(
        'relative',
        withLabel
          ? cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition', isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-navy-700 hover:bg-canvas hover:text-navy-900')
          : 'grid size-9 place-items-center rounded-full text-navy-700 hover:bg-canvas',
        className,
      )}
    >
      <span className="relative">
        <Bell className={cn('size-5 origin-top', withLabel && 'size-[19px]', wiggle && 'animate-wiggle')} aria-hidden />
        {unreadCount > 0 && (
          <span key={unreadCount} className="absolute -top-1.5 -right-2 grid h-4 min-w-4 animate-pop place-items-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </span>
      {withLabel && <span>Updates{unreadCount > 0 && <span className="sr-only">, {unreadCount} new</span>}</span>}
    </NavLink>
  )
}
