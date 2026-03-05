import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, MessageSquare, Navigation, CheckCircle, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { workerRequestsService } from '@/services/requests.service'
import { useAuthStore } from '@/store/auth.store'
import { formatPrice } from '@/lib/utils'
import { io, type Socket } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface JobRequest {
  id: string
  type: string
  status: string
  address: string
  latitude: number
  longitude: number
  finalPrice?: number
  description?: string
  scheduledAt?: string
  category: { name: string }
  client: {
    userId: string
    user: { firstName: string; lastName: string; phone?: string; avatarUrl?: string }
  }
}

const STATUS_STEPS = ['MATCHED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED']
const STATUS_LABELS: Record<string, string> = {
  MATCHED: 'Pedido aceptado',
  CONFIRMED: 'En camino',
  IN_PROGRESS: 'Trabajando',
  COMPLETED: 'Completado',
}

export function JobDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [job, setJob] = useState<JobRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const socketRef = useRef<Socket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!requestId) return
    workerRequestsService
      .getById(requestId)
      .then(setJob)
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false))
  }, [requestId, navigate])

  useEffect(() => {
    if (!requestId || !user) return

    const socket = io(API_URL)
    socketRef.current = socket
    socket.emit('identify', { userId: user.id, role: 'WORKER' })
    socket.emit('join-request-room', requestId)

    return () => { socket.disconnect() }
  }, [requestId, user])

  // GPS tracking while IN_PROGRESS
  useEffect(() => {
    if (job?.status !== 'IN_PROGRESS') return
    if (timerRef.current) return

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)

    const watchId = 'geolocation' in navigator
      ? navigator.geolocation.watchPosition((pos) => {
          socketRef.current?.emit('worker:location-update', {
            workerId: user?.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            requestId,
          })
          workerRequestsService
            .updateLocation(pos.coords.latitude, pos.coords.longitude)
            .catch(() => {})
        })
      : null

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [job?.status, requestId, user?.id])

  const advanceStatus = async () => {
    if (!job) return
    const next: Record<string, string> = {
      MATCHED: 'CONFIRMED',
      CONFIRMED: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
    }
    const newStatus = next[job.status]
    if (!newStatus) return

    setUpdating(true)
    try {
      const updated = await workerRequestsService.updateStatus(job.id, newStatus)
      setJob(updated)
      if (newStatus === 'COMPLETED') {
        setTimeout(() => navigate('/dashboard'), 2000)
      }
    } finally {
      setUpdating(false)
    }
  }

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const openNavigation = () => {
    if (!job) return
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`,
      '_blank',
    )
  }

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const currentStep = STATUS_STEPS.indexOf(job.status)
  const isCompleted = job.status === 'COMPLETED'

  const ctaLabels: Record<string, string> = {
    MATCHED: '🚗 Confirmar que voy en camino',
    CONFIRMED: '📍 Llegué al domicilio',
    IN_PROGRESS: '✅ Trabajo finalizado',
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-gray-900">{job.category.name}</h1>
          <p className="text-xs text-gray-500">{STATUS_LABELS[job.status] ?? job.status}</p>
        </div>
        {job.status === 'IN_PROGRESS' && (
          <div className="ml-auto bg-secondary text-white text-sm font-bold px-3 py-1 rounded-full">
            ⏱ {formatElapsed(elapsed)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white px-4 py-4 border-b border-gray-100">
        <div className="flex items-center">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i <= currentStep ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {i < currentStep ? '✓' : i + 1}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-1 rounded-full ${i < currentStep ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          {STATUS_STEPS.map((step) => (
            <span key={step} className="text-xs text-gray-400 text-center flex-1">
              {STATUS_LABELS[step]}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Client card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-base font-bold text-primary">
              {job.client.user.firstName[0]}{job.client.user.lastName[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {job.client.user.firstName} {job.client.user.lastName}
              </p>
              <p className="text-xs text-gray-500">Cliente</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {job.client.user.phone && (
              <a
                href={`tel:${job.client.user.phone}`}
                className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5"
              >
                <Phone size={16} className="text-primary" />
                <span className="text-sm font-medium text-gray-700">Llamar</span>
              </a>
            )}
            <button className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
              <MessageSquare size={16} className="text-primary" />
              <span className="text-sm font-medium text-gray-700">Chat</span>
            </button>
          </div>
        </div>

        {/* Address + navigate */}
        <div className="card">
          <div className="flex items-start gap-3 mb-3">
            <MapPin size={18} className="text-secondary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Dirección del servicio</p>
              <p className="font-medium text-gray-800">{job.address}</p>
            </div>
          </div>
          <button
            onClick={openNavigation}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-2.5 font-medium text-sm"
          >
            <Navigation size={16} />
            Abrir en Google Maps
          </button>
        </div>

        {/* Description */}
        {job.description && (
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Descripción del trabajo</p>
            <p className="text-sm text-gray-700">{job.description}</p>
          </div>
        )}

        {/* Price */}
        {job.finalPrice && (
          <div className="card flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Tu ganancia</p>
              <p className="text-xl font-bold text-primary">{formatPrice(job.finalPrice * 0.8)}</p>
            </div>
            <div className="text-right text-sm text-gray-400">
              <p>Total: {formatPrice(job.finalPrice)}</p>
              <p>CasApp: {formatPrice(job.finalPrice * 0.2)}</p>
            </div>
          </div>
        )}

        {/* Completed */}
        {isCompleted && (
          <div className="card text-center py-6">
            <CheckCircle size={48} className="text-primary mx-auto mb-3" />
            <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">¡Trabajo completado!</h3>
            <p className="text-gray-500 text-sm">El pago será acreditado pronto</p>
          </div>
        )}
      </div>

      {/* CTA fixed bottom */}
      {!isCompleted && ctaLabels[job.status] && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
          <Button
            className="w-full"
            size="lg"
            loading={updating}
            onClick={advanceStatus}
          >
            {job.status === 'IN_PROGRESS' ? (
              <><CheckCircle size={18} className="mr-2" /> {ctaLabels[job.status]}</>
            ) : (
              <><PlayCircle size={18} className="mr-2" /> {ctaLabels[job.status]}</>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
