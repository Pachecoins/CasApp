import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Star, Clock, X, MapPin } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { TrackingMap } from '@/components/map/TrackingMap'
import { workersService, requestsService } from '@/services/requests.service'
import { useAuthStore } from '@/store/auth.store'
import { formatPrice } from '@/lib/utils'

interface NearbyWorker {
  id: string
  rating: number
  distanceKm: number
  estimatedArrivalMin: number
  currentLatitude?: number
  currentLongitude?: number
  user: { firstName: string; lastName: string; avatarUrl?: string }
  workerServices: Array<{ hourlyRate?: number; category: { basePrice: number } }>
}

interface RequestData {
  latitude: number
  longitude: number
  categoryId: string
  category: { name: string; basePrice: number }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function SearchingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [requestData, setRequestData] = useState<RequestData | null>(null)
  const [workers, setWorkers] = useState<NearbyWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [matched, setMatched] = useState(false)
  const [searchDots, setSearchDots] = useState(1)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setSearchDots((d) => (d % 3) + 1), 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!requestId || !user) return

    const socket = io(API_URL)
    socketRef.current = socket

    socket.emit('identify', { userId: user.id, role: user.role })
    socket.emit('join-request-room', requestId)

    socket.on('request:status-change', (data: { requestId: string; status: string }) => {
      if (data.requestId === requestId && data.status === 'ASSIGNED') {
        setMatched(true)
        setTimeout(() => navigate(`/requests/${requestId}/tracking`), 1500)
      }
    })

    const load = async () => {
      try {
        const req = await requestsService.getById(requestId)
        setRequestData(req)
        const nearby = await workersService.getNearby({
          lat: req.latitude,
          lng: req.longitude,
          categoryId: req.categoryId,
          radius: 15,
        })
        setWorkers(nearby)
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => { socket.disconnect() }
  }, [requestId, user, navigate])

  const handleCancel = async () => {
    if (!requestId) return
    try { await requestsService.updateStatus(requestId, 'CANCELLED') } finally {
      navigate('/home')
    }
  }

  if (matched) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center text-white px-6">
        <div className="text-6xl mb-4 animate-bounce">🎉</div>
        <h2 className="text-2xl font-heading font-bold mb-2">¡Profesional encontrado!</h2>
        <p className="text-primary-100">En camino hacia vos...</p>
      </div>
    )
  }

  // Build worker pins for map
  const workerPins = workers
    .filter((w) => w.currentLatitude && w.currentLongitude)
    .map((w) => ({
      id: w.id,
      lat: w.currentLatitude!,
      lng: w.currentLongitude!,
      name: `${w.user.firstName} ${w.user.lastName}`,
      distanceKm: w.distanceKm,
      estimatedArrivalMin: w.estimatedArrivalMin,
    }))

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Leaflet map */}
      <div className="relative" style={{ height: '45vh' }}>
        {requestData ? (
          <TrackingMap
            clientLat={requestData.latitude}
            clientLng={requestData.longitude}
            workers={workerPins}
            zoom={13}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {/* Searching pulse overlay */}
        {!requestData && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-30 scale-150" />
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <MapPin size={20} className="text-white" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status header */}
      <div className="bg-white px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-gray-900">
              Buscando profesionales
              <span className="text-primary">{'.'.repeat(searchDots)}</span>
            </h2>
            <p className="text-sm text-gray-500">
              {workers.length > 0
                ? `${workers.length} disponible${workers.length > 1 ? 's' : ''} cerca tuyo`
                : loading
                  ? 'Localizando...'
                  : 'Ampliando área de búsqueda...'}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Workers list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))
          : workers.length === 0
            ? (
              <div className="card text-center py-8">
                <div className="text-4xl mb-3">😔</div>
                <p className="font-medium text-gray-700 mb-1">No hay profesionales cerca</p>
                <p className="text-sm text-gray-500">Ampliando el radio automáticamente...</p>
              </div>
            )
            : workers.map((worker) => {
                const price = worker.workerServices[0]?.category.basePrice
                return (
                  <div key={worker.id} className="card">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-base font-bold text-primary flex-shrink-0 overflow-hidden">
                        {worker.user.avatarUrl
                          ? <img src={worker.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                          : `${worker.user.firstName[0]}${worker.user.lastName[0]}`}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">
                            {worker.user.firstName} {worker.user.lastName}
                          </h3>
                          {price && (
                            <span className="text-sm font-bold text-primary">
                              {formatPrice(price * 1.35)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1">
                            <Star size={12} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-xs text-gray-600">
                              {worker.rating > 0 ? worker.rating.toFixed(1) : 'Nuevo'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin size={11} />
                            <span>{worker.distanceKm} km</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-secondary font-medium">
                            <Clock size={11} />
                            <span>~{worker.estimatedArrivalMin} min</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
      </div>

      <div className="px-4 pb-6">
        <div className="bg-primary-50 rounded-2xl p-3 text-center">
          <p className="text-sm text-primary-700">
            El primer profesional en aceptar tomará el pedido
          </p>
          <p className="text-xs text-primary-500 mt-0.5">
            Si nadie acepta en 5 min, se amplía el radio automáticamente
          </p>
        </div>
      </div>
    </div>
  )
}
