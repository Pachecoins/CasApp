import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, MapPin, Camera, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { categoriesService, requestsService } from '@/services/requests.service'
import { useAuthStore } from '@/store/auth.store'
import { formatPrice } from '@/lib/utils'
import { calculatePrice, isNighttimeRequest } from '@casapp/shared'
import type { ServiceCategory, ServiceType, SubscriptionFrequency } from '@casapp/shared'

const baseSchema = z.object({
  address: z.string().min(5, 'Ingresá una dirección válida'),
  description: z.string().optional(),
})

const scheduledSchema = baseSchema.extend({
  scheduledAt: z.string().min(1, 'Seleccioná fecha y hora'),
})

const subscriptionSchema = baseSchema.extend({
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  dayOfWeek: z.coerce.number().min(0).max(6),
  timeSlot: z.string().min(1, 'Seleccioná un horario'),
  preferSameWorker: z.boolean().default(true),
})

type OnDemandForm = z.infer<typeof baseSchema>
type ScheduledForm = z.infer<typeof scheduledSchema>
type SubscriptionForm = z.infer<typeof subscriptionSchema>

const TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ON_DEMAND: { label: 'Ahora — On-demand', color: 'text-secondary', icon: <Clock size={16} /> },
  SCHEDULED: { label: 'Programado', color: 'text-blue-600', icon: null },
  SUBSCRIPTION: { label: 'Suscripción', color: 'text-primary', icon: <RefreshCw size={16} /> },
}

const FREQUENCY_OPTIONS = [
  { value: 'WEEKLY', label: 'Semanal', discount: '-25%' },
  { value: 'BIWEEKLY', label: 'Quincenal', discount: '-20%' },
  { value: 'MONTHLY', label: 'Mensual', discount: '-15%' },
]

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00']

