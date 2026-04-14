import { useEffect, useState, useRef, useCallback, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Phone, MessageSquare, Navigation, CheckCircle, PlayCircle, MapPin } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { Button } from '@/components/ui/Button'
import { RouteMap } from '@/components/map/RouteMap'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { workerRequestsService } from '@/services/requests.service'
import { useAuthStore } from '@/store/auth.store'
import { formatPrice } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface JobRequest {
  id: string
  status: string
  address: string
  latitude: number
  longitude: number
  quotedPrice?: number
  description?: string
  scheduledAt?: string
  category: { name: string }
  client: {
    userId: string
    user: { firstName: string; lastName: string; phone?: string; avatarUrl?: string }
  }
}

// Updated state machine names to match TUKI OrderStatus
const STATUS_STEPS = ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'FINISHED_PENDING_APPROVAL', 'COMPLETED']
const STATUS_LABELS: Record<string, string> = {
  ASSIGNED:                  'Aceptado',
  EN_ROUTE:                  'En camino',
  IN_PROGRESS:               'Trabajando',
  FINISHED_PENDING_APPROVAL: 'Esperando aprobación del cliente',
  COMPLETED:                 'Completado',
}
const CTA: Record<string, string> = {
  ASSIGNED:    '🚗 Salir en camino',
  EN_ROUTE:    '📍 Llegué al domicilio',
  IN_PROGRESS: '📸 Finalizar y subir foto del trabajo',
}

type TabId = 'info' | 'map' | 'chat'

