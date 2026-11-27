import { useEffect, useState } from 'react'
import { cn } from '../../utils/cn'

/**
 * A box that glides to whichever option is selected, so choosing a new card
 * looks like the selection is moving across. Put it inside a `relative` container
 * and mark each option with data-option="<key>".
 */
export function SlidingHighlight({ containerRef, activeKey, className }) {
  const [box, setBox] = useState(null)

  // useEffect (not layout): runs after the parent's ref is attached, even on first mount.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => {
      const el = activeKey != null ? container.querySelector(`[data-option="${CSS.escape(String(activeKey))}"]`) : null
      if (!el) return setBox(null)
      setBox((prev) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, ready: Boolean(prev) }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    return () => ro.disconnect()
  }, [containerRef, activeKey])

  if (!box) return null
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute top-0 left-0 z-0 rounded-xl motion-reduce:transition-none',
        box.ready && 'transition-[transform,width,height,background-color,border-color,box-shadow] duration-[550ms] ease-[cubic-bezier(0.3,1.25,0.4,1)]',
        className,
      )}
      style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }}
    />
  )
}
