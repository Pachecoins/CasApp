import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, MapPin, Clock, Calendar, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { requestsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'

export function RequestConfirmedPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const [request, setRequest] = useState<{
    id: string
    type: string
    status: string
    address: string
    scheduledAt?: string
    finalPrice?: number
    category: { name: string }
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!requestId) return
    requestsService
      .getById(requestId)
      .then(setRequest)
      .catch(() => navigate('/home'))
      .finally(() => setLoading(false))
  }, [requestId, navigate])

  if (loading || !request) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => navigate('/home')} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-heading font-bold text-gray-900">Pedido confirmado</h1>
      </div>

      <div className="flex-1 px-4 pt-8 pb-8 flex flex-col items-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mb-4">
          <CheckCircle size={40} className="text-primary" />
        </div>

        <h2 className="text-2xl font-heading font-bold text-gray-900 mb-1 text-center">
          ¡Pedido programado!
        </h2>
        <p className="text-gray-500 text-center mb-8">
          Te asignaremos el mejor profesional disponible
        </p>

        {/* Details card */}
        <div className="w-full card space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Servicio</p>
              <p className="font-medium text-gray-800">{request.category.name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Dirección</p>
              <p className="font-medium text-gray-800">{request.address}</p>
            </div>
          </div>

          {request.scheduledAt && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/30 flex items-center justify-center flex-shrink-0">
                <Calendar size={16} className="text-amber-700" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Fecha y hora</p>
                <p className="font-medium text-gray-800">
                  {new Date(request.scheduledAt).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )}

          {request.finalPrice && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">💰</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Precio estimado</p>
                <p className="font-bold text-gray-800 text-lg">{formatPrice(request.finalPrice)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-full space-y-3">
          <Button
            className="w-full"
            onClick={() => navigate(`/requests/${requestId}/tracking`)}
          >
            Ver estado del pedido
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/home')}
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  )
}
