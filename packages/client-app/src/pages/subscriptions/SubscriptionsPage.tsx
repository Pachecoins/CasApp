import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Plus, ChevronRight, Calendar, Pause } from 'lucide-react'
import { subscriptionsService } from '@/services/requests.service'
import { formatPrice } from '@/lib/utils'

interface Subscription {
  id: string
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  dayOfWeek: number
  timeSlot: string
  pricePerVisit: number
  isActive: boolean
  nextServiceDate: string | null
  preferSameWorker: boolean
  category: { name: string; slug: string }
  worker?: { user: { firstName: string; lastName: string; avatarUrl?: string } } | null
}

const FREQ_LABELS: Record<Subscription['frequency'], { label: string; days: number }> = {
  WEEKLY: { label: 'Semanal', days: 7 },
  BIWEEKLY: { label: 'Quincenal', days: 14 },
  MONTHLY: { label: 'Mensual', days: 30 },
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function SubscriptionsPage() {
  const navigate = useNavigate()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    subscriptionsService
      .getMySubscriptions()
      .then(setSubscriptions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const active = subscriptions.filter((s) => s.isActive)
  const inactive = subscriptions.filter((s) => !s.isActive)

  const totalMonthly = active.reduce((sum, s) => {
    const { days } = FREQ_LABELS[s.frequency]
    return sum + (s.pricePerVisit * 30) / days
  }, 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-heading font-bold text-gray-900">Mis suscripciones</h1>
            <p className="text-xs text-gray-500">{active.length} activa{active.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/subscriptions/new')}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl"
        >
          <Plus size={16} />
          Nueva
        </button>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-5">
        {/* Monthly cost summary */}
        {active.length > 0 && (
          <div className="bg-primary rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw size={14} className="opacity-70" />
              <span className="text-xs opacity-70">Costo mensual estimado</span>
            </div>
            <p className="text-3xl font-heading font-bold">{formatPrice(Math.round(totalMonthly))}</p>
            <p className="text-xs opacity-60 mt-1">
              {active.length} servicio{active.length !== 1 ? 's' : ''} recurrente{active.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-16">
            <RefreshCw size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin suscripciones activas</p>
            <p className="text-sm text-gray-400 mt-1 mb-6">
              Programá servicios recurrentes y ahorrá hasta 25%
            </p>
            <button
              onClick={() => navigate('/subscriptions/new')}
              className="bg-primary text-white font-medium px-6 py-3 rounded-2xl flex items-center gap-2 mx-auto"
            >
              <Plus size={18} />
              Crear mi primera suscripción
            </button>
          </div>
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Activas</h2>
                <div className="space-y-3">
                  {active.map((sub) => (
                    <SubscriptionCard
                      key={sub.id}
                      sub={sub}
                      onClick={() => navigate(`/subscriptions/${sub.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive */}
            {inactive.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Canceladas</h2>
                <div className="space-y-3 opacity-60">
                  {inactive.map((sub) => (
                    <SubscriptionCard key={sub.id} sub={sub} onClick={() => {}} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SubscriptionCard({ sub, onClick }: { sub: Subscription; onClick: () => void }) {
  const freqMeta = FREQ_LABELS[sub.frequency]
  const workerName = sub.worker
    ? `${sub.worker.user.firstName} ${sub.worker.user.lastName}`
    : 'Sin profesional asignado'

  const nextDate = sub.nextServiceDate
    ? new Date(sub.nextServiceDate).toLocaleDateString('es-AR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : null

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 text-left"
    >
      <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
        <RefreshCw size={22} className="text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 truncate">{sub.category.name}</p>
          {!sub.isActive && (
            <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              <Pause size={10} />
              Cancelada
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{workerName}</p>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
          <span className="bg-primary-50 text-primary px-2 py-0.5 rounded-full font-medium">
            {freqMeta.label}
          </span>
          <span>{DAY_NAMES[sub.dayOfWeek]} {sub.timeSlot}</span>
          {nextDate && (
            <>
              <span>·</span>
              <Calendar size={10} />
              <span>{nextDate}</span>
            </>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="font-heading font-bold text-gray-900">{formatPrice(sub.pricePerVisit)}</p>
        <p className="text-xs text-gray-400">/ visita</p>
        <ChevronRight size={16} className="text-gray-300 ml-auto mt-1" />
      </div>
    </button>
  )
}
