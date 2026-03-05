import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, MapPin, RefreshCw, Calendar, Clock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { categoriesService, subscriptionsService } from '@/services/requests.service'
import { calculatePrice } from '@casapp/shared'
import { formatPrice } from '@/lib/utils'
import type { ServiceCategory } from '@casapp/shared'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00',
  '12:00', '14:00', '15:00', '16:00', '17:00', '18:00',
]

const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Semanal', discount: '25% off', multiplier: 0.75 },
  { value: 'BIWEEKLY', label: 'Quincenal', discount: '20% off', multiplier: 0.80 },
  { value: 'MONTHLY', label: 'Mensual', discount: '15% off', multiplier: 0.85 },
] as const

const schema = z.object({
  categoryId: z.string().min(1, 'Seleccioná un servicio'),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  dayOfWeek: z.number().int().min(0).max(6),
  timeSlot: z.string().min(1, 'Seleccioná un horario'),
  address: z.string().min(5, 'Ingresá una dirección'),
  preferSameWorker: z.boolean(),
})

type FormData = z.infer<typeof schema>

export function NewSubscriptionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedCategoryId = searchParams.get('categoryId') ?? ''

  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: service, 2: schedule, 3: confirm

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: preselectedCategoryId,
      frequency: 'WEEKLY',
      dayOfWeek: 1, // Monday
      timeSlot: '09:00',
      address: '',
      preferSameWorker: true,
    },
  })

  const watchedValues = watch()

  useEffect(() => {
    categoriesService.getAll().then(setCategories).catch(console.error)
  }, [])

  // Price preview
  const selectedCategory = categories.find((c) => c.id === watchedValues.categoryId)
  const pricePreview = selectedCategory
    ? calculatePrice({
        basePrice: selectedCategory.scheduledPrice,
        type: 'SUBSCRIPTION',
        frequency: watchedValues.frequency,
      })
    : null

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      // Get lat/lng from browser geolocation (fallback to Buenos Aires center)
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      }).catch(() => null)

      const latitude = position?.coords.latitude ?? -34.6037
      const longitude = position?.coords.longitude ?? -58.3816

      await subscriptionsService.create({
        ...data,
        latitude,
        longitude,
      })
      navigate('/subscriptions', { replace: true })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-gray-900">Nueva suscripción</h1>
          <p className="text-xs text-gray-500">Paso {step} de 3</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-1 bg-primary transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="px-4 pt-6 pb-36 space-y-5">
          {/* Step 1: Choose service */}
          {step === 1 && (
            <>
              <div>
                <h2 className="font-heading font-semibold text-gray-900 mb-1">¿Qué servicio necesitás?</h2>
                <p className="text-sm text-gray-500">Seleccioná el tipo de servicio a programar</p>
              </div>

              {categories.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {categories.filter((c) => c.isActive).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setValue('categoryId', cat.id)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        watchedValues.categoryId === cat.id
                          ? 'border-primary bg-primary-50'
                          : 'border-gray-100 bg-white'
                      }`}
                    >
                      <p className="font-semibold text-sm text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatPrice(cat.scheduledPrice)}/visita</p>
                    </button>
                  ))}
                </div>
              )}
              {errors.categoryId && (
                <p className="text-red-500 text-sm">{errors.categoryId.message}</p>
              )}

              {/* Frequency */}
              <div>
                <h3 className="font-medium text-gray-800 mb-3">¿Con qué frecuencia?</h3>
                <div className="space-y-2">
                  {FREQUENCIES.map((freq) => (
                    <button
                      key={freq.value}
                      type="button"
                      onClick={() => setValue('frequency', freq.value)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        watchedValues.frequency === freq.value
                          ? 'border-primary bg-primary-50'
                          : 'border-gray-100 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw
                          size={18}
                          className={watchedValues.frequency === freq.value ? 'text-primary' : 'text-gray-400'}
                        />
                        <span className="font-medium text-gray-900">{freq.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-primary bg-primary-50 border border-primary/20 px-2 py-1 rounded-full">
                        {freq.discount}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price preview */}
              {pricePreview && (
                <div className="bg-green-50 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary">Precio por visita</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {FREQUENCIES.find((f) => f.value === watchedValues.frequency)?.discount} vs. precio on-demand
                    </p>
                  </div>
                  <p className="text-2xl font-heading font-bold text-primary">
                    {formatPrice(pricePreview.total)}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Step 2: Schedule */}
          {step === 2 && (
            <>
              <div>
                <h2 className="font-heading font-semibold text-gray-900 mb-1">¿Cuándo te viene bien?</h2>
                <p className="text-sm text-gray-500">El servicio se repetirá automáticamente</p>
              </div>

              {/* Day of week */}
              <div>
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-primary" />
                  Día de la semana
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setValue('dayOfWeek', idx)}
                      className={`py-2.5 px-2 rounded-xl text-sm font-medium transition-all ${
                        watchedValues.dayOfWeek === idx
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white text-gray-600 border border-gray-100'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time slot */}
              <div>
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  Horario preferido
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setValue('timeSlot', time)}
                      className={`py-3 rounded-xl text-sm font-medium transition-all ${
                        watchedValues.timeSlot === time
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white text-gray-600 border border-gray-100'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-primary" />
                  Dirección del servicio
                </h3>
                <input
                  {...register('address')}
                  placeholder="Ej. Av. Corrientes 1234, CABA"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                />
                {errors.address && (
                  <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>
                )}
              </div>

              {/* Same worker preference */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">Preferir el mismo profesional</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Cuando esté disponible, te asignaremos al mismo profesional
                    </p>
                  </div>
                  <Controller
                    name="preferSameWorker"
                    control={control}
                    render={({ field }) => (
                      <button
                        type="button"
                        onClick={() => field.onChange(!field.value)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                          field.value ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                            field.value ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    )}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && selectedCategory && pricePreview && (
            <>
              <div>
                <h2 className="font-heading font-semibold text-gray-900 mb-1">Confirmá tu suscripción</h2>
                <p className="text-sm text-gray-500">Revisá los detalles antes de confirmar</p>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <DetailRow label="Servicio" value={selectedCategory.name} />
                <DetailRow
                  label="Frecuencia"
                  value={FREQUENCIES.find((f) => f.value === watchedValues.frequency)?.label ?? ''}
                />
                <DetailRow
                  label="Día y hora"
                  value={`${DAYS[watchedValues.dayOfWeek]} a las ${watchedValues.timeSlot}`}
                />
                <DetailRow label="Dirección" value={watchedValues.address} />
                <DetailRow
                  label="Mismo profesional"
                  value={watchedValues.preferSameWorker ? 'Sí, cuando esté disponible' : 'No'}
                />
              </div>

              <div className="bg-primary rounded-2xl p-4 text-white flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Precio por visita</p>
                  <p className="text-3xl font-heading font-bold">{formatPrice(pricePreview.total)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">Ahorrás</p>
                  <p className="font-semibold">
                    {formatPrice(pricePreview.basePrice - pricePreview.total < 0
                      ? 0
                      : pricePreview.basePrice - pricePreview.total)}
                  </p>
                  <p className="text-xs opacity-70">vs. on-demand</p>
                </div>
              </div>

              <div className="bg-green-50 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  Tu primer servicio se programará automáticamente. Podés cancelar en cualquier momento sin costo.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
          {step < 3 ? (
            <Button
              type="button"
              className="w-full"
              size="lg"
              onClick={() => {
                if (step === 1 && !watchedValues.categoryId) return
                setStep(step + 1)
              }}
              disabled={step === 1 && !watchedValues.categoryId}
            >
              Continuar →
            </Button>
          ) : (
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Confirmar suscripción
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}
