import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Calendar, Star, Power, MapPin, Bell } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/Button'
import { workerRequestsService } from '@/services/requests.service'
import { io, type Socket } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [isAvailable, setIsAvailable] = useState(false)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  // Connect to socket and listen for incoming requests
  useEffect(() => {
    if (!user) return

    const socket = io(API_URL)
    socketRef.current = socket

    socket.emit('identify', { userId: user.id, role: 'WORKER' })

    // Listen for incoming request notifications
    socket.on('worker:incoming-request', (data: { request: { id: string }; expiresAt: string } & { request: { category: { name: string }; client: { user: { firstName: string; lastName: string } }; distanceKm?: number; estimatedArrivalMin?: number; finalPrice?: number; description?: string; address: string; latitude: number; longitude: number } & { type: string } }) => {
      // Navigate to the incoming request screen
      navigate('/requests/incoming', { state: data })
    })

    return () => { socket.disconnect() }
  }, [user, navigate])

  const handleToggleAvailability = async () => {
    setUpdatingAvailability(true)
    try {
      await workerRequestsService.updateAvailability(!isAvailable)
      setIsAvailable(!isAvailable)

      // Start GPS tracking when available
      if (!isAvailable && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          workerRequestsService
            .updateLocation(pos.coords.latitude, pos.coords.longitude)
            .catch(() => {})
        })
      }
    } catch {
      // fallback to local toggle if API fails
      setIsAvailable(!isAvailable)
    } finally {
      setUpdatingAvailability(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className={`px-6 pt-12 pb-6 text-white transition-colors ${isAvailable ? 'bg-primary' : 'bg-gray-600'}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm opacity-80">CasApp Pro</p>
            <h1 className="text-2xl font-heading font-bold">
              {user?.firstName} {user?.lastName}
            </h1>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center">
              <Bell size={18} />
            </button>
            <button
              onClick={logout}
              className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center text-sm font-bold"
            >
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </button>
          </div>
        </div>

        {/* Availability toggle */}
        <div className="bg-black/20 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold">
                {isAvailable ? '🟢 Disponible' : '🔴 No disponible'}
              </p>
              <p className="text-xs opacity-70">
                {isAvailable ? 'Recibiendo pedidos cercanos' : 'No recibirás pedidos nuevos'}
              </p>
            </div>
            <button
              onClick={handleToggleAvailability}
              disabled={updatingAvailability}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors disabled:opacity-60 ${
                isAvailable ? 'bg-white' : 'bg-white/30'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full transition-transform ${
                  isAvailable ? 'translate-x-7 bg-primary' : 'translate-x-1 bg-white'
                }`}
              />
            </button>
          </div>

          {isAvailable && (
            <div className="flex items-center gap-2 text-xs opacity-80 mt-1">
              <MapPin size={12} />
              <span>Compartiendo ubicación en tiempo real</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card text-center">
            <div className="text-2xl font-bold text-primary mb-0.5">$0</div>
            <div className="text-xs text-gray-500">Hoy</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-gray-800 mb-0.5">0</div>
            <div className="text-xs text-gray-500">Trabajos</div>
          </div>
          <div className="card text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-xl font-bold">—</span>
            </div>
            <div className="text-xs text-gray-500">Rating</div>
          </div>
        </div>

        {/* Active jobs */}
        <div className="mb-6">
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-3">Pedidos activos</h2>
          <div className="card text-center py-8">
            <div className="text-4xl mb-3">{isAvailable ? '⏳' : '😴'}</div>
            <p className="text-gray-500 text-sm">
              {isAvailable
                ? 'Esperando pedidos cercanos...'
                : 'Activá tu disponibilidad para recibir pedidos'}
            </p>
            {!isAvailable && (
              <Button
                className="mt-4"
                size="sm"
                loading={updatingAvailability}
                onClick={handleToggleAvailability}
              >
                <Power size={16} className="mr-2" />
                Activar disponibilidad
              </Button>
            )}
          </div>
        </div>

        {/* Upcoming scheduled */}
        <div>
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-3">Próximos programados</h2>
          <div className="card text-center py-6">
            <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No tenés trabajos programados</p>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3">
        <div className="flex justify-around">
          <button className="flex flex-col items-center gap-1 text-primary">
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">Inicio</span>
          </button>
          <button
            onClick={() => navigate('/jobs')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <Calendar size={20} />
            <span className="text-xs">Trabajos</span>
          </button>
          <button
            onClick={() => navigate('/earnings')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <BarChart2 size={20} />
            <span className="text-xs">Ganancias</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
              {user?.firstName?.[0]}
            </div>
            <span className="text-xs">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
