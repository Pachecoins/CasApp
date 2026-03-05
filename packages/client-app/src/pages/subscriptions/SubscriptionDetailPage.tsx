import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Calendar, Clock, MapPin, User,
  ChevronRight, Trash2, AlertCircle, CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
  cancelledAt: string | null
  startedAt: string
  category: { name: string; slug: string; basePrice: number; scheduledPrice: number }
  worker?: { user: { firstName: string; lastName: string; avatarUrl?: string; phone?: string } } | null
}

const FREQ_LABELS: Record<Subscription['frequency'], string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00',
  '12:00', '14:00', '15:00', '16:00', '17:00', '18:00',
]

export function SubscriptionDetailPage() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>()
  const navigate = useNavigate()

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<'day' | 'time' | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!subscriptionId) return
    subscriptionsService
      .getById(subscriptionId)
      .then(setSubscription)
      .catch(() => navigate('/subscriptions'))
      .finally(() => setLoading(false))
  }, [subscriptionId, navigate])

  const handleUpdateDay = async (dayOfWeek: number) => {
    if (!subscription) return
    setSaving(true)
    try {
      const updated = await subscriptionsService.update(subscription.id, { dayOfWeek })
      setSubscription(updated)
      setEditing(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTime = async (timeSlot: string) => {
    if (!subscription) return
    setSaving(true)
    try {
      const updated = await subscriptionsService.update(subscription.id, { timeSlot })
      setSubscription(updated)
      setEditing(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSameWorker = async () => {
    if (!subscription) return
    const updated = await subscriptionsService
      .update(subscription.id, { preferSameWorker: !subscription.preferSameWorker })
      .catch(console.error)
    if (updated) setSubscription(updated)
  }

  const handleCancel = async () => {
    if (!subscription) return
    setCancelling(true)
    try {
      await subscriptionsService.cancel(subscription.id)
      navigate('/subscriptions', { replace: true })
    } catch (err) {
      console.error(err)
    } finally {
      setCancelling(false)
    }
  }

  if (loading || !subscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const workerName = subscription.worker
    ? `${subscription.worker.user.firstName} ${subscription.worker.user.lastName}`
    : null

  const nextDate = subscription.nextServiceDate
    ? new Date(subscription.nextServiceDate).toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const freqDays: Record<Subscription['frequency'], number> = { WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 }
  const monthlyEstimate = Math.round((subscription.pricePerVisit * 30) / freqDays[subscription.frequency])

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => navigate('/subscriptions')}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-gray-900">{subscription.category.name}</h1>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              subscription.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {subscription.isActive ? '● Activa' : '● Cancelada'}
            </span>
            <span className="text-xs text-gray-400">{FREQ_LABELS[subscription.frequency]}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Next service */}
        {subscription.isActive && nextDate && (
          <div className="bg-primary rounded-2xl p-4 text-white">
            <p className="text-xs opacity-70 mb-1">Próximo servicio</p>
            <p className="font-semibold capitalize">{nextDate}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
              <p className="text-sm opacity-80">Precio por visita</p>
              <p className="font-heading font-bold text-xl">{formatPrice(subscription.pricePerVisit)}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">Costo mensual est.</p>
            <p className="text-xl font-heading font-bold text-gray-900 mt-1">{formatPrice(monthlyEstimate)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">Activa desde</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {new Date(subscription.startedAt).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Assigned worker */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
            <User size={16} className="text-primary" />
            Profesional asignado
          </h3>
          {workerName ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center font-bold text-primary">
                {subscription.worker!.user.firstName[0]}
              </div>
              <div>
                <p className="font-medium text-gray-900">{workerName}</p>
                <p className="text-xs text-gray-400">
                  {subscription.preferSameWorker ? 'Preferido cuando esté disponible' : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Se asignará automáticamente al próximo servicio
            </p>
          )}
        </div>

        {/* Schedule settings */}
        {subscription.isActive && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <h3 className="font-medium text-gray-800">Configuración del horario</h3>
            </div>

            {/* Day */}
            <button
              className="w-full flex items-center justify-between p-4 border-b border-gray-50"
              onClick={() => setEditing(editing === 'day' ? null : 'day')}
            >
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-gray-400" />
                <div className="text-left">
                  <p className="text-xs text-gray-400">Día</p>
                  <p className="font-medium text-gray-900">{DAYS[subscription.dayOfWeek]}</p>
                </div>
              </div>
              <ChevronRight
                size={16}
                className={`text-gray-300 transition-transform ${editing === 'day' ? 'rotate-90' : ''}`}
              />
            </button>

            {editing === 'day' && (
              <div className="px-4 pb-4 grid grid-cols-4 gap-2">
                {DAYS.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    disabled={saving}
                    onClick={() => handleUpdateDay(idx)}
                    className={`py-2 rounded-xl text-sm transition-all ${
                      subscription.dayOfWeek === idx
                        ? 'bg-primary text-white'
                        : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {/* Time */}
            <button
              className="w-full flex items-center justify-between p-4 border-b border-gray-50"
              onClick={() => setEditing(editing === 'time' ? null : 'time')}
            >
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-gray-400" />
                <div className="text-left">
                  <p className="text-xs text-gray-400">Horario</p>
                  <p className="font-medium text-gray-900">{subscription.timeSlot}</p>
                </div>
              </div>
              <ChevronRight
                size={16}
                className={`text-gray-300 transition-transform ${editing === 'time' ? 'rotate-90' : ''}`}
              />
            </button>

            {editing === 'time' && (
              <div className="px-4 pb-4 grid grid-cols-3 gap-2">
                {TIME_SLOTS.map((time) => (
                  <button
                    key={time}
                    type="button"
                    disabled={saving}
                    onClick={() => handleUpdateTime(time)}
                    className={`py-2.5 rounded-xl text-sm transition-all ${
                      subscription.timeSlot === time
                        ? 'bg-primary text-white'
                        : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}

            {/* Same worker */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <User size={16} className="text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">Mismo profesional</p>
                  <p className="text-xs text-gray-400">Si está disponible</p>
                </div>
              </div>
              <button
                onClick={handleToggleSameWorker}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  subscription.preferSameWorker ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    subscription.preferSameWorker ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Cancel */}
        {subscription.isActive && (
          <>
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 text-red-500 text-sm font-medium"
              >
                <Trash2 size={16} />
                Cancelar suscripción
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800">¿Cancelar la suscripción?</p>
                    <p className="text-sm text-red-600 mt-0.5">
                      No se generarán nuevos pedidos y no se podrá reactivar. Podés crear una nueva en cualquier momento.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-200"
                    onClick={() => setShowCancelConfirm(false)}
                  >
                    No, mantener
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    loading={cancelling}
                    onClick={handleCancel}
                  >
                    Sí, cancelar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Cancelled state */}
        {!subscription.isActive && subscription.cancelledAt && (
          <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3 text-gray-500">
            <CheckCircle size={18} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Suscripción cancelada</p>
              <p className="text-xs mt-0.5">
                {new Date(subscription.cancelledAt).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
