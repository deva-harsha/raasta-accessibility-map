import axios from 'axios'

const PRODUCTION_API_BASE_URL = 'https://raasta-api-ik0i.onrender.com'
const DEVELOPMENT_API_BASE_URL = 'http://127.0.0.1:8000'

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? PRODUCTION_API_BASE_URL : DEVELOPMENT_API_BASE_URL)
).replace(/\/$/, '')

export const api = axios.create({ baseURL: API_BASE_URL })

export function apiAssetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}