export function ConfigureRequestPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const type = (searchParams.get('type') ?? 'ON_DEMAND') as ServiceType
  const [category, setCategory] = useState<ServiceCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [frequency, setFrequency] = useState<SubscriptionFrequency>('WEEKLY')
  const [selectedDay, setSelectedDay] = useState(1)
  const [timeSlot, setTimeSlot] = useState('10:00')
  const [preferSameWorker, setPreferSameWorker] = useState(true)

  const schema =
    type === 'SCHEDULED'
      ? scheduledSchema
      : type === 'SUBSCRIPTION'
        ? subscriptionSchema
        : baseSchema

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      address: '',
      description: '',
      frequency: 'WEEKLY' as SubscriptionFrequency,
      dayOfWeek: 1,
      timeSlot: '10:00',
      preferSameWorker: true,
    },
  })

  useEffect(() => {
    if (!slug) return
    categoriesService
      .getBySlug(slug)
      .then(setCategory)
      .catch(() => navigate('/home'))
      .finally(() => setLoading(false))
  }, [slug, navigate])

  const basePrice = category
    ? type === 'SCHEDULED'
      ? category.scheduledPrice
      : category.basePrice
    : 0

  const priceBreakdown = category
    ? calculatePrice({
        basePrice,
        type,
        frequency: type === 'SUBSCRIPTION' ? frequency : undefined,
        isNighttime: type === 'ON_DEMAND' ? isNighttimeRequest() : false,
      })
    : null

  const onSubmit = async (data: OnDemandForm | ScheduledForm | SubscriptionForm) => {
    if (!category) return
    setError(null)
    setSubmitting(true)

    try {
      // En MVP usamos ubicación por defecto de Buenos Aires si no hay geolocalización
      // En producción se usaría la API de Maps para geocodificar la dirección
      let lat = -34.6037
      let lng = -58.3816

      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 }),
          )
          lat = pos.coords.latitude
          lng = pos.coords.longitude
        } catch {
          // usar coordenadas por defecto
        }
      }

      if (type === 'ON_DEMAND' || type === 'SCHEDULED') {
        const request = await requestsService.create({
          categoryId: category.id,
          type,
          address: data.address,
          latitude: lat,
          longitude: lng,
          description: data.description,
          scheduledAt: (data as ScheduledForm).scheduledAt,
        })

        if (type === 'ON_DEMAND') {
          navigate(`/requests/${request.id}/searching`)
        } else {
          navigate(`/requests/${request.id}/confirmed`)
        }
      } else {
        // Subscription — navegamos a la página de confirmación con los datos
        navigate('/subscriptions/new/confirm', {
          state: {
            categoryId: category.id,
            categoryName: category.name,
            address: data.address,
            latitude: lat,
            longitude: lng,
            description: data.description,
            frequency,
            dayOfWeek: selectedDay,
            timeSlot,
            preferSameWorker,
            pricePerVisit: priceBreakdown?.total ?? 0,
          },
        })
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr?.response?.data?.error || 'Error al crear el pedido')
    } finally {
      setSubmitting(false)
    }
  }

  const meta = TYPE_LABELS[type]

  if (loading || !category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-gray-900">{category.name}</h1>
          <div className={`flex items-center gap-1 text-xs ${meta.color}`}>
            {meta.icon}
            <span>{meta.label}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit as never)} className="px-4 pt-6 pb-32 space-y-5">
        {/* Address */}
        <div className="relative">
          <Input
            label="Dirección del servicio"
            placeholder="Av. Corrientes 1234, CABA"
            error={(errors as { address?: { message?: string } }).address?.message}
            {...register('address')}
          />
          <MapPin size={16} className="absolute right-3 top-[38px] text-gray-400" />
        </div>

        {/* Scheduled: date + time picker */}
        {type === 'SCHEDULED' && (
          <Input
            label="Fecha y hora"
            type="datetime-local"
            error={(errors as { scheduledAt?: { message?: string } }).scheduledAt?.message}
            min={new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)}
            {...register('scheduledAt')}
          />
        )}

        {/* Subscription options */}
        {type === 'SUBSCRIPTION' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Frecuencia</label>
              <div className="grid grid-cols-3 gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFrequency(opt.value as SubscriptionFrequency)}
                    className={`py-3 px-2 rounded-xl border-2 text-center transition-all ${
                      frequency === opt.value
                        ? 'border-primary bg-primary-50 text-primary'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-xs opacity-70">{opt.discount}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Día preferido</label>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {DAY_NAMES.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDay(i)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all ${
                      selectedDay === i
                        ? 'border-primary bg-primary-50 text-primary'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Horario preferido</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTimeSlot(slot)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all ${
                      timeSlot === slot
                        ? 'border-primary bg-primary-50 text-primary'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div>
                <p className="font-medium text-sm text-gray-800">Siempre el mismo profesional</p>
                <p className="text-xs text-gray-500">Si está disponible esa fecha</p>
              </div>
              <button
                type="button"
                onClick={() => setPreferSameWorker(!preferSameWorker)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  preferSameWorker ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    preferSameWorker ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Descripción del trabajo{' '}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            rows={3}
            placeholder={`¿Qué necesitás exactamente? Ej: "Cortar el pasto del jardín delantero, aproximadamente 50m²"`}
            {...register('description')}
          />
        </div>

        {/* Photos placeholder */}
        <button
          type="button"
          className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-4 flex items-center gap-3 text-gray-400 hover:border-primary hover:text-primary transition-colors"
        >
          <Camera size={20} />
          <span className="text-sm">Agregar fotos del trabajo (opcional)</span>
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </form>

      {/* Bottom fixed: price + CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        {priceBreakdown && (
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500">Precio estimado</p>
              <p className="text-xl font-heading font-bold text-gray-900">
                {formatPrice(priceBreakdown.total)}
              </p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <div>Base: {formatPrice(priceBreakdown.basePrice)}</div>
              {priceBreakdown.nightSurcharge > 0 && (
                <div className="text-secondary">+Nocturno: {formatPrice(priceBreakdown.nightSurcharge)}</div>
              )}
              <div>Comisión: {formatPrice(priceBreakdown.platformCommission)}</div>
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={submitting}
          onClick={handleSubmit(onSubmit as never)}
        >
          {type === 'ON_DEMAND' && '⚡ Buscar profesional ahora'}
          {type === 'SCHEDULED' && '📅 Confirmar programación'}
          {type === 'SUBSCRIPTION' && '🔄 Ver resumen de suscripción'}
        </Button>
      </div>
    </div>
  )
}
