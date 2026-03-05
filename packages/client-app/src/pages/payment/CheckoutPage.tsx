import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Shield, Zap, Clock, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { requestsService, paymentsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'
import { calculatePrice, isNighttimeRequest } from '@casapp/shared'
import type { ServiceRequest } from '@casapp/shared'

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ON_DEMAND: { label: 'On-demand', icon: <Zap size={14} />, color: 'text-secondary' },
  SCHEDULED: { label: 'Programado', icon: <Clock size={14} />, color: 'text-blue-600' },
  SUBSCRIPTION: { label: 'Suscripción', icon: <RefreshCw size={14} />, color: 'text-primary' },
}

export function CheckoutPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()

  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!requestId) return
    requestsService
      .getById(requestId)
      .then(setRequest)
      .catch(() => navigate('/home'))
      .finally(() => setLoading(false))
  }, [requestId, navigate])

  const handlePay = async () => {
    if (!requestId) return
    setError(null)
    setProcessing(true)

    try {
      const result = await paymentsService.createPreference(requestId)

      if (result.isMock) {
        // Development mode: skip MP, auto-approve
        await paymentsService.mockApprove(requestId)
        navigate(`/requests/${requestId}/searching`)
        return
      }

      // Production: redirect to MercadoPago checkout
      window.location.href = result.initPoint
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error || 'Error al iniciar el pago')
    } finally {
      setProcessing(false)
    }
  }

  if (loading || !request) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const req = request as ServiceRequest & {
    category: { name: string; basePrice: number; scheduledPrice: number }
    finalPrice: number
    type: string
  }

  const basePrice = req.type === 'SCHEDULED' ? req.category.scheduledPrice : req.category.basePrice
  const breakdown = calculatePrice({
    basePrice,
    type: req.type as 'ON_DEMAND' | 'SCHEDULED' | 'SUBSCRIPTION',
    isNighttime: req.type === 'ON_DEMAND' ? isNighttimeRequest() : false,
  })

  const typeMeta = TYPE_LABELS[req.type] ?? TYPE_LABELS.ON_DEMAND
  const isNight = req.type === 'ON_DEMAND' && isNighttimeRequest()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-gray-900">Confirmar pedido</h1>
          <p className="text-xs text-gray-500">Revisá antes de pagar</p>
        </div>
      </div>

      <div className="px-4 pt-6 pb-36 space-y-4">
        {/* Service card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-heading font-semibold text-gray-900 text-lg">{req.category.name}</h2>
              <div className={`flex items-center gap-1 text-xs ${typeMeta.color} mt-0.5`}>
                {typeMeta.icon}
                <span>{typeMeta.label}</span>
                {isNight && (
                  <span className="ml-1 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    🌙 Nocturno
                  </span>
                )}
              </div>
            </div>
            <span className="text-2xl font-heading font-bold text-primary">
              {formatPrice(req.finalPrice ?? breakdown.total)}
            </span>
          </div>

          {req.address && (
            <div className="flex items-start gap-2 text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
              <span className="text-gray-400 mt-0.5">📍</span>
              <span>{req.address}</span>
            </div>
          )}

          {req.description && (
            <p className="text-sm text-gray-500 mt-2">{req.description}</p>
          )}
        </div>

        {/* Price breakdown */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-medium text-gray-800 mb-3">Detalle del precio</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Precio base</span>
              <span>{formatPrice(breakdown.basePrice)}</span>
            </div>
            {breakdown.modalityMultiplier !== 1 && (
              <div className="flex justify-between text-gray-600">
                <span>
                  {breakdown.modalityMultiplier > 1
                    ? `Recargo ${req.type === 'ON_DEMAND' ? 'on-demand' : ''} (×${breakdown.modalityMultiplier})`
                    : `Descuento suscripción (×${breakdown.modalityMultiplier})`}
                </span>
                <span className={breakdown.modalityMultiplier > 1 ? 'text-secondary' : 'text-primary'}>
                  {breakdown.modalityMultiplier > 1 ? '+' : ''}
                  {formatPrice(breakdown.basePrice * (breakdown.modalityMultiplier - 1))}
                </span>
              </div>
            )}
            {breakdown.nightSurcharge > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Recargo nocturno (+20%)</span>
                <span className="text-secondary">+{formatPrice(breakdown.nightSurcharge)}</span>
              </div>
            )}
            {breakdown.distanceSurcharge > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Recargo por distancia</span>
                <span>+{formatPrice(breakdown.distanceSurcharge)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500 text-xs">
              <span>Comisión de servicio (20%)</span>
              <span>{formatPrice(breakdown.platformCommission)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span className="text-primary text-lg">{formatPrice(req.finalPrice ?? breakdown.total)}</span>
            </div>
          </div>
        </div>

        {/* Trust signals */}
        <div className="bg-green-50 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Shield size={20} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary">Pago seguro con MercadoPago</p>
              <p className="text-xs text-green-700 mt-0.5">
                Tu información está protegida con encriptación SSL. Solo se cobra si encontramos un profesional.
              </p>
            </div>
          </div>
        </div>

        {/* Payment methods */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-medium text-gray-800 mb-3">Métodos de pago aceptados</h3>
          <div className="grid grid-cols-3 gap-2">
            {['Visa', 'Mastercard', 'Débito', 'Naranja X', 'Mercado Pago', 'Transferencia'].map((method) => (
              <div
                key={method}
                className="border border-gray-100 rounded-xl py-2 px-3 text-center text-xs text-gray-500"
              >
                {method}
              </div>
            ))}
          </div>
        </div>

        {/* Cancellation policy */}
        <button
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between text-left"
          onClick={() => {}}
        >
          <div>
            <p className="text-sm font-medium text-gray-800">Política de cancelación</p>
            <p className="text-xs text-gray-500 mt-0.5">Cancelación gratuita si no hay match en 10 min</p>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 space-y-3">
        <Button
          className="w-full"
          size="lg"
          loading={processing}
          onClick={handlePay}
        >
          <CreditCard size={18} className="mr-2" />
          Pagar {formatPrice(req.finalPrice ?? breakdown.total)} con MercadoPago
        </Button>
        <p className="text-center text-xs text-gray-400">
          Al continuar, aceptás los{' '}
          <span className="underline">Términos y Condiciones</span> de CasApp
        </p>
      </div>
    </div>
  )
}
