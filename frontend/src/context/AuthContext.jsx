import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api-client'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready
  const [loggedOut, setLoggedOut] = useState(false) // true right after "Log out"
  const [justSignedUp, setJustSignedUp] = useState(false)

  const dismissSignupPrompt = useCallback(() => setJustSignedUp(false), [])

  useEffect(() => {
    api.me()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setStatus('ready'))
  }, [])

  const login = useCallback(async (credentials) => {
    const res = await api.login(credentials)
    setLoggedOut(false)
    setJustSignedUp(false)
    setUser(res.data)
    return res.data
  }, [])

  const register = useCallback(async (details) => {
    const res = await api.register(details)
    setLoggedOut(false)
    setJustSignedUp(true)
    setUser(res.data)
    return res.data
  }, [])

  // Google sign-in. A new person gets needsPhone back and is only signed in once they add a phone number.
  const googleSignIn = useCallback(async (credential, phone) => {
    const res = await api.googleSignIn(phone ? { credential, phone } : { credential })
    if (res.data.user) {
      setLoggedOut(false)
      if (phone) setJustSignedUp(true)
      setUser(res.data.user)
    }
    return res.data
  }, [])

  // OTP login. A new number is signed in but has no name yet, so the user is only
  // set once completeProfile() saves it (setting it earlier would leave the login page).
  const requestOtp = useCallback((phone) => api.requestOtp({ phone }), [])

  const verifyOtp = useCallback(async (phone, code) => {
    const res = await api.verifyOtp({ phone, code })
    setLoggedOut(false)
    if (!res.data.isNewUser) setUser(res.data.user)
    return res.data
  }, [])

  const completeProfile = useCallback(async (details) => {
    const res = await api.updateMe(details)
    setJustSignedUp(true)
    setUser(res.data)
    return res.data
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    // After a deliberate logout, don't let Google sign the person straight back in.
    try { window.google?.accounts?.id?.disableAutoSelect() } catch { /* ignore */ }
    try {
      sessionStorage.removeItem('wise-laundry-booking-draft')
      sessionStorage.clear()
    } catch { /* ignore */ }
    setLoggedOut(true)
    setJustSignedUp(false)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      loggedOut,
      justSignedUp,
      dismissSignupPrompt,
      login,
      register,
      googleSignIn,
      requestOtp,
      verifyOtp,
      completeProfile,
      logout,
      setUser,
    }),
    [user, status, loggedOut, justSignedUp, dismissSignupPrompt, login, register, googleSignIn, requestOtp, verifyOtp, completeProfile, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
