import { AuthProvider } from '../context/AuthContext'
import { BookingProvider } from '../context/BookingContext'
import { ToastProvider } from '../components/feedback/Toast'

export function Providers({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <BookingProvider>{children}</BookingProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
