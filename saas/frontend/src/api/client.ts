import axios from 'axios'
import { useAuthStore } from '../store/auth'

function resolveApiBase(): string {
  if (typeof window === 'undefined') return '/api'
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return '/api'
  return `http://${window.location.hostname}:8000/api`
}

const apiBase = resolveApiBase()
const api = axios.create({ baseURL: apiBase, withCredentials: true })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = false
let queue: Array<() => void> = []

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      if (refreshing) {
        return new Promise((resolve) => queue.push(() => resolve(api(original))))
      }
      refreshing = true
      try {
        const { data } = await axios.post(`${apiBase}/auth/refresh`, {}, { withCredentials: true })
        useAuthStore.getState().setAccessToken(data.access_token)
        queue.forEach((fn) => fn())
        queue = []
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(error)
  },
)

export default api
