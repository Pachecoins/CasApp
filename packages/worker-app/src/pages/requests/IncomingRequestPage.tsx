import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MapPin, Clock, DollarSign, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { workerRequestsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'

interface IncomingRequest {
  id: string
  type: string
  description?: string
  address: string
  latitude: number
  longitude: number
  finalPrice?: number
  category: { name: string; basePrice: number }
  client: { user: { firstName: string; lastName: string } }
  distanceKm?: number
  estimatedArrivalMin?: number
}

const COUNTDOWN_SECONDS = 30

export function IncomingRequestPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const request = location.state?.request as IncomingRequest | undefined
  const expiresAt = location.state?.expiresAt as string | undefined

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [accepting, setAccepting] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  // Calcular countdown desde expiresAt
  useEffect(() => {
    if (!expiresAt) return

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining === 0) navigate('/dashboard')
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, navigate])

  // Fallback si no hay request (acceso directo a la URL)
  useEffect(() => {
    if (!request) navigate('/dashboard')
  }, [request, navigate])

  const handleAccept = useCallback(async () => {
    if (!request) return
    setAccepting(true)
    try {
      await workerRequestsService.accept(request.id)
      navigate(`/requests/${request.id}`, { replace: true })
    } catch {
      setAccepting(false)
      navigate('/dashboard')
    }
  }, [request, navigate])

  const handleReject = useCallback(async () => {
    if (!request) return
    setRejecting(true)
    try {
      await workerRequestsService.reject(request.id)
    } finally {
      navigate('/dashboard')
    }
  }, [request, navigate])

  if (!request) return null

  const typeLabels: Record<string, string> = {
    ON_DEMAND: 'ON DEMAND',
    SCHEDULED: 'PROGRAMADO',
    SUBSCRIPTION: 'SUSCRIPCIÓN',
  }

  const typeColors: Record<string, string> = {
    ON_DEMAND: 'bg-secondary text-white',
    SCHEDULED: 'bg-blue-500 text-white',
    SUBSCRIPTION: 'bg-primary text-white',
  }

  const urgency = countdown <= 10

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      {/* Overlay background with pulse */}
      <div className="absolute inset-0 bg-gray-900" />

      <div className="relative w-full max-w-sm">
        {/* Bell animation */}
        <div className="flex justify-center mb-4">
          <div className={`text-6xl ${urgency ? 'animate-bounce' : 'animate-pulse'}`}>🔔</div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gray-900 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs mb-1">Nuevo pedido</p>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-heading font-bold text-lg">
                  {request.category.name}
                </h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${typeColors[request.type] ?? 'bg-gray-600 text-white'}`}>
                  {typeLabels[request.type] ?? request.type}
                </span>
              </div>
            </div>

            {/* Countdown ring */}
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="#374151" strokeWidth="4" />
                <circle
                  cx="28" cy="28" r="24" fill="none"
                  stroke={urgency ? '#E07A5F' : '#2D6A4F'}
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - countdown / COUNTDOWN_SECONDS)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-base font-bold ${urgency ? 'text-secondary' : 'text-white'}`}>
                  {countdown}
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="px-5 py-4 space-y-3">
            {request.description && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-gray-700 italic">"{request.description}"</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                <MapPin size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Distancia</p>
                <p className="font-semibold text-gray-800">
                  {request.distanceKm ? `${request.distanceKm} km` : 'Cerca tuyo'}
                </p>
              </div>
              {request.estimatedArrivalMin && (
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-500">Tiempo estimado</p>
                  <div className="flex items-center gap-1 justify-end">
                    <Clock size={12} className="text-secondary" />
                    <p className="font-semibold text-secondary">~{request.estimatedArrivalMin} min</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <DollarSign size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Ganancia estimada</p>
                <p className="text-lg font-bold text-gray-900">
                  {request.finalPrice
                    ? formatPrice(request.finalPrice * 0.8) // 80% para el trabajador
                    : formatPrice(request.category.basePrice * 0.8)}
                </p>
              </div>
              <div className="ml-auto text-right text-xs text-gray-400">
                <p>Total: {formatPrice(request.finalPrice ?? request.category.basePrice)}</p>
                <p>CasApp: 20%</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary">
                {request.client.user.firstName[0]}{request.client.user.lastName[0]}
              </div>
              <p className="text-sm text-gray-600">
                {request.client.user.firstName} {request.client.user.lastName}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="w-full border-gray-300 text-gray-600"
              loading={rejecting}
              onClick={handleReject}
              disabled={accepting}
            >
              <X size={18} className="mr-2" />
              Rechazar
            </Button>
            <Button
              className="w-full"
              loading={accepting}
              onClick={handleAccept}
              disabled={rejecting || countdown === 0}
            >
              <Check size={18} className="mr-2" />
              Aceptar
            </Button>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-4">
          El pedido expira en {countdown} segundos
        </p>
      </div>
    </div>
  )
}
