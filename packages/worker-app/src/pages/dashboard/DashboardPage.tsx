import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Calendar, Star, Power, MapPin, Bell, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/Button'
import { workerRequestsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'
import { io, type Socket } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

type AvailableJob = {
  requestId: string
  categoryName: string
  categorySlug: string
  address: string
  distanceKm: number
  estimatedArrivalMin: number
  lotSize: string | null
  isGatedCommunity: boolean
  workerEarningsEstimate: number
  quotedPrice: number | null
  description: string | null
  createdAt: string
}

const LOT_SIZE_LABELS: Record<string, string> = {
  SMALL:  'Chico',
  MEDIUM: 'Mediano',
  LARGE:  'Grande',
}

const CATEGORY_ICONS: Record<string, string> = {
  'jardineria': '🌿',
  'piletas':    '💧',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [isAvailable, setIsAvailable]           = useState(false)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)

  // Live stats
  const [todayEarnings, setTodayEarnings]   = useState<number | null>(null)
  const [todayJobs, setTodayJobs]           = useState<number | null>(null)
  const [rating, setRating]                 = useState<number | null>(null)
  const [upcomingJobs, setUpcomingJobs]     = useState<Array<{
    id: string; scheduledAt: string; address: string; quotedPrice?: number
    status: string; category: { name: string; slug: string }
  }>>([])

  // Mission feed
  const [availableJobs, setAvailableJobs]   = useState<AvailableJob[]>([])
  const [feedLoading, setFeedLoading]       = useState(false)
  const [lastRefreshed, setLastRefreshed]   = useState<Date | null>(null)

  const socketRef = useRef<Socket | null>(null)

  // ── Load dashboard stats ─────────────────────────────────────────────────────
  useEffect(() => {
    workerRequestsService.getDashboard().then((d) => {
      setTodayEarnings(d.todayEarnings)
      setTodayJobs(d.todayJobsCount)
      setRating(d.rating)
      setUpcomingJobs(d.upcomingRequests)
    }).catch(() => {})
  }, [])

  // ── Socket: listen for incoming real-time request notifications ──────────────
  useEffect(() => {
    if (!user) return
    const socket = io(API_URL)
    socketRef.current = socket

    socket.emit('identify', { userId: user.id, role: 'WORKER' })

    socket.on('worker:incoming-request', (data: { request: { id: string }; expiresAt: string }) => {
      navigate('/requests/incoming', { state: data })
    })

    return () => { socket.disconnect() }
  }, [user, navigate])

  // ── Load available jobs ───────────────────────────────────────────────────────
  const loadAvailableJobs = useCallback(async () => {
    if (!isAvailable) return
    setFeedLoading(true)
    try {
      const jobs = await workerRequestsService.getAvailableJobs()
      setAvailableJobs(jobs)
      setLastRefreshed(new Date())
    } catch {
      // silently fail — job might have been taken
    } finally {
      setFeedLoading(false)
    }
  }, [isAvailable])

  useEffect(() => {
    if (isAvailable) {
      loadAvailableJobs()
      // Refresh feed every 30 s while available
      const interval = setInterval(loadAvailableJobs, 30_000)
      return () => clearInterval(interval)
    } else {
      setAvailableJobs([])
    }
  }, [isAvailable, loadAvailableJobs])

  // ── Toggle availability ───────────────────────────────────────────────────────
  const handleToggleAvailability = async () => {
    setUpdatingAvailability(true)
    try {
      await workerRequestsService.updateAvailability(!isAvailable)
      setIsAvailable((v) => !v)

      if (!isAvailable && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          workerRequestsService
            .updateLocation(pos.coords.latitude, pos.coords.longitude)
            .catch(() => {})
        })
      }
    } catch {
      setIsAvailable((v) => !v) // fallback
    } finally {
      setUpdatingAvailability(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-24">

      {/* ── Header ── */}
      <div className={`px-6 pt-12 pb-6 text-white transition-colors ${isAvailable ? 'bg-primary' : 'bg-gray-600'}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm opacity-80">TUKI Pro</p>
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
              <span className={`inline-block h-6 w-6 rounded-full transition-transform ${
                isAvailable ? 'translate-x-7 bg-primary' : 'translate-x-1 bg-white'
              }`} />
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

      {/* ── Stats ── */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card text-center">
            <div className="text-2xl font-bold text-primary mb-0.5">
              {todayEarnings === null ? '…' : formatPrice(todayEarnings)}
            </div>
            <div className="text-xs text-gray-500">Hoy</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-gray-800 mb-0.5">
              {todayJobs === null ? '…' : todayJobs}
            </div>
            <div className="text-xs text-gray-500">Trabajos</div>
          </div>
          <div className="card text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-xl font-bold">
                {rating === null ? '…' : rating > 0 ? rating.toFixed(1) : '—'}
              </span>
            </div>
            <div className="text-xs text-gray-500">Rating</div>
          </div>
        </div>

        {/* ── Mission feed ── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-bold text-gray-900">
              {isAvailable ? 'Pedidos cercanos' : 'Pedidos activos'}
            </h2>
            {isAvailable && (
              <button
                onClick={loadAvailableJobs}
                disabled={feedLoading}
                className="flex items-center gap-1 text-xs text-primary"
              >
                <RefreshCw size={13} className={feedLoading ? 'animate-spin' : ''} />
                {lastRefreshed
                  ? `Actualizado ${lastRefreshed.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Actualizar'}
              </button>
            )}
          </div>

          {!isAvailable ? (
            <div className="card text-center py-8">
              <div className="text-4xl mb-3">😴</div>
              <p className="text-gray-500 text-sm">Activá tu disponibilidad para recibir pedidos</p>
              <Button
                className="mt-4"
                size="sm"
                loading={updatingAvailability}
                onClick={handleToggleAvailability}
              >
                <Power size={16} className="mr-2" />
                Activar disponibilidad
              </Button>
            </div>
          ) : feedLoading && availableJobs.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card animate-pulse h-24 bg-gray-100" />
              ))}
            </div>
          ) : availableJobs.length === 0 ? (
            <div className="card text-center py-8">
              <div className="text-4xl mb-3">⏳</div>
              <p className="text-gray-500 text-sm">No hay pedidos cercanos en este momento.</p>
              <p className="text-gray-400 text-xs mt-1">Se actualizará automáticamente cada 30 s.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableJobs.map((job) => (
                <button
                  key={job.requestId}
                  onClick={() => navigate(`/requests/${job.requestId}`)}
                  className="card w-full text-left hover:shadow-card-hover transition-shadow active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-2xl flex-shrink-0">
                      {CATEGORY_ICONS[job.categorySlug] ?? '🔧'}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm text-gray-900 truncate">{job.categoryName}</p>
                        {job.isGatedCommunity && (
                          <span
                            title="Barrio cerrado — requiere ART/seguro verificado"
                            className="flex-shrink-0 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium"
                          >
                            ⚠️ BC
                          </span>
                        )}
                        {job.lotSize && (
                          <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                            {LOT_SIZE_LABELS[job.lotSize] ?? job.lotSize}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <MapPin size={11} />
                        <span className="truncate">{job.address}</span>
                      </div>
                      {job.description && (
                        <p className="text-xs text-gray-400 truncate">{job.description}</p>
                      )}
                    </div>

                    {/* Earnings + distance */}
                    <div className="flex flex-col items-end flex-shrink-0 ml-1">
                      <p className="text-base font-bold text-primary leading-tight">
                        {job.workerEarningsEstimate > 0 ? formatPrice(job.workerEarningsEstimate) : '—'}
                      </p>
                      <p className="text-xs text-gray-400">{job.distanceKm} km</p>
                      <p className="text-xs text-gray-400">~{job.estimatedArrivalMin} min</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Upcoming scheduled ── */}
        <div>
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-3">Próximos programados</h2>
          {upcomingJobs.length === 0 ? (
            <div className="card text-center py-6">
              <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">No tenés trabajos programados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/requests/${job.id}`)}
                  className="w-full card flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">
                    📅
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{job.category.name}</p>
                    <p className="text-xs text-gray-500 truncate">{job.address}</p>
                    <p className="text-xs text-blue-600 font-medium mt-0.5">
                      {new Date(job.scheduledAt).toLocaleDateString('es-AR', {
                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {job.quotedPrice && (
                    <p className="text-sm font-bold text-primary flex-shrink-0">
                      {formatPrice(Math.round(job.quotedPrice / 1.15))}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
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
