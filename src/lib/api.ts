import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE || 'https://masjidaltaubah.co.za/api'

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
})

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
  else delete api.defaults.headers.common.Authorization
}

export type ApiOk<T> = { ok: true; data?: T; token?: string; user?: any }

export function getErrorMessage(err: any): string {
  const msg = err?.response?.data?.error || err?.message
  return typeof msg === 'string' ? msg : 'Request failed'
}
