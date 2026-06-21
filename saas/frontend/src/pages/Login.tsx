import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import api from '../api/client'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAccessToken, setUser, setTenant } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAccessToken(data.access_token)
      const [{ data: user }, { data: tenant }] = await Promise.all([
        api.get('/users/me'),
        api.get('/tenants/me'),
      ])
      setUser(user)
      setTenant(tenant)
      navigate('/')
    } catch {
      setError('Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-forge-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 bg-forge-500 rounded-xl items-center justify-center mb-3">
            <Wrench size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-forge-700">Atelier Forge</h1>
          <p className="text-gray-400 text-sm mt-1">Plateforme de reconditionnement</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forge-500 text-sm"
              placeholder="admin@mon-atelier.fr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forge-500 text-sm"
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forge-500 text-white rounded-lg py-2.5 font-medium hover:bg-forge-600 transition disabled:opacity-60 text-sm"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
