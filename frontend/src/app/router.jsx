import { lazy, Suspense } from 'react'
import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom'
import { PublicLayout } from '../layouts/PublicLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { CustomerLayout } from '../layouts/CustomerLayout'
import { PageSkeleton } from '../components/ui/Spinner'

const page = (load) => {
  const Page = lazy(load)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Page />
    </Suspense>
  )
}

const routes = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: page(() => import('../pages/HomePage')) },
      { path: '/services', element: page(() => import('../pages/ServicesPage')) },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: page(() => import('../pages/LoginPage')) },
      { path: '/register', element: page(() => import('../pages/RegisterPage')) },
    ],
  },
  {
    path: '/customer',
    element: <CustomerLayout />,
    children: [
      { index: true, element: page(() => import('../pages/DashboardPage')) },
      { path: 'book', element: page(() => import('../pages/BookLaundryPage')) },
      { path: 'orders', element: page(() => import('../pages/MyOrdersPage')) },
      { path: 'orders/:orderId', element: page(() => import('../pages/OrderDetailsPage')) },
      { path: 'orders/:orderId/confirmation', element: page(() => import('../pages/BookingConfirmationPage')) },
      { path: 'orders/:orderId/tracking', element: page(() => import('../pages/LiveTrackingPage')) },
      { path: 'profile', element: page(() => import('../pages/ProfilePage')) },
      { path: 'addresses', element: page(() => import('../pages/AddressesPage')) },
      { path: '*', element: <Navigate to="/customer" replace /> },
    ],
  },
  { path: '*', element: page(() => import('../pages/NotFoundPage')) },
]

// Hash routing only for static previews where the host can't rewrite to index.html.
export const router = import.meta.env.VITE_HASH_ROUTER === 'true' ? createHashRouter(routes) : createBrowserRouter(routes)
