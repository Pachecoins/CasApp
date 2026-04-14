import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Star, Phone, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { TrackingMap } from '@/components/map/TrackingMap'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { Button } from '@/components/ui/Button'
import { requestsService } from '@/services/requests.service'
import { useAuthStore } from '@/store/auth.store'
import { estimateArrivalMinutes, calculateDistance } from '@casapp/shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const AUTO_RELEASE_HOURS = 24

interface RequestDetail {
  id: string
  status: string
  address: string
  latitude: number
  longitude: number
  quotedPrice?: number
  finalPrice?: number
  completionPhotoUrl?: string
  finishedAt?: string
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

interface WorkerLocation { lat: number; lng: number; workerId: string }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  SEARCHING:                 { label: 'Buscando profesional...',         color: 'text-gray-600',  bg: 'bg-gray-50',     emoji: '🔍' },
  ASSIGNED:                  { label: 'Profesional asignado',            color: 'text-blue-600',  bg: 'bg-blue-50',     emoji: '👷' },
  EN_ROUTE:                  { label: 'Profesional en camino',           color: 'text-orange-600',bg: 'bg-orange-50',   emoji: '🚗' },
  IN_PROGRESS:               { label: 'Trabajando en tu domicilio',      color: 'text-primary',   bg: 'bg-primary-50',  emoji: '🔨' },
  FINISHED_PENDING_APPROVAL: { label: '¡Trabajo terminado! Revisá la foto', color: 'text-green-700', bg: 'bg-green-50', emoji: '📸' },
  COMPLETED:                 { label: '¡Pago liberado! Gracias.',        color: 'text-primary',   bg: 'bg-primary-50',  emoji: '✅' },
  CANCELLED:                 { label: 'Pedido cancelado',                color: 'text-red-600',   bg: 'bg-red-50',      emoji: '❌' },
  DISPUTED:                  { label: 'Disputa abierta — revisando',     color: 'text-amber-700', bg: 'bg-amber-50',    emoji: '⚠️' },
}

const PROGRESS_STEPS = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'FINISHED_PENDING_APPROVAL', 'COMPLETED']
const PROGRESS_LABELS = ['Asignado', 'En camino', 'Trabajando', 'Terminado', 'Pagado']

