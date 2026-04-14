import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Zap, Calendar, RefreshCw, ChevronRight } from 'lucide-react'
import { categoriesService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'
import type { ServiceCategory } from '@casapp/shared'

const CATEGORY_META: Record<string, { icon: string; color: string; bgColor: string }> = {
  jardineria:       { icon: '🌿', color: 'text-green-700',  bgColor: 'bg-green-50' },
  piletas:          { icon: '💧', color: 'text-blue-700',   bgColor: 'bg-blue-50' },
  limpieza:         { icon: '🧹', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  plomeria:         { icon: '🔧', color: 'text-orange-700', bgColor: 'bg-orange-50' },
  electricidad:     { icon: '⚡', color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
  pintura:          { icon: '🎨', color: 'text-pink-700',   bgColor: 'bg-pink-50' },
  carpinteria:      { icon: '🪟', color: 'text-amber-700',  bgColor: 'bg-amber-50' },
  plagas:           { icon: '🐜', color: 'text-red-700',    bgColor: 'bg-red-50' },
  'aire-acondicionado': { icon: '❄️', color: 'text-cyan-700', bgColor: 'bg-cyan-50' },
  otros:            { icon: '➕', color: 'text-gray-700',   bgColor: 'bg-gray-50' },
}

export function CategoryModalityPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [category, setCategory] = useState<ServiceCategory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    categoriesService
      .getBySlug(slug)
      .then(setCategory)
      .catch(() => navigate('/home'))
      .finally(() => setLoading(false))
  }, [slug, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!category) return null

  const meta = CATEGORY_META[slug!] ?? { icon: '🏠', color: 'text-gray-700', bgColor: 'bg-gray-50' }

  const basePrice = category.basePriceStandard
  const subscriptionPrice = Math.round(basePrice * 0.75)

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
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${meta.bgColor}`}
        >
          {meta.icon}
        </div>
        <h1 className="text-lg font-heading font-bold text-gray-900">{category.name}</h1>
      </div>

      {/* Content */}
      <div className="px-4 pt-6 pb-8">
        <h2 className="text-xl font-heading font-bold text-gray-900 mb-1">
          ¿Cuándo lo necesitás?
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Elegí la modalidad que mejor se adapte a tus necesidades
        </p>

        {/* On-demand */}
        <button
          onClick={() => navigate(`/services/${slug}/configure?type=ON_DEMAND`)}
          className="w-full card mb-3 hover:shadow-card-hover transition-all active:scale-[0.99] text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-50 flex items-center justify-center flex-shrink-0">
              <Zap size={22} className="text-secondary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-heading font-bold text-gray-900">Ahora</h3>
                <span className="badge-ondemand">On-demand</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                Un profesional llega en aproximadamente 30-60 min
              </p>
              <p className="text-base font-bold text-secondary">
                desde {formatPrice(basePrice)}
              </p>
              <p className="text-xs text-gray-400">Precio según tamaño del trabajo</p>
            </div>
            <ChevronRight size={18} className="text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </button>

        {/* Scheduled */}
        <button
          onClick={() => navigate(`/services/${slug}/configure?type=SCHEDULED`)}
          className="w-full card mb-3 hover:shadow-card-hover transition-all active:scale-[0.99] text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Calendar size={22} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-heading font-bold text-gray-900">Programar</h3>
                <span className="badge-scheduled">Programado</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                Elegí el día y horario que más te convenga
              </p>
              <p className="text-base font-bold text-blue-600">
                desde {formatPrice(basePrice)}
              </p>
              <p className="text-xs text-gray-400">Precio estándar</p>
            </div>
            <ChevronRight size={18} className="text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </button>

        {/* Subscription */}
        <button
          onClick={() => navigate(`/services/${slug}/configure?type=SUBSCRIPTION`)}
          className="w-full card hover:shadow-card-hover transition-all active:scale-[0.99] text-left relative overflow-hidden"
        >
          {/* Best value badge */}
          <div className="absolute top-3 right-3 bg-accent text-xs font-bold text-amber-800 px-2 py-0.5 rounded-full">
            Mejor precio
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <RefreshCw size={22} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-heading font-bold text-gray-900">Suscripción</h3>
                <span className="badge-subscription">Recurrente</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                Semanal, quincenal o mensual — siempre el mismo profesional
              </p>
              <p className="text-base font-bold text-primary">
                desde {formatPrice(subscriptionPrice)}/visita
              </p>
              <p className="text-xs text-gray-400">Hasta 25% de ahorro</p>
            </div>
            <ChevronRight size={18} className="text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </button>

        {/* Category description */}
        {category.description && (
          <div className="mt-6 p-4 bg-gray-50 rounded-2xl">
            <p className="text-sm text-gray-600">{category.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
