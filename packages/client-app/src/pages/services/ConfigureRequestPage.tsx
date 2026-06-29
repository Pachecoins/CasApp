import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Camera, ChevronDown, ChevronUp, Clock, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { categoriesService, requestsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'
import { calculateQuote } from '@tuki/shared'
import type { EquipmentTier, LotSize, ServiceCategory, SubscriptionFrequency } from '@tuki/shared'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ServiceType = 'ON_DEMAND' | 'SCHEDULED' | 'SUBSCRIPTION'

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

type ScheduledForm = z.infer<typeof scheduledSchema>

// ─── Constants ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ServiceType, { label: string; color: string; icon: React.ReactNode }> = {
  ON_DEMAND:    { label: 'Ahora — On-demand', color: 'text-secondary', icon: <Clock size={16} /> },
  SCHEDULED:    { label: 'Programado',         color: 'text-blue-600', icon: null },
  SUBSCRIPTION: { label: 'Suscripción',         color: 'text-primary',  icon: <RefreshCw size={16} /> },
}

const LOT_SIZES: { value: LotSize; label: string; sublabel: string; emoji: string }[] = [
  { value: 'SMALL',  label: 'Chico',   sublabel: 'hasta 100 m²',    emoji: '🌱' },
  { value: 'MEDIUM', label: 'Mediano', sublabel: '100 – 300 m²',    emoji: '🌳' },
  { value: 'LARGE',  label: 'Grande',  sublabel: 'más de 300 m²',   emoji: '🏡' },
]

const FREQUENCY_OPTIONS = [
  { value: 'WEEKLY',   label: 'Semanal',   discount: '–25%' },
  { value: 'BIWEEKLY', label: 'Quincenal', discount: '–20%' },
  { value: 'MONTHLY',  label: 'Mensual',   discount: '–15%' },
]

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00']

// ─── Component ─────────────────────────────────────────────────────────────────