// How many seconds remain until auto-release from finishedAt
function secondsUntilAutoRelease(finishedAt: string): number {
  const finished = new Date(finishedAt).getTime()
  const deadline = finished + AUTO_RELEASE_HOURS * 3600 * 1000
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000))
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function TrackingPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [workerLocation, setWorkerLocation] = useState<WorkerLocation | null>(null)
  const [eta, setEta] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [releasing, setReleasing] = useState(false)
  const [disputing, setDisputing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showDisputeConfirm, setShowDisputeConfirm] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadRequest = useCallback(async () => {
    if (!requestId) return
    try {
      const data = await requestsService.getById(requestId)
      setRequest(data)
      if (data.worker?.currentLatitude && data.worker?.currentLongitude) {
        setWorkerLocation({ lat: data.worker.currentLatitude, lng: data.worker.currentLongitude, workerId: data.worker.id })
        const dist = calculateDistance(data.latitude, data.longitude, data.worker.currentLatitude, data.worker.currentLongitude)
        setEta(estimateArrivalMinutes(dist))
      }
      if (data.status === 'FINISHED_PENDING_APPROVAL' && data.finishedAt) {
        setCountdown(secondsUntilAutoRelease(data.finishedAt))
      }
    } catch {
      navigate('/home')
    } finally {
      setLoading(false)
    }
  }, [requestId, navigate])

  useEffect(() => { loadRequest() }, [loadRequest])

  // Socket.io real-time updates
  useEffect(() => {
    if (!requestId || !user) return
    const socket = io(API_URL)
    socketRef.current = socket
    socket.emit('identify', { userId: user.id, role: user.role })
    socket.emit('join-request-room', requestId)

    socket.on('worker:location-update', (data: WorkerLocation & { requestId?: string }) => {
      if (!request) return
      setWorkerLocation({ lat: data.lat, lng: data.lng, workerId: data.workerId })
      const dist = calculateDistance(request.latitude, request.longitude, data.lat, data.lng)
      setEta(estimateArrivalMinutes(dist))
    })

    socket.on('request:status-change', (data: { requestId: string; status: string; completionPhotoUrl?: string; finishedAt?: string }) => {
      if (data.requestId !== requestId) return
      setRequest(prev => prev ? {
        ...prev,
        status: data.status,
        completionPhotoUrl: data.completionPhotoUrl ?? prev.completionPhotoUrl,
        finishedAt: data.finishedAt ?? prev.finishedAt,
      } : prev)
      if (data.status === 'FINISHED_PENDING_APPROVAL' && data.finishedAt) {
        setCountdown(secondsUntilAutoRelease(data.finishedAt))
      }
      if (data.status === 'COMPLETED') {
        setTimeout(() => navigate(`/requests/${requestId}/review`), 1500)
      }
    })

    return () => { socket.disconnect() }
  }, [requestId, user, request, navigate])

  // ETA countdown
  useEffect(() => {
    if (eta === null || ['IN_PROGRESS', 'COMPLETED', 'FINISHED_PENDING_APPROVAL'].includes(request?.status ?? '')) return
    if (eta <= 0) return
    const t = setTimeout(() => setEta(e => (e !== null && e > 0 ? e - 1 : e)), 60_000)
    return () => clearTimeout(t)
  }, [eta, request?.status])

  // 24h auto-release countdown
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) return
    countdownRef.current = setInterval(() => setCountdown(c => (c !== null && c > 0 ? c - 1 : 0)), 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [countdown !== null])

  const handleRelease = async () => {
    if (!requestId) return
    setReleasing(true)
    try {
      await requestsService.updateStatus(requestId, 'COMPLETED')
      // Socket will redirect once status change is received
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al liberar el pago')
    } finally {
      setReleasing(false)
    }
  }

  const handleDispute = async () => {
    if (!requestId || !disputeReason.trim()) return
    setDisputing(true)
    try {
      await requestsService.updateStatus(requestId, 'DISPUTED', disputeReason)
      setShowDisputeConfirm(false)
      setRequest(prev => prev ? { ...prev, status: 'DISPUTED' } : prev)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al abrir disputa')
    } finally {
      setDisputing(false)
    }
  }

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
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" /></div>
  }

  const statusInfo = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.SEARCHING
  const canCancel = ['SEARCHING', 'ASSIGNED'].includes(request.status)
  const workerName = request.worker ? `${request.worker.user.firstName} ${request.worker.user.lastName}` : null
  const workerPins = workerLocation && request.worker
    ? [{ id: request.worker.id, lat: workerLocation.lat, lng: workerLocation.lng, name: workerName ?? '', isTracked: true }]
    : []
  const price = request.finalPrice ?? request.quotedPrice
  const isFinishedPendingApproval = request.status === 'FINISHED_PENDING_APPROVAL'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Map */}
      <div className="relative" style={{ height: '50vh' }}>
        <TrackingMap clientLat={request.latitude} clientLng={request.longitude} workers={workerPins} className="w-full h-full" />
        <div className={`absolute top-4 left-4 right-4 ${statusInfo.bg} rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3`}>
          <span className="text-2xl">{statusInfo.emoji}</span>
          <div className="flex-1">
            <p className={`font-bold ${statusInfo.color}`}>{statusInfo.label}</p>
            {eta !== null && request.status === 'EN_ROUTE' && (
              <p className="text-sm text-gray-500">ETA: ~{eta} min</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="flex-1 overflow-y-auto pb-6">

        {/* ── FINISHED_PENDING_APPROVAL: completion photo + release button ── */}
        {isFinishedPendingApproval && (
          <div className="mx-4 mt-4 space-y-3">
            {/* Completion photo */}
            {request.completionPhotoUrl && (
              <div className="rounded-2xl overflow-hidden border border-gray-200">
                <div className="bg-gray-800 px-3 py-2">
                  <p className="text-xs text-gray-300 font-medium">📸 Foto del trabajo terminado</p>
                </div>
                <img src={request.completionPhotoUrl} alt="Trabajo terminado" className="w-full object-cover max-h-64" />
              </div>
            )}

            {/* Auto-release countdown */}
            {countdown !== null && countdown > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl">⏰</span>
                <div>
                  <p className="text-xs text-gray-500">Liberación automática en</p>
                  <p className="font-mono font-bold text-gray-800 text-lg">{formatCountdown(countdown)}</p>
                </div>
              </div>
            )}

            {/* Release payment button */}
            <button
              onClick={handleRelease}
              disabled={releasing}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-5 rounded-2xl text-lg flex items-center justify-center gap-3 disabled:opacity-60 transition-colors"
            >
              <CheckCircle size={24} />
              {releasing ? 'Liberando...' : 'Todo excelente — Liberar pago'}
            </button>

            {/* Escrow transparency note */}
            <div className="bg-green-50 rounded-xl px-4 py-3 text-xs text-green-700 flex gap-2">
              <span>🔒</span>
              <span>Tu dinero estuvo retenido de forma segura en TUKI. Al aprobar, se transfiere al profesional.</span>
            </div>

            {/* Dispute link */}
            {!showDisputeConfirm ? (
              <button
                onClick={() => setShowDisputeConfirm(true)}
                className="w-full text-center text-sm text-gray-400 hover:text-red-500 transition-colors py-2 flex items-center justify-center gap-2"
              >
                <ShieldAlert size={14} />
                El trabajo no está bien — Abrir disputa
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">¿Qué salió mal?</p>
                </div>
                <textarea
                  className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm resize-none"
                  rows={3}
                  placeholder="Describí el problema con el trabajo..."
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => setShowDisputeConfirm(false)}>
                    Cancelar
                  </Button>
                  <Button variant="danger" size="sm" className="flex-1" loading={disputing} onClick={handleDispute}>
                    Abrir disputa
                  </Button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Un moderador revisará el caso. Los fondos quedan retenidos hasta resolver.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Worker card (all other states) ── */}
        {request.worker && !isFinishedPendingApproval && (
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0 overflow-hidden">
                {request.worker.user.avatarUrl
                  ? <img src={request.worker.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : `${request.worker.user.firstName[0]}${request.worker.user.lastName[0]}`}
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
              {eta !== null && ['ASSIGNED', 'EN_ROUTE'].includes(request.status) && (
                <div className="bg-orange-50 rounded-xl px-3 py-2 text-center">
                  <p className="text-xl font-bold text-orange-600 leading-none">{eta}</p>
                  <p className="text-xs text-orange-400">min</p>
                </div>
              )}
              {request.worker.user.phone && (
                <a href={`tel:${request.worker.user.phone}`}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Phone size={16} className="text-white" />
                </a>
              )}
            </div>

            {/* Progress steps */}
            <div className="mt-4 flex items-center gap-1">
              {PROGRESS_STEPS.map((step, i) => {
                const current = PROGRESS_STEPS.indexOf(request.status)
                const done = i <= current
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                        {i < current ? '✓' : i + 1}
                      </div>
                      <span className="text-xs text-gray-400 mt-1 text-center w-12 leading-tight">{PROGRESS_LABELS[i]}</span>
                    </div>
                    {i < PROGRESS_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mb-4 mx-0.5 ${i < current ? 'bg-primary' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SEARCHING: no worker yet */}
        {!request.worker && request.status === 'SEARCHING' && (
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
            <div className="text-3xl mb-2 animate-pulse">🔍</div>
            <p className="font-medium text-gray-700">Buscando el mejor profesional...</p>
            <p className="text-sm text-gray-500 mt-1">Te avisaremos en cuanto alguien acepte</p>
          </div>
        )}

        {/* COMPLETED */}
        {request.status === 'COMPLETED' && (
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
            <CheckCircle size={40} className="text-primary mx-auto mb-2" />
            <p className="font-bold text-gray-900 text-lg">¡Pago liberado!</p>
            <p className="text-sm text-gray-500 mt-1">Redirigiendo para calificar al profesional...</p>
            {price && <p className="text-2xl font-bold text-primary mt-3">$ {price.toLocaleString('es-AR')}</p>}
          </div>
        )}

        {/* DISPUTED */}
        {request.status === 'DISPUTED' && (
          <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={20} className="text-amber-600" />
              <p className="font-bold text-amber-800">Disputa en revisión</p>
            </div>
            <p className="text-sm text-amber-700">
              Un moderador está analizando el caso. Los fondos están retenidos hasta resolver. Te contactaremos pronto.
            </p>
          </div>
        )}

        {/* Cancel */}
        {canCancel && (
          <div className="px-4 mt-4">
            {!showCancelConfirm ? (
              <button onClick={() => setShowCancelConfirm(true)}
                className="w-full text-center text-sm text-gray-400 hover:text-red-500 transition-colors py-2">
                Cancelar pedido
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">¿Seguro? El pedido se cancelará y se procesará la devolución.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => setShowCancelConfirm(false)}>No, volver</Button>
                  <Button variant="danger" size="sm" className="flex-1" loading={cancelling} onClick={handleCancel}>Sí, cancelar</Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="h-24" />
      </div>

      {/* Floating chat */}
      {request.worker && socketRef.current && !isFinishedPendingApproval && (
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
