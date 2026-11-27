import { OrderCard } from './OrderCard'

/** A list of order rows (cards on narrow screens — guide §12). */
export function OrderList({ orders }) {
  return (
    <ul className="divide-y divide-line/70">
      {orders.map((o, i) => (
        <li key={o.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
          <OrderCard order={o} />
        </li>
      ))}
    </ul>
  )
}