export function ConfigureRequestPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const type = (searchParams.get('type') ?? 'ON_DEMAND') as ServiceType

  // Remote data
  const [category, setCategory] = useState<ServiceCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Quoter state ──────────────────────────────────────────────────────────────
  const [lotSize, setLotSize]             = useState<LotSize>('SMALL')
  const [lotAreaM2, setLotAreaM2]         = useState<string>('')
  const [showM2Input, setShowM2Input]     = useState(false)
  const [equipmentTier, setEquipmentTier] = useState<EquipmentTier>('STANDARD')
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])

  // ── Subscription state ────────────────────────────────────────────────────────
  const [frequency, setFrequency]           = useState<SubscriptionFrequency>('WEEKLY')
  const [selectedDay, setSelectedDay]       = useState(1)
  const [timeSlot, setTimeSlot]             = useState('10:00')
  const [preferSameWorker, setPreferSameWorker] = useState(true)

  // ── Form ──────────────────────────────────────────────────────────────────────
  const schema =
    type === 'SCHEDULED'    ? scheduledSchema    :
    type === 'SUBSCRIPTION' ? subscriptionSchema :
    baseSchema

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { address: '', description: '', frequency: 'WEEKLY', dayOfWeek: 1, timeSlot: '10:00', preferSameWorker: true },
  })

  // ── Data load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return
    categoriesService
      .getBySlug(slug)
      .then(setCategory)
      .catch(() => navigate('/home'))
      .finally(() => setLoading(false))
  }, [slug, navigate])

  // ── Real-time quote ───────────────────────────────────────────────────────────
  const quote = useMemo(() => {
    if (!category) return null
    const parsedM2 = lotAreaM2 ? parseInt(lotAreaM2, 10) : undefined
    return calculateQuote(category, {
      lotSize,
      lotAreaM2: parsedM2 && parsedM2 > 0 ? parsedM2 : undefined,
      selectedAddons,
      equipmentTier,
    })
  }, [category, lotSize, lotAreaM2, selectedAddons, equipmentTier])

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const toggleAddon = (key: string) =>
    setSelectedAddons((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])

  const getGeo = async (): Promise<{ lat: number; lng: number }> => {
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 }),
        )
        return { lat: pos.coords.latitude, lng: pos.coords.longitude }
      } catch { /* fall through */ }
    }
    return { lat: -34.6037, lng: -58.3816 }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  const onSubmit = async (data: Record<string, unknown>) => {
    if (!category || !quote) return
    setError(null)
    setSubmitting(true)

    try {
      const { lat, lng } = await getGeo()
      const parsedM2 = lotAreaM2 ? parseInt(lotAreaM2, 10) : undefined
      const cleanM2 = parsedM2 && parsedM2 > 0 ? parsedM2 : undefined
      const cleanAddons = selectedAddons.length > 0 ? selectedAddons : undefined

      if (type === 'ON_DEMAND' || type === 'SCHEDULED') {
        const request = await requestsService.create({
          categoryId:    category.id,
          type:          type === 'SCHEDULED' ? 'SCHEDULED' : 'ON_DEMAND',
          address:       data.address as string,
          latitude:      lat,
          longitude:     lng,
          lotSize,
          lotAreaM2:     cleanM2,
          addons:        cleanAddons,
          equipmentTier,
          description:   data.description as string | undefined,
          scheduledAt:   (data as ScheduledForm).scheduledAt,
        })
        navigate(`/requests/${request.id}/checkout`)
      } else {
        // SUBSCRIPTION — hand off to the subscription wizard with pre-filled state
        navigate('/subscriptions/new', {
          state: {
            categoryId:      category.id,
            categoryName:    category.name,
            address:         data.address as string,
            latitude:        lat,
            longitude:       lng,
            description:     data.description as string | undefined,
          },
        })
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } }
      setError(apiErr?.response?.data?.error ?? 'Error al crear el pedido')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading || !category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const meta = TYPE_LABELS[type]

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
        >
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

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 pt-6 pb-40 space-y-6">

        {/* ── Lot size selector ── */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Tamaño del terreno
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LOT_SIZES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setLotSize(opt.value); setLotAreaM2(''); setShowM2Input(false) }}
                className={`py-3 px-2 rounded-2xl border-2 text-center transition-all ${
                  lotSize === opt.value
                    ? 'border-primary bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-xl mb-0.5">{opt.emoji}</div>
                <div className={`font-bold text-sm ${lotSize === opt.value ? 'text-primary' : 'text-gray-800'}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-gray-500">{opt.sublabel}</div>
              </button>
            ))}
          </div>

          {/* Optional exact m² input */}
          <button
            type="button"
            onClick={() => setShowM2Input((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors"
          >
            {showM2Input ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Ingresar m² exactos
          </button>
          {showM2Input && (
            <div className="mt-2">
              <Input
                label=""
                placeholder="Ej: 150"
                type="number"
                min="1"
                max="5000"
                value={lotAreaM2}
                onChange={(e) => {
                  setLotAreaM2(e.target.value)
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val)) {
                    if (val <= 100) setLotSize('SMALL')
                    else if (val <= 300) setLotSize('MEDIUM')
                    else setLotSize('LARGE')
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* ── Equipment tier ── */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Equipo del profesional
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['STANDARD', 'PREMIUM'] as EquipmentTier[]).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setEquipmentTier(tier)}
                className={`py-3 px-4 rounded-2xl border-2 text-left transition-all ${
                  equipmentTier === tier
                    ? 'border-primary bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`font-bold text-sm ${equipmentTier === tier ? 'text-primary' : 'text-gray-800'}`}>
                  {tier === 'STANDARD' ? 'Estándar' : 'Premium'}
                </div>
                <div className="text-xs text-gray-500">
                  {tier === 'STANDARD' ? 'Herramientas básicas' : 'Equipo profesional, más rápido'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Addons ── */}
        {category.addonDefinitions.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Extras <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="space-y-2">
              {category.addonDefinitions.map((addon) => {
                const checked = selectedAddons.includes(addon.key)
                return (
                  <button
                    key={addon.key}
                    type="button"
                    onClick={() => toggleAddon(addon.key)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${
                      checked ? 'border-primary bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-left">
                      <p className={`text-sm font-medium ${checked ? 'text-primary' : 'text-gray-800'}`}>
                        {addon.label}
                      </p>
                      {addon.description && (
                        <p className="text-xs text-gray-500">{addon.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs text-gray-500">
                        {addon.surchargeType === 'flat' ? `+${formatPrice(addon.value)}` : `+${addon.value}%`}
                      </span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        checked ? 'border-primary bg-primary text-white' : 'border-gray-300'
                      }`}>
                        {checked && (
                          <svg viewBox="0 0 10 8" fill="none" className="w-3 h-2">
                            <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Address ── */}
        <div className="relative">
          <Input
            label="Dirección del servicio"
            placeholder="Av. Corrientes 1234, CABA"
            error={(errors as { address?: { message?: string } }).address?.message}
            {...register('address')}
          />
          <MapPin size={16} className="absolute right-3 top-[38px] text-gray-400" />
        </div>

        {/* ── Scheduled date/time ── */}
        {type === 'SCHEDULED' && (
          <Input
            label="Fecha y hora"
            type="datetime-local"
            error={(errors as { scheduledAt?: { message?: string } }).scheduledAt?.message}
            min={new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)}
            {...register('scheduledAt')}
          />
        )}

        {/* ── Subscription options ── */}
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
                    {day}
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
                onClick={() => setPreferSameWorker((v) => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  preferSameWorker ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  preferSameWorker ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </>
        )}

        {/* ── Description ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Descripción del trabajo <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            rows={3}
            placeholder={`¿Qué necesitás exactamente? Ej: "Cortar el pasto del jardín delantero, aprox. 50 m²"`}
            {...register('description')}
          />
        </div>

        {/* ── Photo placeholder ── */}
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

      {/* ── Fixed bottom: price breakdown + CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 shadow-lg">
        {quote && (
          <div className="mb-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-500">Precio estimado</p>
                <p className="text-2xl font-heading font-bold text-gray-900">
                  {formatPrice(quote.total)}
                </p>
              </div>
              <div className="text-right text-xs text-gray-400 space-y-0.5">
                <div>Base: {formatPrice(quote.basePrice)}</div>
                {quote.areasSurcharge > 0 && (
                  <div className="text-amber-600">+Área: {formatPrice(quote.areasSurcharge)}</div>
                )}
                {quote.addonsTotal > 0 && (
                  <div className="text-blue-600">+Extras: {formatPrice(quote.addonsTotal)}</div>
                )}
                <div className="text-gray-400">Comisión TUKI: {formatPrice(quote.platformFee)}</div>
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((quote.subtotal / quote.total) * 100))}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">~{quote.estimatedDurationMin} min</span>
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={submitting}
          onClick={handleSubmit(onSubmit)}
        >
          {type === 'ON_DEMAND'    && '⚡ Buscar profesional ahora'}
          {type === 'SCHEDULED'   && '📅 Confirmar programación'}
          {type === 'SUBSCRIPTION' && '🔄 Ver resumen de suscripción'}
        </Button>
      </div>
    </div>
  )
}
