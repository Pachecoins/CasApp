import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { paymentsService } from '@/services/requests.service'

type PaymentStatus = 'approved' | 'rejected' | 'pending' | 'loading'

const STATUS_CONFIG: Record<
  Exclude<PaymentStatus, 'loading'>,
  { icon: React.ReactNode; title: string; subtitle: string; color: string; bg: string }
> = {
  approved: {
    icon: <CheckCircle size={64} />,
    title: '¡Pago exitoso!',
    subtitle: 'Estamos buscando el profesional más cercano para tu pedido.',
    color: 'text-primary',
    bg: 'bg-primary-50',
  },
  rejected: {
    icon: <XCircle size={64} />,
    title: 'Pago rechazado',
    subtitle: 'No pudimos procesar tu pago. Podés intentarlo de nuevo con otro método.',
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  pending: {
    icon: <Clock size={64} />,
    title: 'Pago en proceso',
    subtitle: 'Tu pago está siendo verificado. Te notificaremos cuando sea confirmado.',
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
  },
}

export function PaymentResultPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const requestId = searchParams.get('requestId') ?? ''
  const statusParam = (searchParams.get('status') as PaymentStatus) ?? 'pending'
  const isMock = searchParams.get('mock') === '1'

  const [status, setStatus] = useState<PaymentStatus>(isMock ? 'loading' : statusParam)
  const [countdown, setCountdown] = useState(4)

  // For mock mode: auto-approve then redirect
  useEffect(() => {
    if (!isMock || !requestId) return

    paymentsService
      .mockApprove(requestId)
      .then(() => setStatus('approved'))
      .catch(() => setStatus('rejected'))
  }, [isMock, requestId])

  // Auto-redirect to searching on approved
  useEffect(() => {
    if (status !== 'approved') return

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          navigate(`/requests/${requestId}/searching`)
        }
        return c - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [status, requestId, navigate])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 size={48} className="text-primary animate-spin" />
        <p className="text-gray-600 font-medium">Confirmando pago...</p>
      </div>
    )
  }

  const config = STATUS_CONFIG[status as Exclude<PaymentStatus, 'loading'>]

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      {/* Icon */}
      <div className={`${config.bg} rounded-full p-8 mb-6 ${config.color}`}>{config.icon}</div>

      {/* Title */}
      <h1 className="font-heading font-bold text-2xl text-gray-900 mb-2">{config.title}</h1>
      <p className="text-gray-500 text-sm max-w-xs leading-relaxed">{config.subtitle}</p>

      {/* Countdown for approved */}
      {status === 'approved' && (
        <div className="mt-8 bg-primary-50 rounded-2xl px-6 py-4">
          <p className="text-primary text-sm font-medium">
            Buscando profesional en <span className="font-bold text-lg">{countdown}</span>s...
          </p>
          <div className="mt-2 w-full bg-primary-200 rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 w-full space-y-3">
        {status === 'approved' && (
          <Button className="w-full" size="lg" onClick={() => navigate(`/requests/${requestId}/searching`)}>
            Ir al seguimiento →
          </Button>
        )}

        {status === 'rejected' && (
          <>
            <Button className="w-full" size="lg" onClick={() => navigate(`/requests/${requestId}/checkout`)}>
              Intentar de nuevo
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => navigate('/home')}
            >
              Volver al inicio
            </Button>
          </>
        )}

        {status === 'pending' && (
          <>
            <p className="text-sm text-gray-500">
              Una vez confirmado el pago, comenzaremos a buscar tu profesional automáticamente.
            </p>
            <Button className="w-full" size="lg" onClick={() => navigate('/home')}>
              Volver al inicio
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