export function JobDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [job, setJob] = useState<JobRequest | null>(null)
  const [workerPos, setWorkerPos] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [activeTab, setActiveTab] = useState<TabId>('info')
  const socketRef = useRef<Socket | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!requestId) return
    workerRequestsService
      .getById(requestId)
      .then(setJob)
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false))
  }, [requestId, navigate])

  // Socket setup
  useEffect(() => {
    if (!requestId || !user) return
    const socket = io(API_URL)
    socketRef.current = socket
    socket.emit('identify', { userId: user.id, role: 'WORKER' })
    socket.emit('join-request-room', requestId)
    return () => { socket.disconnect() }
  }, [requestId, user])

  // GPS tracking — active when CONFIRMED or IN_PROGRESS
  useEffect(() => {
    if (!job || !['EN_ROUTE', 'IN_PROGRESS'].includes(job.status)) return
    if (!('geolocation' in navigator)) return

    // Start elapsed timer for IN_PROGRESS
    if (['IN_PROGRESS', 'EN_ROUTE'].includes(job.status) && !timerRef.current) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setWorkerPos({ lat: latitude, lng: longitude })

        // Emit to Socket.io room so client sees live movement
        socketRef.current?.emit('worker:location-update', {
          workerId: user?.id,
          lat: latitude,
          lng: longitude,
          requestId,
        })

        // Persist to DB every ~10s via API (debounced by geolocation accuracy)
        workerRequestsService.updateLocation(latitude, longitude).catch(() => {})
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    )

    watchIdRef.current = watchId

    return () => {
      navigator.geolocation.clearWatch(watchId)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [job?.status, requestId, user?.id])

  // ── Completion photo state ────────────────────────────────────────────────
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [completionPhotoB64, setCompletionPhotoB64] = useState<string | null>(null)
  const [completionPreview, setCompletionPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCompletionPhotoB64(reader.result as string)
      setCompletionPreview(URL.createObjectURL(file))
    }
    reader.readAsDataURL(file)
  }

  const submitCompletion = async () => {
    if (!job || !completionPhotoB64) return
    setUpdating(true)
    try {
      const updated = await workerRequestsService.updateStatus(
        job.id,
        'FINISHED_PENDING_APPROVAL',
        completionPhotoB64,
      )
      setJob(updated)
      setShowPhotoModal(false)
    } finally {
      setUpdating(false)
    }
  }

  const advanceStatus = useCallback(async () => {
    if (!job) return
    const next: Record<string, string> = {
      ASSIGNED:    'EN_ROUTE',
      EN_ROUTE:    'IN_PROGRESS',
      // IN_PROGRESS requires photo — handled by photo modal below
    }
    if (job.status === 'IN_PROGRESS') {
      setShowPhotoModal(true)
      return
    }
    const newStatus = next[job.status]
    if (!newStatus) return

    setUpdating(true)
    try {
      const updated = await workerRequestsService.updateStatus(job.id, newStatus)
      setJob(updated)
    } finally {
      setUpdating(false)
    }
  }, [job])

  const openNavigation = () => {
    if (!job) return
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`,
      '_blank',
    )
  }

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const currentStep = STATUS_STEPS.indexOf(job.status)
  const isCompleted = job.status === 'COMPLETED' || job.status === 'FINISHED_PENDING_APPROVAL'
  const showMap = (workerPos && ['EN_ROUTE', 'IN_PROGRESS'].includes(job.status))

  const tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'map', label: 'Mapa' },
    { id: 'chat', label: 'Chat' },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-gray-900">{job.category.name}</h1>
            <p className="text-xs text-gray-500">{STATUS_LABELS[job.status] ?? job.status}</p>
          </div>
          {job.status === 'IN_PROGRESS' && (
            <div className="bg-secondary text-white text-sm font-bold px-3 py-1 rounded-full">
              ⏱ {formatElapsed(elapsed)}
            </div>
          )}
          {job.status === 'FINISHED_PENDING_APPROVAL' && (
            <div className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
              Esperando cliente
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i <= currentStep ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded-full ${i < currentStep ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex mt-3 gap-1 bg-gray-100 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pb-28">
        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="px-4 pt-4 space-y-3">
            {/* Client */}
            <div className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary">
                  {job.client.user.firstName[0]}{job.client.user.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold">{job.client.user.firstName} {job.client.user.lastName}</p>
                  <p className="text-xs text-gray-500">Cliente</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {job.client.user.phone && (
                  <a href={`tel:${job.client.user.phone}`} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                    <Phone size={16} className="text-primary" />
                    <span className="text-sm font-medium">Llamar</span>
                  </a>
                )}
                <button onClick={() => setActiveTab('chat')} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <MessageSquare size={16} className="text-primary" />
                  <span className="text-sm font-medium">Chat</span>
                </button>
              </div>
            </div>

            {/* Address */}
            <div className="card">
              <div className="flex items-start gap-3 mb-3">
                <MapPin size={18} className="text-secondary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Dirección</p>
                  <p className="font-medium text-gray-800">{job.address}</p>
                </div>
              </div>
              <button onClick={openNavigation} className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-2.5 text-sm font-medium">
                <Navigation size={16} />
                Abrir en Google Maps
              </button>
            </div>

            {job.description && (
              <div className="card">
                <p className="text-xs text-gray-500 mb-1">Descripción</p>
                <p className="text-sm text-gray-700">{job.description}</p>
              </div>
            )}

            {job.quotedPrice && (
              <div className="card flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Tu ganancia</p>
                  <p className="text-xl font-bold text-primary">{formatPrice(Math.round(job.quotedPrice / 1.15))}</p>
                </div>
                <div className="text-right text-sm text-gray-400">
                  <p>Total: {formatPrice(job.quotedPrice)}</p>
                  <p>TUKI: {formatPrice(job.quotedPrice - Math.round(job.quotedPrice / 1.15))}</p>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="card text-center py-6">
                <CheckCircle size={48} className="text-primary mx-auto mb-3" />
                <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">¡Trabajo completado!</h3>
                <p className="text-gray-500 text-sm">El pago será acreditado en breve</p>
              </div>
            )}
          </div>
        )}

        {/* MAP TAB */}
        {activeTab === 'map' && (
          <div className="h-full" style={{ minHeight: 'calc(100vh - 220px)' }}>
            {showMap ? (
              <RouteMap
                workerLat={workerPos!.lat}
                workerLng={workerPos!.lng}
                clientLat={job.latitude}
                clientLng={job.longitude}
                className="w-full h-full"
                style={{ minHeight: 'calc(100vh - 220px)' } as React.CSSProperties}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
                <div className="text-4xl mb-3">📍</div>
                <p className="font-medium text-gray-700 mb-1">
                  El mapa se activará cuando estés en camino
                </p>
                <p className="text-sm text-gray-500">Se requiere permiso de ubicación</p>
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <ChatPanel
            socket={socketRef.current}
            requestId={job.id}
            currentUserId={user?.id ?? ''}
            currentUserName={`${user?.firstName} ${user?.lastName}`}
            className="h-full flex-col"
            style={{ minHeight: 'calc(100vh - 220px)' } as React.CSSProperties}
          />
        )}
      </div>

      {/* CTA bottom */}
      {!isCompleted && CTA[job.status] && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
          <Button className="w-full" size="lg" loading={updating} onClick={advanceStatus}>
            {job.status === 'IN_PROGRESS'
              ? <><CheckCircle size={18} className="mr-2" />{CTA[job.status]}</>
              : <><PlayCircle size={18} className="mr-2" />{CTA[job.status]}</>}
          </Button>
        </div>
      )}

      {/* "Trabajo finalizado" badge when waiting for client approval */}
      {job.status === 'FINISHED_PENDING_APPROVAL' && (
        <div className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 px-4 py-4">
          <div className="text-center">
            <p className="font-bold text-amber-800">⏳ Esperando aprobación del cliente</p>
            <p className="text-xs text-amber-600 mt-1">
              El cliente tiene 24 hs para liberar el pago. Si no responde, se libera automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* Completion photo modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 text-center">📸 Foto del trabajo terminado</h3>
            <p className="text-sm text-gray-500 text-center">
              Esta foto es obligatoria. El cliente la verá para aprobar el pago.
            </p>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoFile}
            />

            {completionPreview ? (
              <div className="space-y-2">
                <img src={completionPreview} alt="Foto del trabajo" className="w-full h-48 object-cover rounded-xl" />
                <button
                  className="w-full text-sm text-gray-500 underline"
                  onClick={() => { setCompletionPhotoB64(null); setCompletionPreview(null) }}
                >
                  Sacar otra foto
                </button>
              </div>
            ) : (
              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-10 flex flex-col items-center gap-2 text-gray-400"
              >
                <CheckCircle size={32} />
                <span className="text-sm font-medium">Tocar para abrir la cámara</span>
              </button>
            )}

            <Button
              className="w-full"
              size="lg"
              loading={updating}
              onClick={submitCompletion}
            >
              {completionPhotoB64 ? '✅ Confirmar finalización' : 'Primero sacá la foto'}
            </Button>

            <button
              className="w-full text-sm text-gray-400 pb-2"
              onClick={() => setShowPhotoModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
