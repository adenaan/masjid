import { useEffect, useMemo, useState } from 'react'
import { api, API_BASE, getErrorMessage, setAuthToken } from './api'
import type { AuthUser } from './types'

const TOKEN_KEY = 'mat_auth_token'
const USER_KEY = 'mat_auth_user'

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  })
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    setAuthToken(token)
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {}
  }, [token])

  useEffect(() => {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
      else localStorage.removeItem(USER_KEY)
    } catch {}
  }, [user])

  const isAuthed = !!token && !!user

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password })
    if (!res.data?.ok) throw new Error('Login failed')
    setToken(res.data.token)
    setUser(res.data.user)
  }

  function logout() {
    setToken(null)
    setUser(null)
    setAuthToken(null)
  }

  const role = user?.role || null

  return useMemo(
    () => ({ token, user, role, isAuthed, login, logout, setToken, setUser }),
    [token, user, role, isAuthed]
  )
}


function toAbsoluteUrl(url: string): string {
  const u = String(url || '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('/')) {
    const origin = API_BASE.replace(/\/api\/?$/i, '')
    return origin + u
  }
  return u
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('image', file)
  const res = await api.post('/upload/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  if (!res.data?.ok || !res.data?.url) throw new Error('Upload failed')
  return toAbsoluteUrl(String(res.data.url))
}

export function prettyError(e: any) {
  return getErrorMessage(e)
}
