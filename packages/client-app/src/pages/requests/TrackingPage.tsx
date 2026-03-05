import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Star, Phone, AlertTriangle, CheckCircle } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { TrackingMap } from '@/components/map/TrackingMap'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { Button } from '@/components/ui/Button'
import { requestsService } from '@/services/requests.service'
import { useAuthStore } from '@/store/auth.store'
import { estimateArrivalMinutes, calculateDistance } from '@casapp/shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface RequestDetail {
  id: string
  status: string
  address: string
  latitude: number
  longitude: number
  finalPrice?: number
  category: { name: string }
  worker?: {
    id: string
    currentLatitude?: number
    currentLongitude?: number
    rating: number
    user: { id: string; firstName: string; lastName: string; avatarUrl?: string; phone?: string }
  }
  client: { userId: string }
}

interface WorkerLocation {
  lat: number
  lng: number
  workerId: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  PENDING:    { label: 'Buscando profesional...', color: 'text-gray-600',   bg: 'bg-gray-50',      emoji: '🔍' },
  MATCHED:    { label: 'Profesional en camino',  color: 'text-secondary',  bg: 'bg-secondary-50', emoji: '🚗' },
  CONFIRMED:  { label: 'Profesional en camino',  color: 'text-secondary',  bg: 'bg-secondary-50', emoji: '🚗' },
  IN_PROGRESS:{ label: 'Trabajando en tu casa',  color: 'text-primary',    bg: 'bg-primary-50',   emoji: '🔨' },
  COMPLETED:  { label: '¡Trabajo completado!',   color: 'text-primary',    bg: 'bg-primary-50',   emoji: '✅' },
  CANCELLED:  { label: 'Pedido cancelado',       color: 'text-red-600',    bg: 'bg-red-50',       emoji: '❌' },
}

