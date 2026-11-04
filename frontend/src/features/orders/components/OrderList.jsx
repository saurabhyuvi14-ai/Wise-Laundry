import { OrderCard } from './OrderCard'

/** A list of order rows (cards on narrow screens — guide §12). */
export function OrderList({ orders }) {
  return (
    <ul className="divide-y divide-line/70">
      {orders.map((o) => (
        <li key={o.id}>
          <OrderCard order={o} />
        </li>
      ))}
    </ul>
  )
}
