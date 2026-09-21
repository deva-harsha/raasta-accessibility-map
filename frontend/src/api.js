import axios from 'axios'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

export const api = axios.create({ baseURL: API_BASE_URL })

export function apiAssetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}
