import { Navigate } from 'react-router-dom'

// Addresses now live inside Profile (team decision). Old links still work.
export default function AddressesPage() {
  return <Navigate to="/customer/profile#addresses" replace />
}
