import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api-client'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready

  useEffect(() => {
    api.me()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setStatus('ready'))
  }, [])

  const login = useCallback(async (credentials) => {
    const res = await api.login(credentials)
    setUser(res.data)
    return res.data
  }, [])

  const register = useCallback(async (details) => {
    const res = await api.register(details)
    setUser(res.data)
    return res.data
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    try { sessionStorage.removeItem('wise-laundry-booking-draft') } catch { /* ignore */ }
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, status, login, register, logout, setUser }), [user, status, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
