import axios from 'axios'
import { useAuthStore } from '../store/auth'

const api = axios.create({ baseURL: '/api', withCredentials: true })

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
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
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