export function TrackingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [workerLocation, setWorkerLocation] = useState<WorkerLocation | null>(null)
  const [eta, setEta] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const loadRequest = useCallback(async () => {
    if (!requestId) return
    try {
      const data = await requestsService.getById(requestId)
      setRequest(data)
      // Seed initial worker location from profile
      if (data.worker?.currentLatitude && data.worker?.currentLongitude) {
        setWorkerLocation({
          lat: data.worker.currentLatitude,
          lng: data.worker.currentLongitude,
          workerId: data.worker.id,
        })
        const dist = calculateDistance(
          data.latitude, data.longitude,
          data.worker.currentLatitude, data.worker.currentLongitude,
        )
        setEta(estimateArrivalMinutes(dist))
      }
    } catch {
      navigate('/home')
    } finally {
      setLoading(false)
    }
  }, [requestId, navigate])

  useEffect(() => {
    loadRequest()
  }, [loadRequest])

  useEffect(() => {
    if (!requestId || !user) return

    const socket = io(API_URL)
    socketRef.current = socket

    socket.emit('identify', { userId: user.id, role: user.role })
    socket.emit('join-request-room', requestId)

    // Real-time worker GPS updates
    socket.on('worker:location-update', (data: WorkerLocation & { requestId?: string }) => {
      if (!request) return
      setWorkerLocation({ lat: data.lat, lng: data.lng, workerId: data.workerId })
      const dist = calculateDistance(request.latitude, request.longitude, data.lat, data.lng)
      setEta(estimateArrivalMinutes(dist))
    })

    // Status changes
    socket.on('request:status-change', (data: { requestId: string; status: string }) => {
      if (data.requestId !== requestId) return
      setRequest((prev) => prev ? { ...prev, status: data.status } : prev)
      if (data.status === 'COMPLETED') {
        setTimeout(() => navigate(`/requests/${requestId}/review`), 2000)
      }
    })

    return () => { socket.disconnect() }
  }, [requestId, user, request, navigate])

  // ETA countdown tick
  useEffect(() => {
    if (eta === null || request?.status === 'IN_PROGRESS' || request?.status === 'COMPLETED') return
    if (eta <= 0) return
    const t = setTimeout(() => setEta((e) => (e !== null && e > 0 ? e - 1 : e)), 60_000)
    return () => clearTimeout(t)
  }, [eta, request?.status])

  const handleCancel = async () => {
    if (!requestId) return
    setCancelling(true)
    try {
      await requestsService.updateStatus(requestId, 'CANCELLED')
      navigate('/home')
    } finally {
      setCancelling(false)
    }
  }

  if (loading || !request) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const statusInfo = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.PENDING
  const canCancel = ['PENDING', 'MATCHED', 'CONFIRMED'].includes(request.status)
  const workerName = request.worker
    ? `${request.worker.user.firstName} ${request.worker.user.lastName}`
    : null

  // Build worker pins for map
  const workerPins = workerLocation && request.worker
    ? [{
        id: request.worker.id,
        lat: workerLocation.lat,
        lng: workerLocation.lng,
        name: workerName ?? '',
        isTracked: true,
      }]
    : []

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Map — full top half */}
      <div className="relative" style={{ height: '55vh' }}>
        <TrackingMap
          clientLat={request.latitude}
          clientLng={request.longitude}
          workers={workerPins}
          className="w-full h-full"
        />

        {/* Status overlay badge */}
        <div className={`absolute top-4 left-4 right-4 ${statusInfo.bg} rounded-2xl px-4 py-3 shadow-card flex items-center gap-3`}>
          <span className="text-2xl">{statusInfo.emoji}</span>
          <div className="flex-1">
            <p className={`font-heading font-bold ${statusInfo.color}`}>{statusInfo.label}</p>
            {eta !== null && request.status === 'CONFIRMED' && (
              <p className="text-sm text-gray-500">
                ETA: ~{eta} min • {request.category.name}
              </p>
            )}
            {request.status === 'IN_PROGRESS' && (
              <p className="text-sm text-gray-500">El trabajo está en progreso</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="flex-1 overflow-y-auto">
        {/* Worker card */}
        {request.worker && (
          <div className="mx-4 mt-4 card">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0 overflow-hidden">
                {request.worker.user.avatarUrl ? (
                  <img src={request.worker.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  `${request.worker.user.firstName[0]}${request.worker.user.lastName[0]}`
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{workerName}</p>
                <div className="flex items-center gap-1">
                  <Star size={13} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-sm text-gray-500">
                    {request.worker.rating > 0 ? request.worker.rating.toFixed(1) : 'Nuevo'}
                  </span>
                </div>
              </div>
              {/* ETA pill */}
              {eta !== null && (request.status === 'MATCHED' || request.status === 'CONFIRMED') && (
                <div className="bg-secondary-50 rounded-xl px-3 py-2 text-center">
                  <p className="text-xl font-bold text-secondary leading-none">{eta}</p>
                  <p className="text-xs text-secondary-600">min</p>
                </div>
              )}
              {/* Call button */}
              {request.worker.user.phone && (
                <a
                  href={`tel:${request.worker.user.phone}`}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
                >
                  <Phone size={16} className="text-white" />
                </a>
              )}
            </div>

            {/* Progress steps */}
            <div className="mt-4 flex items-center gap-1">
              {(['MATCHED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const).map((step, i) => {
                const steps = ['MATCHED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED']
                const current = steps.indexOf(request.status)
                const done = i <= current
                const labels = ['Aceptado', 'En camino', 'Trabajando', 'Listo']
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${done ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                        {i < current ? '✓' : i + 1}
                      </div>
                      <span className="text-xs text-gray-400 mt-1 text-center w-12 leading-tight">{labels[i]}</span>
                    </div>
                    {i < 3 && <div className={`flex-1 h-0.5 mb-4 mx-0.5 ${i < current ? 'bg-primary' : 'bg-gray-200'}`} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PENDING: no worker yet */}
        {!request.worker && request.status === 'PENDING' && (
          <div className="mx-4 mt-4 card text-center py-6">
            <div className="text-3xl mb-2 animate-pulse">🔍</div>
            <p className="font-medium text-gray-700">Buscando el mejor profesional...</p>
            <p className="text-sm text-gray-500 mt-1">Te avisaremos en cuanto alguien acepte</p>
          </div>
        )}

        {/* Completed */}
        {request.status === 'COMPLETED' && (
          <div className="mx-4 mt-4 card text-center py-6">
            <CheckCircle size={40} className="text-primary mx-auto mb-2" />
            <p className="font-heading font-bold text-gray-900">¡Trabajo completado!</p>
            <p className="text-sm text-gray-500 mt-1">Redirigiendo para calificar...</p>
          </div>
        )}

        {/* Cancel */}
        {canCancel && (
          <div className="px-4 mt-4 pb-4">
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full text-center text-sm text-gray-400 hover:text-red-500 transition-colors py-2"
              >
                Cancelar pedido
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">
                    ¿Seguro? Si ya hay un profesional asignado, podrías ser cobrado si cancelas tarde.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => setShowCancelConfirm(false)}>
                    No, volver
                  </Button>
                  <Button variant="danger" size="sm" className="flex-1" loading={cancelling} onClick={handleCancel}>
                    Sí, cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Spacer for chat widget */}
        <div className="h-20" />
      </div>

      {/* Floating chat */}
      {request.worker && socketRef.current && (
        <div className="fixed bottom-6 right-6 z-40">
          <ChatWidget
            socket={socketRef.current}
            requestId={request.id}
            currentUserId={user?.id ?? ''}
            currentUserName={`${user?.firstName} ${user?.lastName}`}
            floating
          />
        </div>
      )}
    </div>
  )
}
