import axios from 'axios'

const baseURL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const api = axios.create({ baseURL })

export function apiAssetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path
  return baseURL ? `${baseURL}${path.startsWith('/') ? '' : '/'}${path}` : path
}
